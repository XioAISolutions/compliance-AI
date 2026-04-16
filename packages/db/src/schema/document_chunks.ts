/**
 * Document chunks — the unit of retrieval for the document under review.
 *
 * When a user uploads an OM (or KYC file, marketing deck, etc.), the ingest
 * pipeline splits it into chunks and stores them here. The reviewer agent
 * pulls chunks for the review subject, and citations reference chunks by id
 * so the UI can deep-link back to the exact section.
 *
 * The `embedding` column is reserved for Layer 3's pgvector wiring. Until
 * then, retrieval falls back to matter-scoped full-content passing (all
 * chunks for the matter are injected into context).
 */

import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { matters, matterDocuments } from "./matters.js";

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Parent document. */
    documentId: uuid("document_id")
      .notNull()
      .references(() => matterDocuments.id, { onDelete: "cascade" }),
    /** Matter — denormalized for fast matter-scoped retrieval. */
    matterId: uuid("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    /** Tenant — for RLS enforcement. */
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** 0-indexed position within the parent document. */
    ordinal: integer("ordinal").notNull(),
    /** The chunk content. */
    content: text("content").notNull(),
    /** Inclusive start offset in the parent document's full text. */
    charStart: integer("char_start").notNull(),
    /** Exclusive end offset in the parent document's full text. */
    charEnd: integer("char_end").notNull(),
    /** 1-indexed page number if source is paged (PDF). */
    page: integer("page"),
    /** Rough token count estimate. */
    tokenCount: integer("token_count").notNull(),
    /**
     * Embedding placeholder. Layer 3 migration adds:
     *   ALTER TABLE document_chunks ADD COLUMN embedding vector(512);
     *   CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops);
     * Until then the column is null and retrieval is lexical/full-dump.
     */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    docOrdinalIdx: index("document_chunks_doc_ordinal_idx").on(t.documentId, t.ordinal),
    matterIdx: index("document_chunks_matter_idx").on(t.matterId),
    orgIdx: index("document_chunks_org_idx").on(t.organizationId),
  }),
);

export type DocumentChunkRow = typeof documentChunks.$inferSelect;
export type NewDocumentChunkRow = typeof documentChunks.$inferInsert;
