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

import { NextRequest } from "next/server";
import {
  DEFAULT_COMPLIANCE_VOICES,
  resolveModelProvider,
  runDebate,
  synthesizeDebate,
  type AgentContext,
  type DebateEvent,
  type DebateVoice,
  type RetrievedSnippet,
} from "@compliance-ai/agents";
import { getDefaultCognitionStore, type RetrievalResult } from "@compliance-ai/cognition";
import { ensureTenant } from "../../../lib/bootstrap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DebateRequestBody {
  userMessage?: string;
  voices?: DebateVoice[];
  timeoutMs?: number;
  maxTokens?: number;
  retrieveAuthorities?: boolean;
}

const DEFAULT_PROMPT = DEFAULT_COMPLIANCE_VOICES[0]?.systemPromptSuffix
  ? "Review this offering memorandum excerpt against Ontario NI 45-106 and surface the top 3 disclosure gaps a compliance reviewer should raise: " +
    "'The issuer offers Class A units to accredited investors only. Past performance has consistently exceeded benchmarks. " +
    "Subscription proceeds will be applied to general working capital. Risk factors are listed in Schedule B.'"
  : "Reply with a one-paragraph greeting.";

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

export async function POST(req: NextRequest) {
  let body: DebateRequestBody = {};
  try {
    body = (await req.json()) as DebateRequestBody;
  } catch {
    // empty body → use defaults
  }

  const userMessage = body.userMessage?.trim() || DEFAULT_PROMPT;
  const voices = body.voices?.length ? body.voices : DEFAULT_COMPLIANCE_VOICES;
  const timeoutMs = Math.min(180_000, Math.max(5_000, body.timeoutMs ?? 90_000));
  const maxTokens = Math.min(2048, Math.max(64, body.maxTokens ?? 768));
  const retrieveAuthorities = body.retrieveAuthorities ?? !body.voices?.length;

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
            ...(provider.baseUrl ? { baseUrl: provider.baseUrl } : {}),
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
        try {
          const synthesis = await synthesizeDebate(result, userMessage, context, {
            ...(req.signal ? { signal: req.signal } : {}),
          });
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
