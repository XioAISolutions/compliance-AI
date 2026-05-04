/**
 * Live LLM healthcheck — GET /api/healthcheck/llm
 *
 * Distinct from /api/healthcheck (which only checks env vars + cognition store
 * + db): this route actually pings the configured LLM provider with a tiny
 * completion request and reports latency + a one-line sample. Designed for the
 * AMD MI300X / vLLM hackathon demo — judges can hit this URL during the live
 * demo to prove the model is online without needing to upload a document.
 *
 * Returns 200 when the provider responds with non-empty text, 503 otherwise.
 */

import { NextResponse } from "next/server";
import { pingProvider } from "@compliance-ai/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  // ?prompt=... lets demo viewers send a custom one-liner. Cap at 200 chars
  // so this doesn't become an open relay for the LLM.
  const customPrompt = url.searchParams.get("prompt")?.slice(0, 200) ?? undefined;
  const maxTokensParam = url.searchParams.get("max_tokens");
  const parsedMaxTokens = maxTokensParam ? Number(maxTokensParam) : NaN;
  const maxTokens = Number.isFinite(parsedMaxTokens)
    ? Math.min(256, Math.max(1, parsedMaxTokens))
    : 32;
  const parsedTimeoutMs = Number(url.searchParams.get("timeout_ms"));
  const timeoutMs = Number.isFinite(parsedTimeoutMs)
    ? Math.min(60_000, Math.max(1_000, parsedTimeoutMs))
    : 30_000;

  const started = Date.now();
  try {
    const result = await pingProvider({
      ...(customPrompt ? { prompt: customPrompt } : {}),
      maxTokens,
      timeoutMs,
    });
    const safeResult = { ...result };
    delete safeResult.baseUrl;
    return NextResponse.json(
      {
        ...safeResult,
        timestamp: new Date().toISOString(),
      },
      { status: result.ok ? 200 : 503 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        latencyMs: Date.now() - started,
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
