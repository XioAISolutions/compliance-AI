/**
 * Ingestion contracts.
 *
 * Cannibalized in spirit from GitNexus's ingestion pipeline (Tree-sitter →
 * chunk → embed → index), but for PDFs + legal text instead of source code.
 * Our chunker is legal-prose-aware (paragraph-first, then sentence-grain),
 * and our classifier is first-page text + filename.
 */

export interface ParsedDocument {
  text: string;
  /** 1-indexed page-boundary offsets into `text`. Empty for non-paginated input. */
  pageOffsets: number[];
  /** Short preview of the first page — used for auto-classification. */
  firstPagePreview: string;
  /** Provenance label — filename, extension, bytes. */
  meta: { filename: string; bytes: number; extension: string };
}

export interface Chunk {
  id: string;
  /** Document id (matter-document PK, assigned by the caller). */
  docId: string;
  /** 0-indexed chunk order within the document. */
  index: number;
  /** Plain text. */
  content: string;
  /** 1-indexed page this chunk starts on (best guess from page offsets). */
  page?: number;
  /** Character offsets into the parsed document text. */
  charStart: number;
  charEnd: number;
}

export interface ChunkingOptions {
  /** Soft target character length per chunk. Default 1200. */
  targetChars?: number;
  /** Minimum chunk character length before we accept it. Default 200. */
  minChars?: number;
  /** Overlap between adjacent chunks (characters). Default 160. */
  overlapChars?: number;
}

export type ClassifiedDocType =
  | "offering-memo"
  | "kyc-aml-file"
  | "marketing-material"
  | "authority-rule"
  | "regulatory-guidance"
  | "reference-material"
  | "other";
