import { describe, it, expect } from "vitest";
import { parseDocumentFromBuffer, pageForOffset } from "../pdf";

describe("pageForOffset", () => {
  it("returns 1 when pageOffsets is empty", () => {
    expect(pageForOffset([], 0)).toBe(1);
    expect(pageForOffset([], 1_000)).toBe(1);
  });

  it("returns the page that covers the given character offset", () => {
    const offsets = [0, 500, 1000, 1500];
    expect(pageForOffset(offsets, 0)).toBe(1);
    expect(pageForOffset(offsets, 499)).toBe(1);
    expect(pageForOffset(offsets, 500)).toBe(2);
    expect(pageForOffset(offsets, 999)).toBe(2);
    expect(pageForOffset(offsets, 1000)).toBe(3);
    expect(pageForOffset(offsets, 1_200)).toBe(3);
    expect(pageForOffset(offsets, 1_500)).toBe(4);
    expect(pageForOffset(offsets, 99_999)).toBe(4);
  });
});

describe("parseDocumentFromBuffer (text fallback)", () => {
  it("handles a UTF-8 text buffer as a single-page document", async () => {
    const text = "Hello compliance world. This is a short OM.";
    const parsed = await parseDocumentFromBuffer(Buffer.from(text, "utf8"), "note.txt");
    expect(parsed.text).toBe(text);
    expect(parsed.pageOffsets).toEqual([0]);
    expect(parsed.firstPagePreview).toContain("Hello");
    expect(parsed.meta.filename).toBe("note.txt");
    expect(parsed.meta.bytes).toBe(Buffer.byteLength(text));
    expect(parsed.meta.extension).toBe("txt");
  });

  it("routes PDF-like buffers through the PDF parser and falls back on failure", async () => {
    // Not a real PDF — pdf-parse will throw, we fall back to text path.
    const fake = Buffer.from("%PDF-1.4 fake contents that are not a valid pdf", "utf8");
    const parsed = await parseDocumentFromBuffer(fake, "fake.pdf");
    expect(parsed.text.length).toBeGreaterThan(0);
    expect(parsed.meta.extension).toBe("pdf");
  });

  it("preserves the filename extension in the meta block when present", async () => {
    const parsed = await parseDocumentFromBuffer(Buffer.from("x"), "report.docx");
    expect(parsed.meta.extension).toBe("docx");
  });
});
