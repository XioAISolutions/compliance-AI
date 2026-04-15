/**
 * Cognition items — tenant-scoped RAG corpus.
 *
 * Anchored on the interface from `@compliance-ai/cognition`. The pgvector
 * column is added in a separate migration (Day 3+) — for now the schema
 * captures the relational shape so `control_revisions` can reference items
 * by id.
 *
 * Examples of what lives here per tenant:
 *   - Auditor letters from prior years
 *   - Prior approved control narratives ("how we worded CC6.1 in 2025")
 *   - Internal policy excerpts the drafter should mirror in tone
 *   - Common evidence-collection how-tos contributed by ops
 */

import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { frameworkEnum } from "./enums.js";

export const cognitionItems = pgTable(
  "cognition_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Optional framework anchor — narrows retrieval. */
    framework: frameworkEnum("framework"),
    /** Optional control anchor — narrows retrieval further. */
    controlSlug: text("control_slug"),
    title: text("title").notNull(),
    content: text("content").notNull(),
    /** Free-form provenance. */
    source: text("source"),
    /**
     * Embedding column placeholder. Day 3+ migration adds:
     *   embedding vector(1536)
     * and a `vector_cosine_ops` ivfflat index.
     */
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgFrameworkIdx: index("cognition_items_org_framework_idx").on(t.organizationId, t.framework),
    orgControlIdx: index("cognition_items_org_control_idx").on(t.organizationId, t.controlSlug),
  }),
);

export type CognitionItemRow = typeof cognitionItems.$inferSelect;
export type NewCognitionItemRow = typeof cognitionItems.$inferInsert;
