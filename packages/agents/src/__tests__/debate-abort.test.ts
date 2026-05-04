import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runDebate } from "../debate";
import type { AgentContext } from "../types";

const ORIGINAL_FETCH = globalThis.fetch;
const ENV_KEYS = ["LLM_PROVIDER", "AMD_VLLM_BASE_URL", "AMD_VLLM_MODEL"] as const;

const CTX: AgentContext = {
  control: null,
  frameworkScope: [],
  organizationId: "org-test",
};

describe("runDebate timeout abort", () => {
  beforeEach(() => {
    process.env.LLM_PROVIDER = "amd_vllm";
    process.env.AMD_VLLM_BASE_URL = "http://10.0.0.5:8000/v1";
    process.env.AMD_VLLM_MODEL = "Qwen/Qwen2.5-72B-Instruct";
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("aborts the underlying fetch when a voice times out", async () => {
    let capturedSignal: AbortSignal | undefined;
    let resolveAbort!: () => void;
    const aborted = new Promise<void>((resolve) => {
      resolveAbort = resolve;
    });

    globalThis.fetch = vi.fn(async (_url, init) => {
      capturedSignal = (init as RequestInit | undefined)?.signal ?? undefined;
      return await new Promise<Response>((_resolve, reject) => {
        capturedSignal?.addEventListener(
          "abort",
          () => {
            resolveAbort();
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });
    }) as unknown as typeof fetch;

    const result = await runDebate(
      [{ name: "Hung voice", systemPromptOverride: "You are intentionally slow." }],
      CTX,
      "hang forever",
      { provider: "amd_vllm", timeoutMs: 25 },
    );

    await aborted;
    expect(result.voices[0]?.status).toBe("timeout");
    expect(capturedSignal?.aborted).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
