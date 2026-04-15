import fs from "fs/promises";
import path from "path";
import pdfParse from "pdf-parse";
import { v4 as uuid } from "uuid";
import { config, DEFAULT_MATTER_ID, matterPaths } from "./config";
import { authorityWeightFor, type DocType } from "./retrieval-filter";

/**
 * A structural section detected in the document.
 * Captures the structural position of a clause: heading level, line range,
 * parent chain, and breadcrumb path.
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
  /** Matter this chunk belongs to. Defaults to "default" for legacy corpora. */
  matterId: string;
  /** Document type — drives docType filtering and authority weighting. */
  docType: DocType;
  /** Precomputed from docType at ingest; cached to avoid repeated lookups. */
  authorityWeight: number;
  /** Optional jurisdiction tag (e.g. "US-federal", "US-CA", "ON"). */
  jurisdiction: string | null;
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
 * Walk the detected headings and build a parent-linked tree.
 * Maintain a stack of open sections; any heading of level <= stack.top.level
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

/**
 * Split a body into paragraphs while tracking each one's starting line offset
 * within the body. We need the line offset so later `pageForLine()` calls get
 * the *actual* page a chunk begins on — not the first page of its enclosing
 * section. A section that spans several pages otherwise cites every chunk as
 * the section's opening page, which would quietly break citation accuracy.
 */
interface ParagraphWithOffset {
  text: string;
  /** 0-based line index within the enclosing body string. */
  lineOffset: number;
}

function splitParagraphsWithOffsets(body: string): ParagraphWithOffset[] {
  const lines = body.split("\n");
  const out: ParagraphWithOffset[] = [];
  let buf: string[] = [];
  let bufStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().length === 0) {
      if (buf.length > 0) {
        const text = buf.join("\n").trim();
        if (text.length > 0) out.push({ text, lineOffset: bufStart });
      }
      buf = [];
      bufStart = i + 1;
    } else {
      if (buf.length === 0) bufStart = i;
      buf.push(lines[i]);
    }
  }
  if (buf.length > 0) {
    const text = buf.join("\n").trim();
    if (text.length > 0) out.push({ text, lineOffset: bufStart });
  }
  return out;
}

interface ChunkPiece {
  content: string;
  /**
   * Body-relative line where this chunk's *new* paragraphs begin.
   * When a chunk opens with overlap text carried over from its predecessor,
   * we still use the first paragraph added in this chunk as the locator —
   * the overlap is a retrieval aid, not the chunk's logical start.
   */
  lineOffset: number;
}

