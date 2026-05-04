import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const ORIGINAL_FETCH = globalThis.fetch;
const ENV_KEYS = ["LLM_PROVIDER", "AMD_VLLM_BASE_URL", "AMD_VLLM_MODEL"] as const;

function completionStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = [
    `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
    `data: ${JSON.stringify({
      choices: [],
      usage: { prompt_tokens: 10, completion_tokens: 2 },
    })}\n\n`,
    "data: [DONE]\n\n",
  ].join("");
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

async function readSseEvents(res: Response): Promise<Array<Record<string, unknown>>> {
  const text = await res.text();
  return text
    .split(/\r?\n\r?\n/)
    .flatMap((frame) => frame.split(/\r?\n/))
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5).trim()) as Record<string, unknown>);
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/debate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/debate", () => {
  beforeEach(() => {
    process.env.LLM_PROVIDER = "amd_vllm";
    process.env.AMD_VLLM_BASE_URL = "http://internal-gpu.example:8000/v1";
    process.env.AMD_VLLM_MODEL = "Qwen/Qwen2.5-72B-Instruct";
    globalThis.fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse(String((init as RequestInit | undefined)?.body ?? "{}")) as {
        messages?: Array<{ role: string; content: string }>;
      };
      const system = body.messages?.find((m) => m.role === "system")?.content ?? "";
      const isSynthesis = system.includes("You are a precise editor");
      const content = isSynthesis
        ? '```json\n{"agreed":["shared point"],"disagreed":["split point"],"verdict":"ship it"}\n```'
        : "voice reply";
      return new Response(completionStream(content), {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
    vi.restoreAllMocks();
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it("streams the full debate SSE contract in UI order", async () => {
    const res = await POST(
      postRequest({
        userMessage: "review this",
        retrieveAuthorities: false,
        voices: [
          { name: "A", systemPromptOverride: "Voice A" },
          { name: "B", systemPromptOverride: "Voice B" },
        ],
      }) as never,
    );

    expect(res.status).toBe(200);
    const events = await readSseEvents(res);
    const types = events.map((event) => event.type);

    expect(events[0]).toMatchObject({
      type: "debate-started",
      provider: "amd_vllm",
      model: "Qwen/Qwen2.5-72B-Instruct",
      voiceCount: 2,
      retrievedSnippets: 0,
    });
    expect(events[0]?.baseUrl).toBeUndefined();

    const synthesisIndex = types.indexOf("synthesis");
    const doneIndex = types.indexOf("debate-done");
    expect(synthesisIndex).toBeGreaterThan(0);
    expect(doneIndex).toBe(synthesisIndex + 1);
    expect(types.filter((type) => type === "voice-started")).toHaveLength(2);
    expect(types.filter((type) => type === "voice-delta")).toHaveLength(2);
    expect(types.filter((type) => type === "voice-completed")).toHaveLength(2);
    expect(types.lastIndexOf("voice-started")).toBeLessThan(types.indexOf("voice-delta"));
    expect(types.lastIndexOf("voice-completed")).toBeLessThan(synthesisIndex);
    expect(types).toContain("synthesis");
    expect(types.at(-1)).toBe("debate-done");
  });

  it("rejects excessive voice fan-out before starting model work", async () => {
    const res = await POST(
      postRequest({
        userMessage: "review this",
        voices: Array.from({ length: 7 }, (_, i) => ({
          name: `Voice ${i + 1}`,
          systemPromptOverride: "Review briefly.",
        })),
      }) as never,
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: /Too many voices/ });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
