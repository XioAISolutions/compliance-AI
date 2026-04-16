import { describe, it, expect } from "vitest";
import { parseModelOutput, validateCitations, type Citation } from "../citations";

describe("parseModelOutput", () => {
  it("extracts citations from a fenced block", () => {
    const raw = `Here is the analysis [c1]. The rule requires disclosure [c2].

\`\`\`citations
[
  {"id": "c1", "authorityId": "ni-45-106", "section": "2.9(2)(a)", "quote": "the issuer must disclose", "docId": "doc-1", "chunkId": "chunk-1"},
  {"id": "c2", "authorityId": "osc-rule-45-501", "section": "5.2", "quote": "rights of action", "docId": "doc-2", "chunkId": "chunk-2"}
]
\`\`\``;

    const result = parseModelOutput(raw);

    expect(result.citations).toHaveLength(2);
    expect(result.citations[0]!.id).toBe("c1");
    expect(result.citations[0]!.authorityId).toBe("ni-45-106");
    expect(result.citations[1]!.id).toBe("c2");
    expect(result.prose).toContain("[c1]");
    expect(result.prose).not.toContain("```citations");
    expect(result.orphanedMarkers).toHaveLength(0);
    expect(result.unusedCitations).toHaveLength(0);
  });

  it("returns empty citations when no fence is present", () => {
    const raw = "Just plain text with no citations.";
    const result = parseModelOutput(raw);

    expect(result.citations).toHaveLength(0);
    expect(result.prose).toBe("Just plain text with no citations.");
  });

  it("handles malformed JSON in the fence gracefully", () => {
    const raw = `Some text [c1].

\`\`\`citations
this is not valid json
\`\`\``;

    const result = parseModelOutput(raw);

    expect(result.citations).toHaveLength(0);
    expect(result.orphanedMarkers).toEqual(["c1"]);
  });

  it("detects orphaned markers (referenced in prose but missing from array)", () => {
    const raw = `See [c1] and [c3].

\`\`\`citations
[
  {"id": "c1", "authorityId": "ni-45-106", "section": "2.9", "quote": "test", "docId": "d1", "chunkId": "ch1"}
]
\`\`\``;

    const result = parseModelOutput(raw);

    expect(result.orphanedMarkers).toEqual(["c3"]);
    expect(result.unusedCitations).toHaveLength(0);
  });

  it("detects unused citations (in array but not referenced in prose)", () => {
    const raw = `Only [c1] is used.

\`\`\`citations
[
  {"id": "c1", "authorityId": "ni-45-106", "section": "2.9", "quote": "test", "docId": "d1", "chunkId": "ch1"},
  {"id": "c2", "authorityId": "osc-45-501", "section": "5.2", "quote": "unused", "docId": "d2", "chunkId": "ch2"}
]
\`\`\``;

    const result = parseModelOutput(raw);

    expect(result.unusedCitations).toEqual(["c2"]);
  });

  it("filters out invalid citation objects from the array", () => {
    const raw = `Text [c1].

\`\`\`citations
[
  {"id": "c1", "authorityId": "ni-45-106", "section": "2.9", "quote": "test", "docId": "d1", "chunkId": "ch1"},
  {"id": "c2", "missingFields": true},
  "not an object",
  null
]
\`\`\``;

    const result = parseModelOutput(raw);

    expect(result.citations).toHaveLength(1);
    expect(result.citations[0]!.id).toBe("c1");
  });

  it("handles page numbers in citations", () => {
    const raw = `See [c1].

\`\`\`citations
[
  {"id": "c1", "authorityId": "ni-45-106", "section": "2.9", "quote": "test", "docId": "d1", "chunkId": "ch1", "page": 42}
]
\`\`\``;

    const result = parseModelOutput(raw);
    expect(result.citations[0]!.page).toBe(42);
  });
});

describe("validateCitations", () => {
  const citations: Citation[] = [
    { id: "c1", authorityId: "ni-45-106", section: "2.9", quote: "test", docId: "d1", chunkId: "ch1" },
    { id: "c2", authorityId: "osc-45-501", section: "5.2", quote: "test", docId: "d2", chunkId: "ch-unknown" },
    { id: "c3", authorityId: "ni-31-103", section: "13.2", quote: "test", docId: "d3", chunkId: "ch3" },
  ];

  it("keeps citations with known chunk IDs and drops unknown ones", () => {
    const knownChunks = new Set(["ch1", "ch3"]);
    const result = validateCitations(citations, knownChunks);

    expect(result.valid).toHaveLength(2);
    expect(result.valid.map((c) => c.id)).toEqual(["c1", "c3"]);
    expect(result.dropped).toHaveLength(1);
    expect(result.dropped[0]!.id).toBe("c2");
  });

  it("drops all citations when no chunks are known", () => {
    const result = validateCitations(citations, new Set());

    expect(result.valid).toHaveLength(0);
    expect(result.dropped).toHaveLength(3);
  });

  it("keeps all citations when all chunks are known", () => {
    const knownChunks = new Set(["ch1", "ch-unknown", "ch3"]);
    const result = validateCitations(citations, knownChunks);

    expect(result.valid).toHaveLength(3);
    expect(result.dropped).toHaveLength(0);
  });
});
