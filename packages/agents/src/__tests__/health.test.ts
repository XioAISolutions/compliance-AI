/**
 * pingProvider tests.
 *
 * Mocks runAgent (for the streaming completion) and global fetch (for the
 * /v1/models lookup) so we test the pingProvider plumbing — token-rate
 * computation, model-info best-effort fetch, error/timeout handling — without
 * hitting an LLM or a network.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../run.js", async () => {
  const actual = await vi.importActual<typeof import("../run.js")>("../run.js");

  // The mock adapts behaviour based on the prompt. Tests pass a `prompt` to
  // pingProvider that smuggles a behaviour tag (e.g. "__ping_5_tokens__") so
  // each test can drive a deterministic outcome.
  async function* mockRunAgent(_ctx: unknown, _hist: unknown, prompt: string) {
    if (prompt.includes("__ping_error__")) {
      yield { type: "error", message: "mock provider down" };
      return;
    }
    if (prompt.includes("__ping_hang__")) {
      // Sleep longer than the test's timeoutMs so the timeout branch fires.
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      return;
    }
    const tokenMatch = prompt.match(/__ping_(\d+)_tokens__/);
    const outputTokens = tokenMatch ? Number(tokenMatch[1]) : 2;
    yield { type: "text-delta", delta: "ready" };
    // Small async pause so the elapsed time is measurable. Without this the
    // entire ping completes inside one event-loop tick, latencyMs lands at 0,
    // and tokensPerSec ends up undefined (which is correct production
    // behaviour for the divide-by-zero guard but defeats the point of
    // testing the happy-path computation).
    await new Promise((resolve) => setTimeout(resolve, 5));
    yield {
      type: "done",
      usage: { inputTokens: 12, outputTokens, cacheReadTokens: 0 },
    };
  }

  return { ...actual, runAgent: mockRunAgent };
});

import { pingProvider } from "../health";

const ORIGINAL_FETCH = globalThis.fetch;

beforeEach(() => {
  // Default: every test gets a clean fetch mock that returns a plausible
  // /v1/models response with the requested model. Individual tests can
  // override this when they want to exercise the failure branches.
  globalThis.fetch = vi.fn(async (_url) => ({
    ok: true,
    json: async () => ({
      data: [
        {
          id: "Qwen/Qwen2.5-72B-Instruct",
          owned_by: "vllm",
          max_model_len: 32768,
        },
      ],
    }),
  })) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.clearAllMocks();
  for (const key of [
    "LLM_PROVIDER",
    "AMD_VLLM_BASE_URL",
    "AMD_VLLM_MODEL",
    "AMD_VLLM_API_KEY",
    "OPENAI_API_KEY",
    "OPENAI_BASE_URL",
    "OPENAI_MODEL",
    "OLLAMA_BASE_URL",
    "OLLAMA_MODEL",
    "ANTHROPIC_API_KEY",
  ]) {
    delete process.env[key];
  }
});

describe("pingProvider", () => {
  it("returns ok=true with a sample, latency, and tokensPerSec", async () => {
    process.env.LLM_PROVIDER = "amd_vllm";
    process.env.AMD_VLLM_BASE_URL = "http://10.0.0.5:8000";
    const result = await pingProvider({
      prompt: "Hello __ping_50_tokens__",
      maxTokens: 64,
    });
    expect(result.ok).toBe(true);
    expect(result.provider).toBe("amd_vllm");
    expect(result.sample).toBe("ready");
    expect(result.outputTokens).toBe(50);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    // tokensPerSec should be a reasonable round number (50 tokens / latency in seconds).
    expect(result.tokensPerSec).toBeGreaterThan(0);
  });

  it("populates modelInfo with maxContextTokens from /v1/models", async () => {
    process.env.LLM_PROVIDER = "amd_vllm";
    process.env.AMD_VLLM_BASE_URL = "http://10.0.0.5:8000/v1";
    const result = await pingProvider();
    expect(result.modelInfo).toBeDefined();
    expect(result.modelInfo?.id).toBe("Qwen/Qwen2.5-72B-Instruct");
    expect(result.modelInfo?.maxContextTokens).toBe(32768);
    expect(result.modelInfo?.ownedBy).toBe("vllm");
  });

  it("reports ok=false and error message when the model errors mid-ping", async () => {
    process.env.LLM_PROVIDER = "amd_vllm";
    process.env.AMD_VLLM_BASE_URL = "http://10.0.0.5:8000";
    const result = await pingProvider({ prompt: "broken __ping_error__" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("mock provider down");
    expect(result.tokensPerSec).toBeUndefined();
  });

  it("reports ok=false on timeout when the provider doesn't respond", async () => {
    process.env.LLM_PROVIDER = "amd_vllm";
    process.env.AMD_VLLM_BASE_URL = "http://10.0.0.5:8000";
    const result = await pingProvider({
      prompt: "stalled __ping_hang__",
      timeoutMs: 50,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/did not respond within/);
  });

  it("treats /v1/models failure as best-effort (modelInfo undefined)", async () => {
    process.env.LLM_PROVIDER = "amd_vllm";
    process.env.AMD_VLLM_BASE_URL = "http://10.0.0.5:8000";
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const result = await pingProvider();
    expect(result.ok).toBe(true); // ping still succeeds
    expect(result.modelInfo).toBeUndefined(); // model info simply missing
  });

  it("skips /v1/models entirely on the anthropic provider", async () => {
    // Anthropic doesn't go through the OpenAI-compatible path so /v1/models
    // shouldn't even be called. We assert the fetch mock was never invoked.
    process.env.LLM_PROVIDER = "anthropic";
    process.env.ANTHROPIC_API_KEY = "sk-ant-mock";
    const fetchSpy = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const result = await pingProvider();
    expect(result.provider).toBe("anthropic");
    expect(result.modelInfo).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to first model when /v1/models doesn't list our exact id", async () => {
    process.env.LLM_PROVIDER = "amd_vllm";
    process.env.AMD_VLLM_BASE_URL = "http://10.0.0.5:8000";
    process.env.AMD_VLLM_MODEL = "some-unlisted-model";
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [{ id: "different-model", owned_by: "vllm", max_model_len: 8192 }],
      }),
    })) as unknown as typeof fetch;
    const result = await pingProvider();
    // Falls back to data[0] when the configured model id isn't found.
    expect(result.modelInfo?.id).toBe("different-model");
    expect(result.modelInfo?.maxContextTokens).toBe(8192);
  });
});
