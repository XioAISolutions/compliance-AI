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
});
