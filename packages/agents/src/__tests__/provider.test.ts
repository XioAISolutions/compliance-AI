import { describe, expect, it } from "vitest";
import { resolveModelProvider } from "../run";

describe("resolveModelProvider", () => {
  it("honors an explicit OpenAI provider and model", () => {
    expect(
      resolveModelProvider({
        LLM_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-test",
        OPENAI_MODEL: "gpt-5.4",
      }),
    ).toEqual({
      provider: "openai",
      model: "gpt-5.4",
      baseUrl: "https://api.openai.com/v1",
    });
  });

  it("auto-selects OpenAI when an OpenAI key is present", () => {
    expect(resolveModelProvider({ OPENAI_API_KEY: "sk-test" }).provider).toBe("openai");
  });

  it("keeps Anthropic deployments working when only ANTHROPIC_API_KEY is set", () => {
    const provider = resolveModelProvider({ ANTHROPIC_API_KEY: "sk-ant-test" });

    expect(provider.provider).toBe("anthropic");
    expect(provider.model).toBe("claude-sonnet-4-6");
  });

  it("falls back to local Ollama with an OpenAI-compatible base URL", () => {
    expect(resolveModelProvider({ OLLAMA_BASE_URL: "http://127.0.0.1:11434/" })).toEqual({
      provider: "ollama",
      model: "llama3.1:8b",
      baseUrl: "http://127.0.0.1:11434/v1",
    });
  });

  it("rejects unsupported provider names early", () => {
    expect(() => resolveModelProvider({ LLM_PROVIDER: "octopus" })).toThrow(
      /Unsupported LLM_PROVIDER/,
    );
  });

  it("honors an explicit AMD vLLM provider with custom base URL and model", () => {
    expect(
      resolveModelProvider({
        LLM_PROVIDER: "amd_vllm",
        AMD_VLLM_BASE_URL: "http://10.0.0.5:8000",
        AMD_VLLM_MODEL: "Qwen/Qwen2.5-72B-Instruct",
      }),
    ).toEqual({
      provider: "amd_vllm",
      model: "Qwen/Qwen2.5-72B-Instruct",
      baseUrl: "http://10.0.0.5:8000/v1",
    });
  });

  it("preserves an AMD vLLM base URL that already includes /v1", () => {
    expect(
      resolveModelProvider({
        LLM_PROVIDER: "amd_vllm",
        AMD_VLLM_BASE_URL: "http://10.0.0.5:8000/v1/",
      }).baseUrl,
    ).toBe("http://10.0.0.5:8000/v1");
  });

  it("defaults the AMD vLLM model to Qwen 2.5 72B when AMD_VLLM_MODEL is unset", () => {
    expect(
      resolveModelProvider({
        LLM_PROVIDER: "amd_vllm",
        AMD_VLLM_BASE_URL: "http://10.0.0.5:8000",
      }).model,
    ).toBe("Qwen/Qwen2.5-72B-Instruct");
  });

  it("auto-selects amd_vllm when AMD_VLLM_BASE_URL is set without LLM_PROVIDER", () => {
    expect(resolveModelProvider({ AMD_VLLM_BASE_URL: "http://10.0.0.5:8000" }).provider).toBe(
      "amd_vllm",
    );
  });

  it("prefers AMD_VLLM_BASE_URL over OPENAI_API_KEY in auto-detect", () => {
    // Explicit endpoint trumps a stale OpenAI key sitting in the env.
    expect(
      resolveModelProvider({
        AMD_VLLM_BASE_URL: "http://10.0.0.5:8000",
        OPENAI_API_KEY: "sk-test",
      }).provider,
    ).toBe("amd_vllm");
  });

  it("throws a clear error if amd_vllm is selected without AMD_VLLM_BASE_URL", () => {
    expect(() => resolveModelProvider({ LLM_PROVIDER: "amd_vllm" })).toThrow(
      /AMD_VLLM_BASE_URL is not set/,
    );
  });
});
