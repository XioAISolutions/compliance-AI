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

export interface ProviderPingResult {
  ok: boolean;
  provider: ModelProvider;
  model: string;
  baseUrl?: string;
  latencyMs: number;
  /** First ~120 chars of the model's response. Empty when the call errored. */
  sample: string;
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

  const ping = (async () => {
    for await (const ev of runAgent(PING_CONTEXT, [], options.prompt ?? PING_PROMPT_DEFAULT, {
      forcePersona: "drafter",
      provider: config.provider,
      model: config.model,
      maxTokens,
    })) {
      if (ev.type === "text-delta") sample += ev.delta;
      if (ev.type === "error") {
        errored = ev.message;
        break;
      }
      if (ev.type === "done") break;
      // Cap sample length even if the model ignores instructions.
      if (sample.length > 200) break;
    }
  })();

  let timedOut = false;
  await Promise.race([
    ping,
    new Promise<void>((resolve) =>
      setTimeout(() => {
        timedOut = true;
        resolve();
      }, timeoutMs),
    ),
  ]);

  const latencyMs = Date.now() - started;

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

  return {
    ok: sample.trim().length > 0,
    provider: config.provider,
    model: config.model,
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    latencyMs,
    sample: sample.slice(0, 120),
  };
}
