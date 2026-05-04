/**
 * Multi-voice debate API — POST /api/debate
 *
 * Runs N parallel voices against the configured LLM (single Qwen 2.5 72B
 * MI300X endpoint by default; works with any provider). Streams Server-Sent
 * Events so the UI can fill voice cards token-by-token as the model emits.
 *
 * Streams these SSE events:
 *   - debate-started     { provider, model, voiceCount, voiceNames, retrievedSnippets }
 *   - voice-started      { index, name }
 *   - voice-delta        { index, name, delta }    ← per-token streaming
 *   - voice-completed    { index, name, status, prose, citations, usage, error? }
 *   - debate-done        { durationMs, wallClockMs }
 *   - error              { message }
 *
 * Body: { userMessage?, voices?, timeoutMs?, maxTokens?, retrieveAuthorities? }
 *   - When `retrieveAuthorities` is true (default) and no voices are given,
 *     seeds the demo tenant + retrieves NI 45-106 snippets so default voices
 *     produce citation-grade output. Set false to skip the retrieval step
 *     for use cases where compliance citations are irrelevant (code review,
 *     decision making, document critique).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_COMPLIANCE_VOICES,
  PERSONA_SYSTEM_PROMPTS,
  resolveModelProvider,
  runDebate,
  runFollowup,
  synthesizeDebate,
  type AgentContext,
  type DebateEvent,
  type DebateVoice,
  type RetrievedSnippet,
} from "@compliance-ai/agents";
import { getDefaultCognitionStore, type RetrievalResult } from "@compliance-ai/cognition";
import { ensureTenant } from "../../../lib/bootstrap";
import { clientIdFromRequest, consumeToken, readConfigFromEnv } from "../../../lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DebateRequestBody {
  userMessage?: string;
  voices?: unknown;
  timeoutMs?: number;
  maxTokens?: number;
  retrieveAuthorities?: boolean;
  /**
   * When true (default false), after the synthesis lands the route fires a
   * round-2 follow-up where each voice defends, updates, or concedes its
   * stance given the others. Costs one extra parallel batch on the GPU.
   */
  followup?: boolean;
}

const DEFAULT_PROMPT = DEFAULT_COMPLIANCE_VOICES[0]?.systemPromptSuffix
  ? "Review this offering memorandum excerpt against Ontario NI 45-106 and surface the top 3 disclosure gaps a compliance reviewer should raise: " +
    "'The issuer offers Class A units to accredited investors only. Past performance has consistently exceeded benchmarks. " +
    "Subscription proceeds will be applied to general working capital. Risk factors are listed in Schedule B.'"
  : "Reply with a one-paragraph greeting.";

