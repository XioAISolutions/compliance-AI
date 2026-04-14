import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import { v4 as uuid } from "uuid";
import { config } from "./config";

/**
 * A structural section detected in the document.
 * Mirrors GitNexus markdown-processor's Section nodes: level, line range, parent chain.
 */
export interface DocumentSection {
  id: string;
  documentId: string;
  level: number;            // 1 = top-level (Part, Chapter), increasing with depth
  heading: string;          // e.g. "Section 4.1 Consent"
  number: string | null;    // e.g. "4.1" or "IV" — the machine-matchable id
  parentId: string | null;  // parent section in the hierarchy
  startLine: number;
  endLine: number;
  path: string[];           // ["Part 1", "Section 4", "4.1 Consent"] — full breadcrumb
  pageNumber: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  fileName: string;
  pageNumber: number;
  sectionId: string | null;     // foreign key to DocumentSection
  sectionHeader: string | null;
  sectionPath: string[];        // full breadcrumb for embedding context
  sectionNumber: string | null; // for building [[doc:§4.1]] citations
  chunkIndex: number;
  totalChunks: number;
  content: string;
  tokenEstimate: number;
  createdAt: string;
}

export interface IngestResult {
  documentId: string;
  fileName: string;
  totalPages: number;
  totalChunks: number;
  chunks: DocumentChunk[];
  sections: DocumentSection[];
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// --- Heading detection -------------------------------------------------------

interface HeadingMatch {
  level: number;
  heading: string;
  number: string | null;
  lineIndex: number;
}

/**
 * Detect a heading on a single line, return its level + number, or null.
 * Regulatory docs use a small set of heading conventions; we pattern-match them.
 */
function detectHeading(line: string): Omit<HeadingMatch, "lineIndex"> | null {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 160) return null;

  // "PART I — GENERAL", "CHAPTER 1", "TITLE III"
  let m = trimmed.match(/^(PART|CHAPTER|TITLE|DIVISION|BOOK)\s+([IVXLCDM]+|\d+)\b(.*)$/i);
  if (m) return { level: 1, heading: trimmed, number: m[2] };

  // "Article 4", "Section 4"
  m = trimmed.match(/^(Article|Section)\s+(\d+(?:\.\d+)*)\b(.*)$/i);
  if (m) return { level: 2, heading: trimmed, number: m[2] };

  // "4.1 Consent requirements" — numeric dotted heading
  m = trimmed.match(/^(\d+(?:\.\d+)+)\s+([A-Z].{0,120})$/);
  if (m) {
    const depth = m[1].split(".").length; // 2 dots -> level 3, 3 dots -> level 4
    return { level: Math.min(depth + 1, 6), heading: trimmed, number: m[1] };
  }

  // "4. Consent" — single-number heading (level 2 if title-cased)
  m = trimmed.match(/^(\d+)\.\s+([A-Z].{2,100})$/);
  if (m && !trimmed.endsWith(".") && /[A-Z]/.test(m[2][0])) {
    return { level: 2, heading: trimmed, number: m[1] };
  }

  // ALL-CAPS short line = likely a heading
  if (trimmed.length >= 6 && trimmed.length <= 90 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return { level: 1, heading: trimmed, number: null };
  }

  return null;
}

function findHeadings(lines: string[]): HeadingMatch[] {
  const out: HeadingMatch[] = [];
  for (let i = 0; i < lines.length; i++) {
    const h = detectHeading(lines[i]);
    if (h) out.push({ ...h, lineIndex: i });
  }
  return out;
}

// --- Section tree ------------------------------------------------------------

/**
 * Walk the detected headings and build a parent-linked tree, GitNexus-style:
 * maintain a stack of open sections; any heading of level <= stack.top.level
 * pops until we find a proper parent.
 */
function buildSections(
  documentId: string,
  lines: string[],
  headings: HeadingMatch[],
  pageForLine: (line: number) => number,
): DocumentSection[] {
  const sections: DocumentSection[] = [];
  const stack: DocumentSection[] = [];

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const startLine = h.lineIndex;
    const endLine = i + 1 < headings.length ? headings[i + 1].lineIndex - 1 : lines.length - 1;

    while (stack.length > 0 && stack[stack.length - 1].level >= h.level) stack.pop();
    const parent = stack[stack.length - 1] || null;

    const section: DocumentSection = {
      id: `${documentId}:${sections.length}`,
      documentId,
      level: h.level,
      heading: h.heading,
      number: h.number,
      parentId: parent?.id ?? null,
      startLine,
      endLine,
      pageNumber: pageForLine(startLine),
      path: [...(parent?.path ?? []), h.heading],
    };

    sections.push(section);
    stack.push(section);
  }

  return sections;
}

// --- Chunking within sections ------------------------------------------------

