/**
 * Provider waterfall for ambient consolidation work.
 *
 * IMPORTANT: this is API-key based only. The original task asked for
 * an OAuth waterfall preferring Claude Max / ChatGPT Pro consumer
 * subscriptions. Those products do not expose a sanctioned API path
 * for programmatic use, so we don't ship that here. See MIGRATION.md.
 *
 * The cascade is cheapest-first to minimize ambient spend:
 *   1. Local Ollama (free, model picked from OLLAMA_MODEL).
 *   2. Anthropic Haiku (api key + cheapest tier).
 *   3. OpenAI gpt-4o-mini.
 *
 * The selector returns the highest-priority candidate that has the
 * env var set; the caller is responsible for handling actual API
 * errors and re-asking for the next candidate. This keeps the
 * provider layer dependency-free and easy to unit-test.
 */

export type AmbientProviderId = "ollama" | "anthropic-haiku" | "openai-mini";

export interface AmbientProvider {
  id: AmbientProviderId;
  /** Cost-per-1k-input-token estimate (USD) for budget bookkeeping. */
  costPer1kTokens: number;
  /** Whether this provider is currently configured (env var present). */
  available(): boolean;
  /** Endpoint metadata — caller dispatches the actual request. */
  endpoint(): { url: string; model: string; headers: Record<string, string> };
}

class OllamaProvider implements AmbientProvider {
  id = "ollama" as const;
  costPer1kTokens = 0;
  available(): boolean {
    return Boolean(typeof process !== "undefined" && process.env.OLLAMA_BASE_URL);
  }
  endpoint() {
    const base = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
    const model = process.env.OLLAMA_MODEL ?? "llama3.1:8b";
    return {
      url: `${base.replace(/\/$/, "")}/api/generate`,
      model,
      headers: { "Content-Type": "application/json" },
    };
  }
}

class AnthropicHaikuProvider implements AmbientProvider {
  id = "anthropic-haiku" as const;
  costPer1kTokens = 0.0008;
  available(): boolean {
    return Boolean(typeof process !== "undefined" && process.env.ANTHROPIC_API_KEY);
  }
  endpoint() {
    return {
      url: "https://api.anthropic.com/v1/messages",
      model: "claude-haiku-4-5-20251001",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
    };
  }
}

class OpenAIMiniProvider implements AmbientProvider {
  id = "openai-mini" as const;
  costPer1kTokens = 0.00015;
  available(): boolean {
    return Boolean(typeof process !== "undefined" && process.env.OPENAI_API_KEY);
  }
  endpoint() {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
      },
    };
  }
}

const ORDER: AmbientProvider[] = [
  new OllamaProvider(),
  new AnthropicHaikuProvider(),
  new OpenAIMiniProvider(),
];

/**
 * Pick the first available provider in priority order. Returns null
 * when nothing is configured — the caller should bail out and let the
 * scheduler push the wake back into the queue.
 */
export function pickAmbientProvider(): AmbientProvider | null {
  for (const p of ORDER) {
    if (p.available()) return p;
  }
  return null;
}

/** For tests and audit logs. */
export function listAmbientProviders(): AmbientProviderId[] {
  return ORDER.map((p) => p.id);
}
