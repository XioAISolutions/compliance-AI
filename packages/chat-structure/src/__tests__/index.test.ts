import { describe, expect, it } from "vitest";
import { AGENT_REGISTRY, MAX_AGENT_HOPS, parseToolCalls, toJsonl } from "../index";

describe("@compliance-ai/chat-structure", () => {
  it("exposes a bounded registry for both demo surfaces", () => {
    expect(MAX_AGENT_HOPS).toBe(4);
    expect(AGENT_REGISTRY.some((agent) => agent.surface === "securities")).toBe(true);
    expect(AGENT_REGISTRY.some((agent) => agent.surface === "infosec")).toBe(true);
  });

  it("parses inline tool calls", () => {
    const result = parseToolCalls(
      `Draft ready. {{tool:cite_authority {"id":"c1","authorityId":"ni-45-106","section":"2.9","quote":"foo","docId":"d1","chunkId":"k1"}}} {{tool:hand_off {"to":"judge","reason":"Need approval"}}}`,
    );

    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0]!.tool).toBe("cite_authority");
    expect(result.toolCalls[1]!.tool).toBe("hand_off");
  });

  it("renders transcript events as JSONL", () => {
    const jsonl = toJsonl([
      {
        id: "e1",
        matterId: "m1",
        type: "audit",
        actor: "system",
        action: "upload",
        content: "Uploaded document",
        createdAt: "2026-04-16T00:00:00.000Z",
      },
    ]);

    expect(jsonl.split("\n")).toHaveLength(1);
    expect(JSON.parse(jsonl).action).toBe("upload");
  });
});
