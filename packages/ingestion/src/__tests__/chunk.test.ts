import { describe, it, expect } from "vitest";
import { chunkDocument } from "../chunk";
import type { ParsedDocument } from "../types";

function doc(text: string, pageOffsets: number[] = [0]): ParsedDocument {
  return {
    text,
    pageOffsets,
    firstPagePreview: text.slice(0, 1500),
    meta: { filename: "t.pdf", bytes: text.length, extension: "pdf" },
  };
}

describe("chunkDocument", () => {
  it("returns no chunks for empty input", () => {
    const chunks = chunkDocument(doc(""), "d1");
    expect(chunks).toEqual([]);
  });

  it("packs small input into a single chunk", () => {
    const chunks = chunkDocument(doc("Tiny sample text."), "d1");
    expect(chunks).toHaveLength(1);
    expect(chunks[0]!.content).toBe("Tiny sample text.");
    expect(chunks[0]!.index).toBe(0);
    expect(chunks[0]!.docId).toBe("d1");
  });

  it("splits paragraph-separated content into multiple chunks when over target", () => {
    const big = Array.from({ length: 12 })
      .map(
        (_, i) =>
          `Paragraph ${i + 1}: ${"lorem ipsum dolor sit amet consectetur adipiscing elit ".repeat(20)}`,
      )
      .join("\n\n");
    const chunks = chunkDocument(doc(big), "d1", { targetChars: 800, minChars: 100 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const c of chunks) {
      expect(c.docId).toBe("d1");
      expect(c.content.trim().length).toBeGreaterThan(0);
    }
    // Index is monotonically increasing from 0.
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i]!.index).toBe(i);
    }
  });

  it("assigns page numbers based on pageOffsets", () => {
    const text = `Page one content here.\n\nPage two content here.\n\nPage three content here.`;
    // Pretend each paragraph starts a new page.
    const pageOffsets = [0, text.indexOf("Page two"), text.indexOf("Page three")];
    const chunks = chunkDocument(doc(text, pageOffsets), "d1", {
      targetChars: 20,
      minChars: 5,
      overlapChars: 0,
    });
    // First chunk should land on page 1; last chunk should reach page 2 or 3
    // depending on exactly where the packer flushed.
    expect(chunks[0]!.page).toBe(1);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[chunks.length - 1]!.page).toBeGreaterThanOrEqual(2);
  });

  it("splits a single oversized paragraph on sentence boundaries", () => {
    const oneBigParagraph =
      Array.from({ length: 40 })
        .map((_, i) => `Sentence number ${i + 1} with enough filler words to be substantive.`)
        .join(" ");
    const chunks = chunkDocument(doc(oneBigParagraph), "d1", {
      targetChars: 400,
      minChars: 100,
    });
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("maintains overlap between adjacent chunks", () => {
    const paragraphs = Array.from({ length: 8 }).map(
      (_, i) => `Paragraph ${i + 1}. ` + "filler ".repeat(60),
    );
    const text = paragraphs.join("\n\n");
    const chunks = chunkDocument(doc(text), "d1", {
      targetChars: 500,
      minChars: 100,
      overlapChars: 100,
    });
    if (chunks.length >= 2) {
      const tail = chunks[0]!.content.slice(-50);
      // Some prefix of chunk[0]'s tail should reappear inside chunk[1].
      expect(chunks[1]!.content).toContain(tail.slice(-20));
    }
  });

  it("assigns a UUID-shaped id to every chunk", () => {
    const chunks = chunkDocument(doc("A. B. C. D."), "d1");
    for (const c of chunks) {
      expect(c.id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
