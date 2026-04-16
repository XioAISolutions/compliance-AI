/**
 * Document ingestion contracts.
 *
 * The ingest pipeline takes raw file bytes and returns parsed text + chunks
 * ready for insertion into the cognition store. It's framework-agnostic:
 * anything that reads file bytes and produces `DocumentChunk[]` satisfies
 * the contract.
 */

/**
 * A single parsed document. When the parser can extract per-page boundaries
 * (e.g. PDFs), `pages` is populated. Otherwise the whole document lives in
 * `text` and `pages` is undefined.
 */
export interface ParsedDocument {
  /** The full document text, with page breaks preserved as form-feed (\f). */
  text: string;
  /** Optional per-page breakdown. Only populated when the source supports paging (PDF). */
  pages?: ParsedPage[];
  /** Inferred document title (from metadata or first line). */
  title?: string;
  /** Original filename, if provided to the parser. */
  filename?: string;
}

export interface ParsedPage {
  /** 1-indexed page number. */
  pageNumber: number;
  text: string;
}

/**
 * A chunk of a parsed document, ready to be embedded and stored.
 *
 * Chunks are addressable by `id` so the reviewer persona can cite back to a
 * specific region of the source. `ordinal` is the chunk's position within
 * its parent document (0-indexed).
 */
export interface DocumentChunk {
  /** Stable, globally-unique chunk id. */
  id: string;
  /** Parent document id. */
  docId: string;
  /** 0-indexed position within the parent document. */
  ordinal: number;
  /** The chunk text. */
  content: string;
  /** Inclusive start offset in the parent document's full text. */
  charStart: number;
  /** Exclusive end offset in the parent document's full text. */
  charEnd: number;
  /** 1-indexed page number if the source is paged (PDF). Undefined otherwise. */
  page?: number;
  /** Rough token count estimate (4 chars per token heuristic). */
  tokenCount: number;
}

export interface ChunkOptions {
  /**
   * Target token count per chunk. Default 800 — leaves headroom for system
   * prompts and citation instruction while keeping ~40 chunks under a 32k
   * context limit for full-document review.
   */
  targetTokens?: number;
  /**
   * Token overlap between adjacent chunks. Default 100 — enough to preserve
   * sentence context across chunk boundaries without ballooning storage.
   */
  overlapTokens?: number;
  /**
   * Preferred character used to estimate token counts (heuristic: 4 chars/token).
   * Exposed for tests that need deterministic sizing.
   */
  charsPerToken?: number;
}