function chunkBody(body: string, maxTokens: number, overlapTokens: number): ChunkPiece[] {
  const paragraphs = splitParagraphsWithOffsets(body);
  if (paragraphs.length === 0) return [];

  const chunks: ChunkPiece[] = [];
  let current = "";
  let currentLineOffset = paragraphs[0].lineOffset;

  for (const para of paragraphs) {
    const combined = current ? `${current}\n\n${para.text}` : para.text;
    if (estimateTokens(combined) > maxTokens && current) {
      chunks.push({ content: current.trim(), lineOffset: currentLineOffset });
      const words = current.split(/\s+/);
      const overlapWordCount = Math.floor(overlapTokens * 0.75);
      const overlapText = words.slice(-overlapWordCount).join(" ");
      current = overlapText ? `${overlapText}\n\n${para.text}` : para.text;
      // Anchor the new chunk to the paragraph that triggered the split; the
      // overlap preface repeats prior text and would understate the page.
      currentLineOffset = para.lineOffset;
    } else {
      if (!current) currentLineOffset = para.lineOffset;
      current = combined;
    }
  }
  if (current.trim()) chunks.push({ content: current.trim(), lineOffset: currentLineOffset });
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

/**
 * Reduce an untrusted PDF filename to a filesystem-safe base. We strip to the
 * basename to defeat path-traversal (`../../etc/passwd.pdf`), drop the `.pdf`
 * extension, and replace any character outside `[A-Za-z0-9._-]` so the
 * resulting filename can never point outside its intended directory.
 */
function sanitizeArtifactBase(fileName: string): string {
  const basename = path.basename(fileName);
  const withoutExt = basename.replace(/\.pdf$/i, "");
  const cleaned = withoutExt.replace(/[^a-zA-Z0-9._-]/g, "_");
  // Guard against names that collapse to empty (e.g. "..") or start with a
  // dot which would create hidden files on disk.
  const safe = cleaned.replace(/^\.+/, "_");
  return safe.length > 0 ? safe : "document";
}

export interface IngestOptions {
  /** Matter the document belongs to. Defaults to "default" for backwards compat. */
  matterId?: string;
  /** Document type — defaults to "unknown" so existing upload flows keep working. */
  docType?: DocType;
  /** Optional jurisdiction tag. */
  jurisdiction?: string | null;
}

export async function ingestPDF(
  fileBuffer: Buffer,
  fileName: string,
  opts: IngestOptions = {},
): Promise<IngestResult> {
  const matterId = opts.matterId ?? DEFAULT_MATTER_ID;
  const docType: DocType = opts.docType ?? "unknown";
  const jurisdiction = opts.jurisdiction ?? null;
  const authority = authorityWeightFor(docType);

  const documentId = uuid();
  const data = await pdfParse(fileBuffer);
  const { lines, pageForLine } = buildPageMap(data.text, data.numpages);

  const headings = findHeadings(lines);
  const sections = buildSections(documentId, lines, headings, pageForLine);

  // Build chunks: one section at a time, split oversize sections into sub-chunks.
  // `bodyStartLine` is the absolute line in the source document where this
  // body text begins — we add each chunk's body-relative `lineOffset` to it
  // to get the chunk's true starting line, and from there its page number.
  const allChunks: DocumentChunk[] = [];
  const sectionRanges: { section: DocumentSection | null; body: string; bodyStartLine: number }[] = [];

  if (sections.length === 0) {
    // No structure detected — treat the whole document as one implicit section.
    sectionRanges.push({ section: null, body: lines.join("\n"), bodyStartLine: 0 });
  } else {
    // Preamble (before first heading) becomes an unattached range.
    if (sections[0].startLine > 0) {
      sectionRanges.push({
        section: null,
        body: lines.slice(0, sections[0].startLine).join("\n"),
        bodyStartLine: 0,
      });
    }
    for (const sec of sections) {
      // Section body skips the heading line itself, so its absolute start is
      // one past `sec.startLine`.
      const body = lines.slice(sec.startLine + 1, sec.endLine + 1).join("\n");
      sectionRanges.push({ section: sec, body, bodyStartLine: sec.startLine + 1 });
    }
  }

  for (const { section, body, bodyStartLine } of sectionRanges) {
    const pieces = chunkBody(body, config.chunking.size, config.chunking.overlap);
    for (const piece of pieces) {
      if (!piece.content.trim()) continue;
      const absoluteLine = bodyStartLine + piece.lineOffset;
      allChunks.push({
        id: `${documentId}-${allChunks.length}`,
        documentId,
        fileName,
        pageNumber: pageForLine(absoluteLine),
        sectionId: section?.id ?? null,
        sectionHeader: section?.heading ?? null,
        sectionPath: section?.path ?? [],
        sectionNumber: section?.number ?? null,
        chunkIndex: allChunks.length,
        totalChunks: 0, // filled in after
        content: piece.content,
        tokenEstimate: estimateTokens(piece.content),
        createdAt: new Date().toISOString(),
        matterId,
        docType,
        authorityWeight: authority,
        jurisdiction,
      });
    }
  }
  allChunks.forEach((c) => (c.totalChunks = allChunks.length));

  // Persist chunks + sections under the matter's chunks directory. For the
  // `default` matter this is the legacy top-level chunks/ path, so existing
  // corpora keep working with no migration.
  //
  // Filenames from uploads are untrusted: a crafted multipart name like
  // `../../etc/passwd.pdf` would otherwise escape `chunksDir` via `path.join`.
  // We reduce to a basename, strip the extension, and replace any remaining
  // filesystem-special characters so the artifact cannot leave the chunks
  // directory regardless of what the client sends.
  const chunksDir = matterPaths(matterId).chunks;
  await fs.mkdir(chunksDir, { recursive: true });
  const base = sanitizeArtifactBase(fileName);
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

/**
 * Apply backwards-compatible defaults to a raw chunk record read from disk.
 * Chunks persisted before the consumer-law layer was added will be missing
 * matterId/docType/authorityWeight/jurisdiction — we tag them as the
 * `default` matter with docType `unknown`.
 */
function hydrateChunk(raw: unknown, inferredMatterId: string): DocumentChunk {
  const r = raw as Partial<DocumentChunk> & Record<string, unknown>;
  const docType = (r.docType as DocType | undefined) ?? "unknown";
  return {
    id: String(r.id ?? ""),
    documentId: String(r.documentId ?? ""),
    fileName: String(r.fileName ?? ""),
    pageNumber: Number(r.pageNumber ?? 1),
    sectionId: (r.sectionId as string | null) ?? null,
    sectionHeader: (r.sectionHeader as string | null) ?? null,
    sectionPath: Array.isArray(r.sectionPath) ? (r.sectionPath as string[]) : [],
    sectionNumber: (r.sectionNumber as string | null) ?? null,
    chunkIndex: Number(r.chunkIndex ?? 0),
    totalChunks: Number(r.totalChunks ?? 0),
    content: String(r.content ?? ""),
    tokenEstimate: Number(r.tokenEstimate ?? 0),
    createdAt: String(r.createdAt ?? new Date().toISOString()),
    matterId: typeof r.matterId === "string" && r.matterId.length > 0 ? r.matterId : inferredMatterId,
    docType,
    authorityWeight: typeof r.authorityWeight === "number" ? r.authorityWeight : authorityWeightFor(docType),
    jurisdiction: (r.jurisdiction as string | null | undefined) ?? null,
  };
}

async function listMatterChunkDirs(): Promise<{ matterId: string; dir: string }[]> {
  const out: { matterId: string; dir: string }[] = [];
  // Legacy "default" matter lives at the top-level chunks/ path.
  try {
    await fs.access(config.paths.chunks);
    out.push({ matterId: DEFAULT_MATTER_ID, dir: config.paths.chunks });
  } catch {}
  // Per-matter directories under matters/<id>/chunks.
  try {
    const entries = await fs.readdir(config.paths.matters, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === DEFAULT_MATTER_ID) continue; // already covered via legacy path
      const dir = path.join(config.paths.matters, e.name, "chunks");
      try {
        await fs.access(dir);
        out.push({ matterId: e.name, dir });
      } catch {}
    }
  } catch {}
  return out;
}

export async function loadAllChunks(): Promise<DocumentChunk[]> {
  const dirs = await listMatterChunkDirs();
  const out: DocumentChunk[] = [];
  for (const { matterId, dir } of dirs) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files.filter((f) => f.endsWith("-chunks.json"))) {
        const raw = await fs.readFile(path.join(dir, file), "utf-8");
        const arr = JSON.parse(raw) as unknown[];
        for (const r of arr) out.push(hydrateChunk(r, matterId));
      }
    } catch {}
  }
  return out;
}

export async function loadAllSections(): Promise<DocumentSection[]> {
  const dirs = await listMatterChunkDirs();
  const out: DocumentSection[] = [];
  for (const { dir } of dirs) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files.filter((f) => f.endsWith("-sections.json"))) {
        const raw = await fs.readFile(path.join(dir, file), "utf-8");
        out.push(...JSON.parse(raw));
      }
    } catch {}
  }
  return out;
}

/**
 * Build the text used for embedding. Includes section breadcrumb so retrieval
 * has hierarchical context baked into the vector.
 */
export function buildEmbeddingText(chunk: DocumentChunk): string {
  const breadcrumb = chunk.sectionPath.length > 0 ? chunk.sectionPath.join(" > ") : chunk.fileName;
  return `${chunk.fileName}\n${breadcrumb}\n\n${chunk.content}`;
}
