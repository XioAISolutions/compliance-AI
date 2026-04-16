/**
 * Legal-prose-aware chunker.
 *
 * Strategy: split the parsed document on paragraph boundaries first
 * (double-newlines), then greedily pack paragraphs into ~targetChars
 * windows with a fixed overlap. If a single paragraph exceeds the target,
 * fall back to sentence-splitting to keep chunks comparable in size.
 *
 * Why not a fixed character-window sliding chunker: for legal text, the
 * rules (and therefore good retrieval hits) live at paragraph grain —
 * cutting mid-sentence splits the definition from the qualifier, which
 * makes BM25 look dumber than it is.
 *
 * Cannibalized in spirit from GitNexus's Web-Worker chunker, simplified
 * to pure TS (no Comlink) since our documents are tens-to-hundreds of
 * pages, not full repos.
 */

import { randomUUID } from "node:crypto";
import type { Chunk, ChunkingOptions, ParsedDocument } from "./types.js";
import { pageForOffset } from "./pdf.js";

const DEFAULT_TARGET = 1200;
const DEFAULT_MIN = 200;
const DEFAULT_OVERLAP = 160;

const PARAGRAPH_RE = /\n{2,}/g;
const SENTENCE_RE = /(?<=[.!?])\s+(?=[A-Z])/g;

export function chunkDocument(
  doc: ParsedDocument,
  docId: string,
  options: ChunkingOptions = {},
): Chunk[] {
  const target = options.targetChars ?? DEFAULT_TARGET;
  const min = options.minChars ?? DEFAULT_MIN;
  const overlap = options.overlapChars ?? DEFAULT_OVERLAP;

  const text = doc.text;
  if (text.length === 0) return [];

  // Split on paragraph boundaries while tracking char offsets so we can
  // compute the 1-indexed page for each chunk.
  const paragraphs: { content: string; start: number }[] = [];
  let cursor = 0;
  for (const match of text.matchAll(PARAGRAPH_RE)) {
    const start = cursor;
    const end = match.index!;
    const piece = text.slice(start, end).trim();
    if (piece.length > 0) {
      paragraphs.push({ content: piece, start });
    }
    cursor = end + match[0].length;
  }
  const tail = text.slice(cursor).trim();
  if (tail.length > 0) paragraphs.push({ content: tail, start: cursor });

  // Further split any paragraph that's larger than 2× target into sentences.
  const pieces: { content: string; start: number }[] = [];
  for (const p of paragraphs) {
    if (p.content.length <= target * 2) {
      pieces.push(p);
      continue;
    }
    let sentenceCursor = p.start;
    const sentences = p.content.split(SENTENCE_RE);
    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      pieces.push({ content: trimmed, start: sentenceCursor });
      sentenceCursor += s.length + 1; // +1 for whitespace eaten by split
    }
  }

  // Greedy-pack pieces into windows of ~target with `overlap` character
  // overlap between adjacent windows (for context preservation).
  const chunks: Chunk[] = [];
  let buffer = "";
  let bufferStart: number | null = null;
  let bufferEnd = 0;
  let index = 0;

  function flush() {
    const content = buffer.trim();
    if (content.length < min) return;
    if (bufferStart === null) return;
    const page = pageForOffset(doc.pageOffsets, bufferStart);
    chunks.push({
      id: randomUUID(),
      docId,
      index: index++,
      content,
      page,
      charStart: bufferStart,
      charEnd: bufferEnd,
    });
  }

  for (const p of pieces) {
    if (bufferStart === null) {
      bufferStart = p.start;
    }
    buffer = buffer ? `${buffer}\n\n${p.content}` : p.content;
    bufferEnd = p.start + p.content.length;

    if (buffer.length >= target) {
      flush();
      // Start next buffer with the last `overlap` characters of the
      // previous one for continuity (useful for BM25 when search terms
      // straddle a chunk boundary). When overlap is 0, reset to a clean
      // start so the next paragraph's own offset (and its page) takes
      // over — otherwise we'd carry forward a stale offset that ignores
      // page breaks.
      if (overlap > 0 && buffer.length > overlap) {
        const overlapText = buffer.slice(-overlap);
        buffer = overlapText;
        bufferStart = bufferEnd - overlapText.length;
      } else {
        buffer = "";
        bufferStart = null;
      }
    }
  }
  // Final flush for the tail buffer.
  if (buffer.trim().length >= min) {
    flush();
  } else if (buffer.trim().length > 0 && chunks.length === 0) {
    // Very short document — keep it as a single chunk even below `min`
    // so single-page uploads still retrieve.
    chunks.push({
      id: randomUUID(),
      docId,
      index: index++,
      content: buffer.trim(),
      page: pageForOffset(doc.pageOffsets, bufferStart ?? 0),
      charStart: bufferStart ?? 0,
      charEnd: bufferEnd,
    });
  }

  return chunks;
}
