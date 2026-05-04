/**
 * Multi-voice debate API — POST /api/debate
 *
 * Runs the compliance review through N parallel voices (skeptical /
 * permissive / regulator) against a single LLM endpoint. Designed for the
 * AMD MI300X hackathon: one Qwen 2.5 72B endpoint hosts the whole panel
 * concurrently, demonstrating the GPU's headroom.
 *
 * Streams SSE events:
 *   - debate-started     { provider, model, voiceCount }
 *   - voice-completed    { name, status, prose, citations, latencyMs }
 *   - debate-done        { durationMs }
 *   - error              { message }
 */

import { NextRequest } from "next/server";
import {
  DEFAULT_COMPLIANCE_VOICES,
  resolveModelProvider,
  runDebate,
  type AgentContext,
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
}

const DEFAULT_PROMPT =
  "Review this offering memorandum excerpt against Ontario NI 45-106 and surface the top 3 disclosure gaps a compliance reviewer should raise: " +
  "'The issuer offers Class A units to accredited investors only. Past performance has consistently exceeded benchmarks. " +
  "Subscription proceeds will be applied to general working capital. Risk factors are listed in Schedule B.'";

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
  const timeoutMs = Math.min(180_000, Math.max(5_000, body.timeoutMs ?? 60_000));
  const maxTokens = Math.min(2048, Math.max(64, body.maxTokens ?? 768));

  // Seed the demo tenant + retrieve real NI 45-106 / OSC authorities. Without
  // this, every voice falls into the RETRIEVAL-GAP path and produces uncited
  // prose — correct safety behaviour but a poor demo. We accept the latency
  // cost (one bootstrap + one BM25 retrieval) for citation-grade output that
  // matches what the production review pipeline produces.
  const organizationId = "debate-demo";
  await ensureTenant(organizationId);
  let retrievedSnippets: RetrievedSnippet[] = [];
  try {
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

  const context: AgentContext = {
    control: null,
    frameworkScope: [],
    organizationId,
    retrievedSnippets,
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
          }),
        ),
      );

      // We don't need to interleave voice deltas per-token — runDebate
      // resolves complete voice results. For a more polished UX we'd run
      // each voice via runAgent here and forward deltas; but for the
      // hackathon the "all 3 voices land in parallel ~5s apart" effect is
      // already striking enough on a single MI300X.
      const startedAt = Date.now();
      try {
        const result = await runDebate(voices, context, userMessage, {
          timeoutMs,
          maxTokens,
        });
        for (let i = 0; i < result.voices.length; i++) {
          const voice = result.voices[i]!;
          controller.enqueue(
            encoder.encode(
              sseFrame({
                type: "voice-completed",
                index: i,
                name: voice.name,
                status: voice.status,
                prose: voice.prose,
                citations: voice.citations,
                usage: voice.usage,
                ...(voice.error ? { error: voice.error } : {}),
              }),
            ),
          );
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