const MAX_VOICES = 6;
const MAX_USER_MESSAGE_CHARS = 8_000;
const MAX_VOICE_NAME_CHARS = 80;
const MAX_SYSTEM_PROMPT_CHARS = 3_000;
const MAX_TOTAL_SYSTEM_PROMPT_CHARS = 12_000;
const MIN_TIMEOUT_MS = 5_000;
const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_TIMEOUT_MS = 180_000;
const MIN_MAX_TOKENS = 64;
const DEFAULT_MAX_TOKENS = 768;
const MAX_MAX_TOKENS = 2_048;

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function toRetrievedSnippet(result: RetrievalResult): RetrievedSnippet {
  return {
    id: result.item.id ?? "",
    title: result.item.title,
    content: result.item.content,
    source: result.item.source,
    score: result.score,
  };
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function validateVoices(
  input: unknown,
): { voices: DebateVoice[]; customVoices: boolean } | { error: string } {
  if (input === undefined || (Array.isArray(input) && input.length === 0)) {
    return { voices: DEFAULT_COMPLIANCE_VOICES, customVoices: false };
  }
  if (!Array.isArray(input)) {
    return { error: "`voices` must be an array when provided." };
  }
  if (input.length > MAX_VOICES) {
    return { error: `Too many voices. Maximum is ${MAX_VOICES}.` };
  }

  let totalPromptChars = 0;
  const voices: DebateVoice[] = [];
  for (let i = 0; i < input.length; i++) {
    const raw = input[i];
    if (!raw || typeof raw !== "object") {
      return { error: `Voice ${i + 1} must be an object.` };
    }
    const record = raw as Record<string, unknown>;
    const name =
      typeof record.name === "string" && record.name.trim() ? record.name.trim() : `Voice ${i + 1}`;
    if (name.length > MAX_VOICE_NAME_CHARS) {
      return { error: `Voice ${i + 1} name is too long.` };
    }

    const personaId =
      typeof record.personaId === "string" && record.personaId.trim()
        ? record.personaId.trim()
        : undefined;
    if (personaId && !(personaId in PERSONA_SYSTEM_PROMPTS)) {
      return { error: `Voice ${i + 1} uses unknown personaId "${personaId}".` };
    }

    const systemPromptOverride =
      typeof record.systemPromptOverride === "string" ? record.systemPromptOverride.trim() : "";
    const systemPromptSuffix =
      typeof record.systemPromptSuffix === "string" ? record.systemPromptSuffix.trim() : "";
    if (systemPromptOverride.length > MAX_SYSTEM_PROMPT_CHARS) {
      return { error: `Voice ${i + 1} system prompt is too long.` };
    }
    if (systemPromptSuffix.length > MAX_SYSTEM_PROMPT_CHARS) {
      return { error: `Voice ${i + 1} system prompt suffix is too long.` };
    }
    if (!personaId && !systemPromptOverride) {
      return { error: `Voice ${i + 1} needs personaId or systemPromptOverride.` };
    }

    totalPromptChars += systemPromptOverride.length + systemPromptSuffix.length;
    if (totalPromptChars > MAX_TOTAL_SYSTEM_PROMPT_CHARS) {
      return { error: "Combined voice prompts are too long." };
    }

    voices.push({
      name,
      ...(personaId ? { personaId: personaId as DebateVoice["personaId"] } : {}),
      ...(systemPromptOverride ? { systemPromptOverride } : {}),
      ...(systemPromptSuffix ? { systemPromptSuffix } : {}),
    });
  }

  return { voices, customVoices: true };
}

async function withAbortDeadline<T>(
  label: string,
  timeoutMs: number,
  parentSignal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      run(controller.signal),
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => {
          const err = new Error(`${label} exceeded ${timeoutMs}ms.`);
          controller.abort(err);
          reject(err);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
}

// Default: 5 debates per hour per client. Multi-voice debates are expensive
// (each is N voices + synthesis + optional round-2 = O(N+2) inferences on a
// shared GPU) so the bucket is generous on the first burst and slow to
// refill. Override via DEBATE_RATE_LIMIT="capacity:refillPerSec", e.g.
// "20:0.005" for 20 burst + 1 every ~3 minutes.
const DEBATE_RATE_LIMIT = readConfigFromEnv("DEBATE_RATE_LIMIT", {
  capacity: 5,
  refillPerSec: 5 / 3600, // refills the full bucket once per hour
});

export async function POST(req: NextRequest) {
  // Rate limit before doing any work — a malicious client should pay zero
  // GPU cycles. Skip when DEBATE_RATE_LIMIT_DISABLE=1 (handy for local dev
  // and the deterministic test suite).
  if (process.env.DEBATE_RATE_LIMIT_DISABLE !== "1") {
    const decision = consumeToken(`debate:${clientIdFromRequest(req)}`, DEBATE_RATE_LIMIT);
    if (!decision.allowed) {
      return NextResponse.json(
        {
          error: `Rate limit reached. Try again in ${decision.retryAfterSec}s.`,
          retryAfterSec: decision.retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(decision.retryAfterSec),
            "X-RateLimit-Limit": String(DEBATE_RATE_LIMIT.capacity),
            "X-RateLimit-Remaining": String(decision.remaining),
          },
        },
      );
    }
  }

  let body: DebateRequestBody = {};
  try {
    body = (await req.json()) as DebateRequestBody;
  } catch {
    // empty body → use defaults
  }

  const rawUserMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  if (rawUserMessage.length > MAX_USER_MESSAGE_CHARS) {
    return NextResponse.json(
      { error: `userMessage is too long. Maximum is ${MAX_USER_MESSAGE_CHARS} characters.` },
      { status: 400 },
    );
  }

  const validatedVoices = validateVoices(body.voices);
  if ("error" in validatedVoices) {
    return NextResponse.json({ error: validatedVoices.error }, { status: 400 });
  }

  const userMessage = rawUserMessage || DEFAULT_PROMPT;
  const voices = validatedVoices.voices;
  const timeoutMs = clampNumber(body.timeoutMs, DEFAULT_TIMEOUT_MS, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS);
  const maxTokens = clampNumber(body.maxTokens, DEFAULT_MAX_TOKENS, MIN_MAX_TOKENS, MAX_MAX_TOKENS);
  const retrieveAuthorities =
    typeof body.retrieveAuthorities === "boolean"
      ? body.retrieveAuthorities
      : !validatedVoices.customVoices;
  const runFollowupRound = body.followup === true;

  // Authority retrieval is only meaningful for the compliance voices. For
  // universal use cases (code review, decision making, doc critique) the
  // user passes their own voices and we skip retrieval — voices then
  // operate on the userMessage alone, which is what they want.
  const organizationId = "debate-demo";
  let retrievedSnippets: RetrievedSnippet[] = [];
  if (retrieveAuthorities) {
    try {
      await ensureTenant(organizationId);
      const cognitionStore = getDefaultCognitionStore();
      const results = await cognitionStore.retrieve({
        query: userMessage,
        topK: 6,
        organizationId,
        scoreThreshold: 0,
      });
      retrievedSnippets = results.map(toRetrievedSnippet);
    } catch {
      retrievedSnippets = [];
    }
  }

  // Compliance template: pass retrievedSnippets (so the model cites NI 45-106
  // authorities). Universal templates: pass undefined so runAgent skips the
  // cognition context block entirely — otherwise the empty-array path emits
  // the "RETRIEVAL GAP" directive, which is the right safety behaviour for
  // securities review but instructs a code-review voice to refuse to cite
  // authorities it was never going to look at.
  const context: AgentContext = {
    control: null,
    frameworkScope: [],
    organizationId,
    ...(retrieveAuthorities ? { retrievedSnippets } : {}),
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();

      let provider;
      try {
        provider = resolveModelProvider();
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            sseFrame({
              type: "error",
              message: err instanceof Error ? err.message : String(err),
            }),
          ),
        );
        controller.close();
        return;
      }

      controller.enqueue(
        encoder.encode(
          sseFrame({
            type: "debate-started",
            provider: provider.provider,
            model: provider.model,
            voiceCount: voices.length,
            voiceNames: voices.map((v) => v.name),
            retrievedSnippets: retrievedSnippets.length,
          }),
        ),
      );

      const startedAt = Date.now();
      // Forward every voice event from the debate engine to the SSE stream.
      // Each voice yields voice-started, then a stream of voice-delta, then
      // voice-completed. The UI uses voice-delta to fill cards in real time
      // and voice-completed to switch the card to its final state with
      // parsed citations.
      const onEvent = (ev: DebateEvent) => {
        try {
          controller.enqueue(encoder.encode(sseFrame(ev)));
        } catch {
          // Stream already closed — typically because the client navigated
          // away or hit Stop. Ignore; voices will keep running but events
          // are dropped silently.
        }
      };

      // Wire the request's signal so a client-side AbortController on the
      // fetch (the "Stop" button) terminates voice fetches in-flight.
      try {
        const result = await runDebate(voices, context, userMessage, {
          timeoutMs,
          maxTokens,
          onEvent,
          ...(req.signal ? { signal: req.signal } : {}),
        });

        // Synthesis pass: one extra LLM call that turns the three voices
        // into agree / disagree / verdict. This is the load-bearing UX
        // beat — three blobs of text become one sentence the viewer can
        // act on. Failure is non-fatal; we still emit debate-done so the
        // UI closes the panel cleanly.
        let synthesis = null;
        try {
          synthesis = await withAbortDeadline("Debate synthesis", timeoutMs, req.signal, (signal) =>
            synthesizeDebate(result, userMessage, context, { signal }),
          );
          if (synthesis) {
            controller.enqueue(
              encoder.encode(
                sseFrame({
                  type: "synthesis",
                  agreed: synthesis.agreed,
                  disagreed: synthesis.disagreed,
                  verdict: synthesis.verdict,
                }),
              ),
            );
          }
        } catch {
          // Synthesis is best-effort.
        }

        // Round-2 follow-up. Each surviving voice gets a second turn
        // where it sees the other voices' responses and the synthesis,
        // then defends / updates / concedes its stance. This is a real
        // demonstration of the AMD / MI300X memory headroom: another
        // parallel batch of N inferences on the same single GPU,
        // running through the same vLLM endpoint.
        if (runFollowupRound && synthesis) {
          try {
            const followups = await withAbortDeadline(
              "Debate follow-up",
              timeoutMs,
              req.signal,
              (signal) =>
                runFollowup(result, synthesis, userMessage, context, {
                  signal,
                  onFollowupEvent: (ev) => {
                    try {
                      controller.enqueue(encoder.encode(sseFrame(ev)));
                    } catch {
                      /* stream closed */
                    }
                  },
                }),
            );
            controller.enqueue(
              encoder.encode(
                sseFrame({
                  type: "followup-done",
                  followups: followups.map((f) => ({
                    index: f.index,
                    name: f.name,
                    status: f.status,
                    stance: f.stance,
                    prose: f.prose,
                    ...(f.error ? { error: f.error } : {}),
                  })),
                }),
              ),
            );
          } catch {
            /* follow-up is best-effort too */
          }
        }

        controller.enqueue(
          encoder.encode(
            sseFrame({
              type: "debate-done",
              durationMs: result.durationMs,
              wallClockMs: Date.now() - startedAt,
            }),
          ),
        );
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            sseFrame({
              type: "error",
              message: err instanceof Error ? err.message : String(err),
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
