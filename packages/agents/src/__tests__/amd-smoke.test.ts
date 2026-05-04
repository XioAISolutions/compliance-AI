/**
 * AMD vLLM smoke test.
 *
 * Hits the live endpoint when AMD_VLLM_BASE_URL is set in the env, otherwise
 * skips. Designed for the hackathon demo: run `AMD_VLLM_BASE_URL=... pnpm test`
 * locally to prove the GPU side is wired before flipping LLM_PROVIDER on.
 *
 * This test is intentionally tolerant: it only requires the endpoint to
 * stream non-empty text within 60s. Model-quality assertions belong elsewhere.
 */

import { describe, expect, it } from "vitest";
import { pingProvider } from "../health";

const baseUrl = process.env.AMD_VLLM_BASE_URL;

describe.skipIf(!baseUrl)("AMD vLLM live smoke", () => {
  it("responds to a ping within 60s with a non-empty sample", async () => {
    const result = await pingProvider({
      provider: "amd_vllm",
      timeoutMs: 60_000,
      maxTokens: 32,
    });

    expect(result.provider).toBe("amd_vllm");
    expect(result.baseUrl).toMatch(/^https?:\/\//);
    expect(result.ok, `Ping failed: ${result.error ?? "unknown"}`).toBe(true);
    expect(result.sample.length).toBeGreaterThan(0);
    // 60s ceiling — vLLM cold-start on a quiet droplet can take ~20s.
    expect(result.latencyMs).toBeLessThan(60_000);
  }, 70_000);
});

describe.skipIf(baseUrl)("AMD vLLM live smoke", () => {
  it("is skipped when AMD_VLLM_BASE_URL is unset", () => {
    expect(true).toBe(true);
  });
});
