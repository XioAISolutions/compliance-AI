import { describe, it, expect } from "vitest";
import { inferMimeType, parseDocument } from "../parsers";

describe("inferMimeType", () => {
  it("uses provided mimeType when supported", () => {
    expect(inferMimeType("anything", "application/pdf")).toBe("application/pdf");
    expect(inferMimeType("anything", "text/plain")).toBe("text/plain");
  });

  it("infers from .pdf extension", () => {
    expect(inferMimeType("report.pdf")).toBe("application/pdf");
    expect(inferMimeType("REPORT.PDF")).toBe("application/pdf");
  });

  it("infers from .docx extension", () => {
    expect(inferMimeType("memo.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("infers from .doc extension (legacy Word)", () => {
    expect(inferMimeType("old.doc")).toBe("application/msword");
  });

  it("infers from .txt and .md extensions", () => {
    expect(inferMimeType("notes.txt")).toBe("text/plain");
    expect(inferMimeType("readme.md")).toBe("text/markdown");
    expect(inferMimeType("readme.markdown")).toBe("text/markdown");
  });

  it("returns null for unknown extensions", () => {
    expect(inferMimeType("file.xyz")).toBeNull();
    expect(inferMimeType("noextension")).toBeNull();
  });

  it("ignores unsupported provided mimeType and falls through to filename", () => {
    expect(inferMimeType("file.pdf", "application/unknown")).toBe("application/pdf");
  });
});

describe("parseDocument", () => {
  it("parses plain text", async () => {
    const bytes = Buffer.from("Hello, compliance world.", "utf-8");
    const result = await parseDocument(bytes, { filename: "hello.txt" });
    expect(result.text).toBe("Hello, compliance world.");
    expect(result.filename).toBe("hello.txt");
  });

  it("parses markdown as text", async () => {
    const bytes = Buffer.from("# Header\n\nParagraph.", "utf-8");
    const result = await parseDocument(bytes, { filename: "readme.md" });
    expect(result.text).toContain("# Header");
    expect(result.text).toContain("Paragraph");
  });

  it("preserves filename in result", async () => {
    const bytes = Buffer.from("content", "utf-8");
    const result = await parseDocument(bytes, { filename: "test.txt" });
    expect(result.filename).toBe("test.txt");
  });

  it("throws on unsupported format", async () => {
    const bytes = Buffer.from("whatever", "utf-8");
    await expect(parseDocument(bytes, { filename: "file.xyz" })).rejects.toThrow(
      /Unsupported document format/,
    );
  });

  it("accepts Uint8Array as well as Buffer", async () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const result = await parseDocument(bytes, { filename: "hello.txt" });
    expect(result.text).toBe("Hello");
  });

  it("infers format from provided mimeType when filename lacks extension", async () => {
    const bytes = Buffer.from("Some text", "utf-8");
    const result = await parseDocument(bytes, { mimeType: "text/plain" });
    expect(result.text).toBe("Some text");
  });
});
