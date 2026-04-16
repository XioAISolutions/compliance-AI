/**
 * @compliance-ai/ingest — document parsing + chunking pipeline.
 *
 * Usage:
 *
 *   import { parseDocument, chunkDocument } from "@compliance-ai/ingest";
 *
 *   const parsed = await parseDocument(fileBuffer, { filename: "om.pdf" });
 *   const chunks = chunkDocument(parsed, docId);
 */

export { parseDocument, inferMimeType } from "./parsers.js";
export type { ParseOptions, SupportedMimeType } from "./parsers.js";
export { chunkDocument } from "./chunker.js";
export type {
  DocumentChunk,
  ParsedDocument,
  ParsedPage,
  ChunkOptions,
} from "./types.js";
