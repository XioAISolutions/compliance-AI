/**
 * PDF → ParsedDocument.
 *
 * `pdf-parse` gives us a single string for the whole document. We track
 * page boundaries by inserting form-feed (\f) sentinels when pdf-parse's
 * page-handler runs, then strip them and compute `pageOffsets`.
 *
 * Fallback (when pdf-parse fails / non-PDF bytes are passed in): treat
 * the buffer as UTF-8 text and return a single-page doc. Ingestion must
 * never hard-fail on user input — the worst case is a low-quality
 * chunking, not a dropped matter.
 */

import type { ParsedDocument } from "./types.js";

const PAGE_SENTINEL = "\f";

interface PdfParseResult {
  text: string;
  numpages?: number;
}

interface PdfParseFn {
  (data: Buffer, options?: {
    pagerender?: (pageData: {
      getTextContent: (opts: { normalizeWhitespace: boolean }) => Promise<{
        items: Array<{ str: string; hasEOL?: boolean }>;
      }>;
    }) => Promise<string>;
    max?: number;
    version?: string;
  }): Promise<PdfParseResult>;
}

export async function parseDocumentFromBuffer(
  buffer: Buffer,
  filename: string,
): Promise<ParsedDocument> {
  const extension = extnameOf(filename);
  if (extension === "pdf" || isProbablyPdf(buffer)) {
    try {
      return await parsePdf(buffer, filename);
    } catch {
      // Fall through to text fallback.
    }
  }
  // Treat as UTF-8 text (DOCX/RTF/.txt all parse "well enough" this way for
  // the preview; real DOCX support is a separate port).
  return parseAsText(buffer, filename);
}

function isProbablyPdf(buf: Buffer): boolean {
  return buf.slice(0, 4).toString("latin1") === "%PDF";
}

function extnameOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  if (idx === -1) return "";
  return filename.slice(idx + 1).toLowerCase();
}

async function parsePdf(buffer: Buffer, filename: string): Promise<ParsedDocument> {
  // Dynamic import — pdf-parse is a CJS module that reads a test PDF at
  // require-time if imported from its index; grabbing the lib entry avoids
  // that side effect. The library entry isn't typed, so we cast the module
  // shape via `PdfParseFn` locally.
  const pdfParseModule = (await import(
    /* @vite-ignore */ "pdf-parse/lib/pdf-parse.js" as string
  )) as { default: PdfParseFn };
  const pdfParse = pdfParseModule.default;

  const pageTexts: string[] = [];
  const result = await pdfParse(buffer, {
    // pagerender is called once per page — we collect per-page text so we
    // can compute page offsets deterministically instead of trying to infer
    // them from pdf-parse's joined output.
    pagerender: async (pageData: {
      getTextContent: (opts: {
        normalizeWhitespace: boolean;
      }) => Promise<{ items: Array<{ str: string; hasEOL?: boolean }> }>;
    }) => {
      const textContent = await pageData.getTextContent({ normalizeWhitespace: true });
      const lines: string[] = [];
      let line = "";
      for (const item of textContent.items) {
        line += item.str;
        if (item.hasEOL) {
          lines.push(line.trim());
          line = "";
        }
      }
      if (line.trim()) lines.push(line.trim());
      const pageText = lines.join("\n").trim();
      pageTexts.push(pageText);
      return pageText + PAGE_SENTINEL;
    },
  });

  let joined = result.text ?? "";
  const pageOffsets: number[] = [];
  // If pagerender fired for every page, `joined` has form-feed separators.
  // Otherwise we fall back to splitting by form-feed on `joined`, which
  // covers the case where pdf-parse's default handler injects them.
  if (joined.includes(PAGE_SENTINEL)) {
    let cursor = 0;
    const parts = joined.split(PAGE_SENTINEL);
    for (const part of parts) {
      pageOffsets.push(cursor);
      cursor += part.length;
    }
    joined = parts.join("\n");
  } else if (pageTexts.length > 0) {
    let cursor = 0;
    for (const p of pageTexts) {
      pageOffsets.push(cursor);
      cursor += p.length + 1; // +1 for the newline joiner we'll use
    }
    joined = pageTexts.join("\n");
  } else {
    pageOffsets.push(0);
  }

  return {
    text: joined.trim(),
    pageOffsets,
    firstPagePreview: (pageTexts[0] ?? joined.slice(0, 1500)).slice(0, 1500),
    meta: {
      filename,
      bytes: buffer.length,
      extension: extnameOf(filename) || "pdf",
    },
  };
}

function parseAsText(buffer: Buffer, filename: string): ParsedDocument {
  const text = buffer.toString("utf8").trim();
  return {
    text,
    pageOffsets: [0],
    firstPagePreview: text.slice(0, 1500),
    meta: {
      filename,
      bytes: buffer.length,
      extension: extnameOf(filename) || "txt",
    },
  };
}

/**
 * Look up the 1-indexed page containing a character offset into the parsed
 * text. Binary-search friendly; we keep the implementation linear for N≈1-200
 * pages because branch-predictor beats `log n` at that scale.
 */
export function pageForOffset(pageOffsets: number[], charOffset: number): number {
  if (pageOffsets.length === 0) return 1;
  for (let i = pageOffsets.length - 1; i >= 0; i--) {
    if (charOffset >= (pageOffsets[i] ?? 0)) return i + 1;
  }
  return 1;
}
