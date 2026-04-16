/**
 * @compliance-ai/ingestion — upload → parse → chunk → classify pipeline.
 *
 * The callers (matter upload API) receive a ready-to-write stream:
 *
 *   const parsed = await parseDocumentFromBuffer(buf, filename);
 *   const chunks = chunkDocument(parsed, matterDocId);
 *   const { type } = classifyDocument({
 *     filename,
 *     firstPagePreview: parsed.firstPagePreview,
 *   });
 *   for (const chunk of chunks) await cognitionStore.add({
 *     id: chunk.id,
 *     title: `${filename} · p.${chunk.page}`,
 *     content: chunk.content,
 *     organizationId,
 *     jurisdiction,
 *     registrationCategories,
 *     source: filename,
 *   });
 */

export { parseDocumentFromBuffer, pageForOffset } from "./pdf.js";
export { chunkDocument } from "./chunk.js";
export { classifyDocument, type ClassificationResult } from "./classify.js";
export type {
  ParsedDocument,
  Chunk,
  ChunkingOptions,
  ClassifiedDocType,
} from "./types.js";