function chunkBody(body: string, maxTokens: number, overlapTokens: number): string[] {
  const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter((p) => p.length > 0);
  if (paragraphs.length === 0) return [];
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const combined = current ? `${current}\n\n${para}` : para;
    if (estimateTokens(combined) > maxTokens && current) {
      chunks.push(current.trim());
      const words = current.split(/\s+/);
      const overlapWordCount = Math.floor(overlapTokens * 0.75);
      const overlapText = words.slice(-overlapWordCount).join(" ");
      current = overlapText ? `${overlapText}\n\n${para}` : para;
    } else {
      current = combined;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// --- Page mapping ------------------------------------------------------------

/**
 * pdf-parse returns flat text with form-feed (\f) between pages. We build a
 * line -> page map so every chunk gets an accurate page number.
 */
function buildPageMap(fullText: string, totalPages: number): { lines: string[]; pageForLine: (i: number) => number } {
  // Preferred path: form-feeds between pages (custom pagerender or some PDFs).
  if (fullText.includes("\f")) {
    const pages = fullText.split(/\f/);
    const lines: string[] = [];
    const pageByLine: number[] = [];
    pages.forEach((pageText, pageIdx) => {
      for (const l of pageText.split("\n")) {
        lines.push(l);
        pageByLine.push(pageIdx + 1);
      }
    });
    return { lines, pageForLine: (i) => pageByLine[Math.max(0, Math.min(i, pageByLine.length - 1))] || 1 };
  }
  // Fallback: proportional estimate from line index. Not perfect, but better
  // than collapsing every chunk to page 1 when pdf-parse doesn't emit \f.
  const lines = fullText.split("\n");
  const pageForLine = (i: number) => {
    if (lines.length === 0 || totalPages === 0) return 1;
    const clamped = Math.max(0, Math.min(i, lines.length - 1));
    return Math.min(totalPages, Math.max(1, Math.ceil(((clamped + 1) / lines.length) * totalPages)));
  };
  return { lines, pageForLine };
}

// --- Main entry --------------------------------------------------------------

export async function ingestPDF(fileBuffer: Buffer, fileName: string): Promise<IngestResult> {
  const documentId = uuid();
  const data = await pdfParse(fileBuffer);
  const { lines, pageForLine } = buildPageMap(data.text, data.numpages);

  const headings = findHeadings(lines);
  const sections = buildSections(documentId, lines, headings, pageForLine);

  // Build chunks: one section at a time, split oversize sections into sub-chunks.
  const allChunks: DocumentChunk[] = [];
  const sectionRanges: { section: DocumentSection | null; body: string; startLine: number }[] = [];

  if (sections.length === 0) {
    // No structure detected — treat the whole document as one implicit section.
    sectionRanges.push({ section: null, body: lines.join("\n"), startLine: 0 });
  } else {
    // Preamble (before first heading) becomes an unattached range.
    if (sections[0].startLine > 0) {
      sectionRanges.push({
        section: null,
        body: lines.slice(0, sections[0].startLine).join("\n"),
        startLine: 0,
      });
    }
    for (const sec of sections) {
      const body = lines.slice(sec.startLine + 1, sec.endLine + 1).join("\n");
      sectionRanges.push({ section: sec, body, startLine: sec.startLine });
    }
  }

  for (const { section, body, startLine } of sectionRanges) {
    const pieces = chunkBody(body, config.chunking.size, config.chunking.overlap);
    for (const content of pieces) {
      if (!content.trim()) continue;
      allChunks.push({
        id: `${documentId}-${allChunks.length}`,
        documentId,
        fileName,
        pageNumber: pageForLine(startLine),
        sectionId: section?.id ?? null,
        sectionHeader: section?.heading ?? null,
        sectionPath: section?.path ?? [],
        sectionNumber: section?.number ?? null,
        chunkIndex: allChunks.length,
        totalChunks: 0, // filled in after
        content,
        tokenEstimate: estimateTokens(content),
        createdAt: new Date().toISOString(),
      });
    }
  }
  allChunks.forEach((c) => (c.totalChunks = allChunks.length));

  // Persist chunks + sections as sibling files.
  const chunksDir = config.paths.chunks;
  await fs.mkdir(chunksDir, { recursive: true });
  const base = fileName.replace(/\.pdf$/i, "");
  await fs.writeFile(path.join(chunksDir, `${base}-chunks.json`), JSON.stringify(allChunks, null, 2));
  await fs.writeFile(path.join(chunksDir, `${base}-sections.json`), JSON.stringify(sections, null, 2));

  return {
    documentId,
    fileName,
    totalPages: data.numpages,
    totalChunks: allChunks.length,
    chunks: allChunks,
    sections,
  };
}

export async function loadAllChunks(): Promise<DocumentChunk[]> {
  const chunksDir = config.paths.chunks;
  try {
    const files = await fs.readdir(chunksDir);
    const out: DocumentChunk[] = [];
    for (const file of files.filter((f) => f.endsWith("-chunks.json"))) {
      const raw = await fs.readFile(path.join(chunksDir, file), "utf-8");
      out.push(...JSON.parse(raw));
    }
    return out;
  } catch {
    return [];
  }
}

export async function loadAllSections(): Promise<DocumentSection[]> {
  const chunksDir = config.paths.chunks;
  try {
    const files = await fs.readdir(chunksDir);
    const out: DocumentSection[] = [];
    for (const file of files.filter((f) => f.endsWith("-sections.json"))) {
      const raw = await fs.readFile(path.join(chunksDir, file), "utf-8");
      out.push(...JSON.parse(raw));
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Build the text used for embedding. Includes section breadcrumb so retrieval
 * has hierarchical context. GitNexus text-generator pattern.
 */
export function buildEmbeddingText(chunk: DocumentChunk): string {
  const breadcrumb = chunk.sectionPath.length > 0 ? chunk.sectionPath.join(" > ") : chunk.fileName;
  return `${chunk.fileName}\n${breadcrumb}\n\n${chunk.content}`;
}
