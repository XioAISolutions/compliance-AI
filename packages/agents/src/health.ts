/**
 * Provider health helpers.
 *
 * `pingProvider()` sends a minimal completion request through the configured
 * provider and reports latency + a one-line sample. The goal is to give the
 * /api/healthcheck/llm route (and a CLI smoke step) an honest "this endpoint
 * is reachable AND can decode a token" signal — distinct from "the env vars
 * are set correctly" which `resolveModelProvider()` already handles.
 *
 * The ping bypasses the persona / routing / cognition layers because those
 * have no bearing on whether the model server is up. We do go through
 * `runAgent` for the streaming path so we exercise the same SSE plumbing the
 * production calls use.
 */

import type { Control, FrameworkId } from "@compliance-ai/frameworks";
import { resolveModelProvider, runAgent, type ModelProvider } from "./run.js";
import type { AgentContext } from "./types.js";

export interface ProviderPingOptions {
  /** Override env-based provider resolution. */
  provider?: ModelProvider;
  /** Override the default model id. */
  model?: string;
  /** Maximum tokens to request from the model. Default 32 (fast). */
  maxTokens?: number;
  /** Wall-clock budget. Default 30_000 ms. */
  timeoutMs?: number;
  /** Override the prompt. Default asks for a one-word reply ("ready"). */
  prompt?: string;
}

export interface ProviderModelInfo {
  /** Model id reported by /v1/models (often matches `model` but can include vendor prefix). */
  id: string;
  /** Maximum context length in tokens. Reported by vLLM; null if the provider doesn't surface it. */
  maxContextTokens: number | null;
  /** Inference engine name (e.g. "vllm" for AMD/local; "openai" for hosted OpenAI). */
  ownedBy: string | null;
}

export interface ProviderPingResult {
  ok: boolean;
  provider: ModelProvider;
  model: string;
  baseUrl?: string;
  latencyMs: number;
  /** First ~120 chars of the model's response. Empty when the call errored. */
  sample: string;
  /** Output tokens reported by the model (count of tokens we generated for the sample). */
  outputTokens?: number;
  /** Approximate tokens-per-second computed from sample length / latency. */
  tokensPerSec?: number;
  /** Model capabilities surfaced by /v1/models, when supported. */
  modelInfo?: ProviderModelInfo;
  /** Set when ok=false. */
  error?: string;
}

const PING_CONTEXT: AgentContext = {
  control: null as Control | null,
  frameworkScope: [] as FrameworkId[],
  organizationId: "healthcheck",
};

const PING_PROMPT_DEFAULT =
  'Respond with the single word "ready" and nothing else. No punctuation, no preamble.';

export async function pingProvider(options: ProviderPingOptions = {}): Promise<ProviderPingResult> {
  const config = resolveModelProvider(process.env, {
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.model ? { model: options.model } : {}),
  });

  const started = Date.now();
  const timeoutMs = options.timeoutMs ?? 30_000;
  const maxTokens = options.maxTokens ?? 32;

  let sample = "";
  let errored: string | null = null;
  let outputTokens: number | undefined;
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const ping = (async () => {
    for await (const ev of runAgent(PING_CONTEXT, [], options.prompt ?? PING_PROMPT_DEFAULT, {
      forcePersona: "drafter",
      provider: config.provider,
      model: config.model,
      maxTokens,
      signal: controller.signal,
    })) {
      if (ev.type === "text-delta") sample += ev.delta;
      if (ev.type === "error") {
        errored = ev.message;
        break;
      }
      if (ev.type === "done") {
        outputTokens = ev.usage.outputTokens;
        break;
      }
      // Cap sample length even if the model ignores instructions.
      if (sample.length > 200) break;
    }
  })();

  let timedOut = false;
  try {
    await Promise.race([
      ping,
      new Promise<void>((resolve) =>
        (timeoutId = setTimeout(() => {
          timedOut = true;
          controller.abort(new Error(`Provider did not respond within ${timeoutMs}ms.`));
          resolve();
        }, timeoutMs)),
      ),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (timedOut) {
    // Attach a rejection handler to the still-draining runAgent loop. The
    // AbortSignal above should stop OpenAI-compatible fetches promptly; this
    // keeps the returned timeout from surfacing a later unhandled rejection.
    void ping.catch(() => {});
  }

  const latencyMs = Date.now() - started;

  if (timedOut && !sample) {
    return {
      ok: false,
      provider: config.provider,
      model: config.model,
      ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
      latencyMs,
      sample: "",
      error: `Provider did not respond within ${timeoutMs}ms.`,
    };
  }

  if (errored) {
    return {
      ok: false,
      provider: config.provider,
      model: config.model,
      ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
      latencyMs,
      sample,
      error: errored,
    };
  }

  // Approximate tokens-per-second from output tokens / latency. We only
  // emit when both numbers are real — sample-only fallbacks would lie on
  // anything beyond ASCII English. The sample completions for the ping are
  // tiny (<32 tokens) so the ratio under-reports the steady-state TPS the
  // GPU can sustain on longer responses, but it's a useful proof-of-life.
  const tokensPerSec =
    outputTokens && latencyMs > 0 ? Math.round((outputTokens / latencyMs) * 1000) : undefined;

  // /v1/models is best-effort — we don't fail the ping if it errors. vLLM
  // reports `max_model_len` per model; OpenAI returns the model exists but
  // not a context length. Either way it's nice-to-have for the UI.
  const modelInfo = await fetchModelInfo(config).catch(() => undefined);

  return {
    ok: sample.trim().length > 0,
    provider: config.provider,
    model: config.model,
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    latencyMs,
    sample: sample.slice(0, 120),
    ...(outputTokens !== undefined ? { outputTokens } : {}),
    ...(tokensPerSec !== undefined ? { tokensPerSec } : {}),
    ...(modelInfo ? { modelInfo } : {}),
  };
}

async function fetchModelInfo(config: {
  provider: ModelProvider;
  model: string;
  baseUrl?: string;
}): Promise<ProviderModelInfo | undefined> {
  if (config.provider === "anthropic") return undefined; // no /v1/models on Anthropic SDK path
  const baseUrl = config.baseUrl;
  if (!baseUrl) return undefined;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.provider === "openai" && process.env.OPENAI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  } else if (config.provider === "amd_vllm" && process.env.AMD_VLLM_API_KEY) {
    headers.Authorization = `Bearer ${process.env.AMD_VLLM_API_KEY}`;
  }

  const res = await fetch(`${baseUrl}/models`, { headers });
  if (!res.ok) return undefined;
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const match = json.data?.find((m) => m.id === config.model) ?? json.data?.[0];
  if (!match) return undefined;

  const ctxRaw =
    match.max_model_len ??
    (match as { context_length?: number }).context_length ??
    (match as { context_window?: number }).context_window;

  return {
    id: typeof match.id === "string" ? match.id : config.model,
    maxContextTokens: typeof ctxRaw === "number" ? ctxRaw : null,
    ownedBy: typeof match.owned_by === "string" ? match.owned_by : null,
  };
}
