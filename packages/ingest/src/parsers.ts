/**
 * File parsers — raw bytes to ParsedDocument.
 *
 * Supports PDF (via pdf-parse), DOCX (via mammoth), and plain text.
 * Each parser returns the same ParsedDocument shape so the downstream
 * chunker doesn't care about source format.
 *
 * Parsers are dynamically imported so the library bundle stays small for
 * routes that don't actually parse files.
 */

import type { ParsedDocument, ParsedPage } from "./types.js";

export type SupportedMimeType =
  | "application/pdf"
  | "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  | "application/msword"
  | "text/plain"
  | "text/markdown";

export function inferMimeType(filename: string, providedMimeType?: string): SupportedMimeType | null {
  if (providedMimeType) {
    if (providedMimeType === "application/pdf") return "application/pdf";
    if (
      providedMimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (providedMimeType === "application/msword") return "application/msword";
    if (providedMimeType === "text/plain") return "text/plain";
    if (providedMimeType === "text/markdown") return "text/markdown";
  }

  const ext = filename.toLowerCase().match(/\.([^.]+)$/)?.[1];
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "txt":
      return "text/plain";
    case "md":
    case "markdown":
      return "text/markdown";
    default:
      return null;
  }
}

export interface ParseOptions {
  filename?: string;
  mimeType?: string;
}

/**
 * Parse raw file bytes into a ParsedDocument. Dispatches on MIME type /
 * extension. Throws if the format is unsupported.
 */
export async function parseDocument(
  bytes: Uint8Array | Buffer,
  options: ParseOptions = {},
): Promise<ParsedDocument> {
  const mime = inferMimeType(options.filename ?? "", options.mimeType);
  if (!mime) {
    throw new Error(
      `Unsupported document format. Supply a filename with .pdf/.docx/.doc/.txt/.md or a known mimeType.`,
    );
  }

  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);

  switch (mime) {
    case "application/pdf":
      return parsePdf(buffer, options.filename);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    case "application/msword":
      return parseDocx(buffer, options.filename);
    case "text/plain":
    case "text/markdown":
      return parseText(buffer, options.filename);
  }
}

async function parsePdf(buffer: Buffer, filename?: string): Promise<ParsedDocument> {
  const mod = await import("pdf-parse");
  // pdf-parse default export differs between CJS and ESM interop.
  const pdfParse = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const fn = (pdfParse as unknown as (b: Buffer) => Promise<{ text: string; info?: Record<string, unknown>; numpages?: number }>);
  const result = await fn(buffer);

  // pdf-parse returns the full text. Pages are separated by form-feed (\f)
  // in its output, but that's not guaranteed — split defensively.
  const rawText = result.text ?? "";
  const pageTexts = rawText.split(/\f/).map((p) => p.trim()).filter((p) => p.length > 0);

  const pages: ParsedPage[] = pageTexts.map((text, i) => ({
    pageNumber: i + 1,
    text,
  }));

  // If we didn't get any form-feeds (single-page PDF or stripped), fall back
  // to treating the whole text as page 1.
  if (pages.length === 0 && rawText.trim().length > 0) {
    pages.push({ pageNumber: 1, text: rawText.trim() });
  }

  const title = typeof result.info?.Title === "string" ? result.info.Title : undefined;

  return {
    text: pages.map((p) => p.text).join("\n\f\n"),
    pages,
    title,
    filename,
  };
}

async function parseDocx(buffer: Buffer, filename?: string): Promise<ParsedDocument> {
  const mod = await import("mammoth");
  const mammoth = (mod as unknown as { default?: typeof mod }).default ?? mod;
  const result = await (mammoth as unknown as {
    extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
  }).extractRawText({ buffer });

  return {
    text: result.value,
    filename,
  };
}

async function parseText(buffer: Buffer, filename?: string): Promise<ParsedDocument> {
  const text = buffer.toString("utf-8");
  return {
    text,
    filename,
  };
}
