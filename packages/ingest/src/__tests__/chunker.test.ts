import { describe, it, expect } from "vitest";
import { chunkDocument } from "../chunker";
import type { ParsedDocument } from "../types";

describe("chunkDocument", () => {
  it("returns empty array for empty text", () => {
    const doc: ParsedDocument = { text: "" };
    const chunks = chunkDocument(doc, "doc-1");
    expect(chunks).toEqual([]);
  });

  it("returns empty array for whitespace-only text", () => {
    const doc: ParsedDocument = { text: "   \n\n   \t  " };
    const chunks = chunkDocument(doc, "doc-1");
    expect(chunks).toEqual([]);
  });

  it("produces a single chunk for short documents", () => {
    const doc: ParsedDocument = { text: "A short offering memo." };
    const chunks = chunkDocument(doc, "doc-1");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.docId).toBe("doc-1");
    expect(chunks[0]!.ordinal).toBe(0);
    expect(chunks[0]!.content).toBe("A short offering memo.");
    expect(chunks[0]!.charStart).toBe(0);
    expect(chunks[0]!.charEnd).toBe(22);
    expect(chunks[0]!.tokenCount).toBeGreaterThan(0);
  });

  it("chunks a long document into multiple chunks with sequential ordinals", () => {
    const paragraph = "The entity shall maintain records for at least seven years. ";
    const text = paragraph.repeat(200); // ~12k chars
    const doc: ParsedDocument = { text };
    const chunks = chunkDocument(doc, "doc-1", {
      targetTokens: 100,
      overlapTokens: 20,
      charsPerToken: 4,
    });

    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.ordinal).toBe(i);
      expect(chunks[i]!.docId).toBe("doc-1");
    }
  });

  it("advances coverage across chunks (charEnd strictly increases)", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n\n" + "x ".repeat(500);
    const doc: ParsedDocument = { text };
    const chunks = chunkDocument(doc, "doc-1", {
      targetTokens: 50,
      overlapTokens: 10,
      charsPerToken: 4,
    });

    for (let i = 1; i < chunks.length; i++) {
      // charEnd must strictly increase so every chunk covers new ground.
      // charStart can be equal across two chunks when paragraph-boundary
      // trimming collapses leading whitespace.
      expect(chunks[i]!.charEnd).toBeGreaterThan(chunks[i - 1]!.charEnd);
      expect(chunks[i]!.charStart).toBeGreaterThanOrEqual(chunks[i - 1]!.charStart);
    }
  });

  it("prefers paragraph breaks over mid-sentence cuts", () => {
    const para1 = "First paragraph about risk factors in the offering. ".repeat(5);
    const para2 = "Second paragraph about use of proceeds. ".repeat(5);
    const text = `${para1}\n\n${para2}`;
    const doc: ParsedDocument = { text };
    const chunks = chunkDocument(doc, "doc-1", {
      targetTokens: Math.ceil(para1.length / 4) + 5, // just enough to fit para1
      overlapTokens: 5,
      charsPerToken: 4,
    });

    // First chunk should end around the paragraph boundary, not mid-sentence.
    const firstChunk = chunks[0]!;
    expect(firstChunk.content.trim().endsWith(".")).toBe(true);
  });

  it("attaches page numbers when the document has pages", () => {
    const doc: ParsedDocument = {
      text: "Page 1 content.\n\f\nPage 2 content.\n\f\nPage 3 content.",
      pages: [
        { pageNumber: 1, text: "Page 1 content." },
        { pageNumber: 2, text: "Page 2 content." },
        { pageNumber: 3, text: "Page 3 content." },
      ],
    };
    const chunks = chunkDocument(doc, "doc-1");
    expect(chunks).toHaveLength(3);
    expect(chunks[0]!.page).toBe(1);
    expect(chunks[1]!.page).toBe(2);
    expect(chunks[2]!.page).toBe(3);
  });

  it("generates unique chunk ids", () => {
    const text = "Some text. ".repeat(500);
    const doc: ParsedDocument = { text };
    const chunks = chunkDocument(doc, "doc-1", { targetTokens: 50 });

    const ids = chunks.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every chunk id starts with 'ch-'", () => {
    const doc: ParsedDocument = { text: "Hello world." };
    const chunks = chunkDocument(doc, "doc-1");
    expect(chunks[0]!.id).toMatch(/^ch-/);
  });

  it("tokenCount reflects content size", () => {
    const doc: ParsedDocument = { text: "A".repeat(400) };
    const chunks = chunkDocument(doc, "doc-1");
    expect(chunks[0]!.tokenCount).toBe(100); // 400 chars / 4 chars-per-token
  });

  it("applies overlap between chunks", () => {
    const text = "A. ".repeat(800); // 2400 chars
    const doc: ParsedDocument = { text };
    const chunks = chunkDocument(doc, "doc-1", {
      targetTokens: 100,
      overlapTokens: 25,
      charsPerToken: 4,
    });

    // With 100 tokens target * 4 chars = 400 char chunks, and 25*4=100 char overlap,
    // we expect ~8 chunks (2400 / 300 advance per chunk).
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.length).toBeLessThan(12);
  });

  it("makes progress on pathological input with no boundaries", () => {
    const text = "x".repeat(2000); // no spaces, no punctuation
    const doc: ParsedDocument = { text };
    const chunks = chunkDocument(doc, "doc-1", {
      targetTokens: 100,
      overlapTokens: 10,
      charsPerToken: 4,
    });

    expect(chunks.length).toBeGreaterThan(1);
    // No infinite loop
  });

  it("respects docId across all chunks", () => {
    const text = "Content. ".repeat(200);
    const doc: ParsedDocument = { text };
    const chunks = chunkDocument(doc, "my-custom-doc-id", { targetTokens: 50 });

    for (const chunk of chunks) {
      expect(chunk.docId).toBe("my-custom-doc-id");
    }
  });
});
