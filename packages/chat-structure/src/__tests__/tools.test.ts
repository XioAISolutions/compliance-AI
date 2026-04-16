import { describe, it, expect } from "vitest";
import { parseToolCalls, TOOL_INSTRUCTION } from "../tools";

describe("parseToolCalls", () => {
  it("parses a single cite_authority tool call", () => {
    const raw = `Here's a fact${" "}{{tool:cite_authority {"id":"c1","authorityId":"ni-45-106","section":"2.9","quote":"foo","docId":"d","chunkId":"k"}}} end.`;
    const result = parseToolCalls(raw);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0]!.tool).toBe("cite_authority");
    expect(result.toolCalls[0]!.args).toMatchObject({
      id: "c1",
      authorityId: "ni-45-106",
    });
  });

  it("redacts tool-call blocks from prose", () => {
    const raw = `Paragraph one.\n\n{{tool:flag_gap {"severity":"high","title":"Missing"}}}\n\nParagraph two.`;
    const result = parseToolCalls(raw);
    expect(result.redactedText).not.toContain("{{tool:");
    expect(result.redactedText).toContain("Paragraph one.");
    expect(result.redactedText).toContain("Paragraph two.");
  });

  it("parses multiple tool calls in order", () => {
    const raw = [
      `{{tool:flag_gap {"severity":"high","title":"Rights of action missing"}}}`,
      `{{tool:request_review {"section":"Risk factors","reason":"thin"}}}`,
      `{{tool:hand_off {"to":"risk-assessor","reason":"exposure"}}}`,
    ].join("\n");
    const result = parseToolCalls(raw);
    expect(result.toolCalls.map((tc) => tc.tool)).toEqual([
      "flag_gap",
      "request_review",
      "hand_off",
    ]);
  });

  it("flags unparseable tool blocks but keeps parsing the rest", () => {
    const raw = `{{tool:flag_gap not-json-at-all}}\n{{tool:cite_authority {"id":"c1","authorityId":"a","section":"b","quote":"q","docId":"d","chunkId":"k"}}}`;
    const result = parseToolCalls(raw);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.unparseable).toHaveLength(1);
  });

  it("ignores unknown tool names", () => {
    const raw = `{{tool:summon_dragon {"name":"Smaug"}}}`;
    const result = parseToolCalls(raw);
    expect(result.toolCalls).toHaveLength(0);
    expect(result.unparseable).toContain(raw);
  });

  it("returns empty structures when the input has no tool blocks", () => {
    const result = parseToolCalls("No tools here, just prose.");
    expect(result.toolCalls).toEqual([]);
    expect(result.unparseable).toEqual([]);
    expect(result.redactedText).toBe("No tools here, just prose.");
  });
});

describe("TOOL_INSTRUCTION", () => {
  it("describes all four tool names", () => {
    expect(TOOL_INSTRUCTION).toContain("cite_authority");
    expect(TOOL_INSTRUCTION).toContain("flag_gap");
    expect(TOOL_INSTRUCTION).toContain("request_review");
    expect(TOOL_INSTRUCTION).toContain("hand_off");
  });
});
