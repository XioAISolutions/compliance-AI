/**
 * Document chunker.
 *
 * Splits a ParsedDocument into DocumentChunks using a recursive character
 * splitter with paragraph-aware boundary preference. Algorithm:
 *
 *   1. Walk the text, accumulating content up to target chunk size.
 *   2. When a chunk would exceed the target, back off to the nearest
 *      preferred boundary (paragraph > sentence > word) before cutting.
 *   3. Carry forward a short overlap window to the next chunk so sentences
 *      that span a boundary survive in at least one chunk's context.
 *
 * This isn't the fanciest splitter (no recursive header-aware tree), but it's
 * deterministic, zero-dependency, and produces chunks the reviewer can cite
 * by ordinal/charStart/charEnd.
 */

import { randomUUID } from "node:crypto";
import type { ChunkOptions, DocumentChunk, ParsedDocument } from "./types.js";

const DEFAULTS = {
  targetTokens: 800,
  overlapTokens: 100,
  charsPerToken: 4,
};

/**
 * Split a parsed document into chunks.
 *
 * `docId` is the parent document's id — chunks carry it forward so callers
 * can group chunks back into their source document later.
 */
export function chunkDocument(
  doc: ParsedDocument,
  docId: string,
  options: ChunkOptions = {},
): DocumentChunk[] {
  const targetTokens = options.targetTokens ?? DEFAULTS.targetTokens;
  const overlapTokens = options.overlapTokens ?? DEFAULTS.overlapTokens;
  const charsPerToken = options.charsPerToken ?? DEFAULTS.charsPerToken;

  const targetChars = targetTokens * charsPerToken;
  const overlapChars = overlapTokens * charsPerToken;

  // If the document has explicit pages, chunk per-page so `page` metadata
  // survives. Otherwise chunk the whole text as a single stream.
  if (doc.pages && doc.pages.length > 0) {
    const chunks: DocumentChunk[] = [];
    let globalOrdinal = 0;
    let globalCharOffset = 0;

    for (const page of doc.pages) {
      const pageChunks = chunkText(page.text, docId, {
        targetChars,
        overlapChars,
        charsPerToken,
        page: page.pageNumber,
        ordinalStart: globalOrdinal,
        charStartOffset: globalCharOffset,
      });
      chunks.push(...pageChunks);
      globalOrdinal += pageChunks.length;
      // Add 2 for the "\n\f\n" separator between pages in the full text.
      globalCharOffset += page.text.length + 3;
    }

    return chunks;
  }

  return chunkText(doc.text, docId, {
    targetChars,
    overlapChars,
    charsPerToken,
  });
}

interface ChunkTextInternalOptions {
  targetChars: number;
  overlapChars: number;
  charsPerToken: number;
  page?: number;
  ordinalStart?: number;
  charStartOffset?: number;
}

function chunkText(
  text: string,
  docId: string,
  opts: ChunkTextInternalOptions,
): DocumentChunk[] {
  if (!text.trim()) return [];

  const chunks: DocumentChunk[] = [];
  let cursor = 0;
  let ordinal = opts.ordinalStart ?? 0;
  const baseOffset = opts.charStartOffset ?? 0;
  // Track where the previous chunk ended so boundary search can't re-find
  // the same paragraph break after overlap backs the cursor up past it.
  let prevChunkEnd = 0;

  while (cursor < text.length) {
    const remaining = text.length - cursor;
    const takeSize = Math.min(opts.targetChars, remaining);
    let end = cursor + takeSize;
    const reachedEnd = end >= text.length;

    // If we took less than the full remaining, back off to a boundary —
    // but only accept boundaries strictly past the previous chunk's end
    // so we always make forward progress.
    if (!reachedEnd) {
      const boundary = findBoundary(text, cursor, end);
      if (boundary > cursor && boundary > prevChunkEnd) {
        end = boundary;
      }
    }

    const rawSlice = text.slice(cursor, end);
    const slice = rawSlice.trim();
    if (slice.length > 0) {
      // Compute the precise trimmed bounds (so charStart/charEnd still line
      // up with the trimmed content).
      const leadingWhitespace = rawSlice.match(/^\s*/)?.[0].length ?? 0;
      const trailingWhitespace = rawSlice.match(/\s*$/)?.[0].length ?? 0;

      const chunkCharStart = baseOffset + cursor + leadingWhitespace;
      const chunkCharEnd = baseOffset + end - trailingWhitespace;

      const chunk: DocumentChunk = {
        id: `ch-${randomUUID().slice(0, 8)}`,
        docId,
        ordinal,
        content: slice,
        charStart: chunkCharStart,
        charEnd: chunkCharEnd,
        tokenCount: Math.ceil(slice.length / opts.charsPerToken),
      };
      if (opts.page !== undefined) {
        chunk.page = opts.page;
      }
      chunks.push(chunk);
      ordinal += 1;
    }

    prevChunkEnd = end;

    // If we reached the end of the text, we're done — overlap would only
    // re-emit tail content as duplicate chunks.
    if (reachedEnd) break;

    if (end === cursor) {
      // No progress — avoid infinite loop on pathological input.
      cursor += 1;
      continue;
    }

    // Advance cursor, applying overlap to preserve sentence context across
    // chunk boundaries. Don't overlap past where we started.
    cursor = Math.max(end - opts.overlapChars, cursor + 1);
  }

  return chunks;
}

/**
 * Find the nearest preferred boundary (paragraph > sentence > word) walking
 * backward from `hardEnd`. Returns the character index to cut at, or `start`
 * if no boundary was found (caller should use `hardEnd` unchanged in that case).
 */
function findBoundary(text: string, start: number, hardEnd: number): number {
  const minWindow = Math.max(start, hardEnd - 400);

  // 1. Paragraph break (blank line, or double newline).
  const paragraphMatch = [...text.slice(minWindow, hardEnd).matchAll(/\n\s*\n/g)].pop();
  if (paragraphMatch?.index !== undefined) {
    return minWindow + paragraphMatch.index + paragraphMatch[0].length;
  }

  // 2. Sentence end (. ! ? followed by whitespace).
  const sentenceMatch = [...text.slice(minWindow, hardEnd).matchAll(/[.!?]\s+/g)].pop();
  if (sentenceMatch?.index !== undefined) {
    return minWindow + sentenceMatch.index + sentenceMatch[0].length;
  }

  // 3. Word break (whitespace).
  const wordMatch = [...text.slice(minWindow, hardEnd).matchAll(/\s+/g)].pop();
  if (wordMatch?.index !== undefined) {
    return minWindow + wordMatch.index + wordMatch[0].length;
  }

  // 4. No boundary found — caller uses hardEnd.
  return start;
}
