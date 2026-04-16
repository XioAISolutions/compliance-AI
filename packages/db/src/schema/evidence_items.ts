/**
 * Evidence items — per-matter evidence requests and artifacts.
 *
 * The OM reviewer surfaces PARTIAL/MISSING findings in its checklist; each
 * finding auto-generates an evidence item requesting the missing artifact
 * from a designated owner (CFO, CCO, ops, counsel, etc.). Once collected,
 * the uploader attaches the artifact and the item flips to `present`.
 *
 * Status machine:
 *   missing   → request created, not yet asked
 *   requested → sent to owner, awaiting response
 *   stale     → owner responded but artifact is out of date
 *   present   → artifact uploaded
 *   approved  → reviewed + attested by CCO
 */

import { pgTable, uuid, text, timestamp, index, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { users } from "./users.js";
import { matters } from "./matters.js";

export const evidenceStatusEnum = pgEnum("evidence_status", [
  "missing",
  "requested",
  "stale",
  "present",
  "approved",
]);

export const evidenceItems = pgTable(
  "evidence_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    matterId: uuid("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    /** Short title ("Audited 2024 financial statements"). */
    title: text("title").notNull(),
    /** Long-form description of why this evidence is needed. */
    description: text("description").notNull(),
    /** Source rule reference ("NI 45-106 s. 2.9(2)(c)(v)"). */
    source: text("source"),
    /** Current status in the lifecycle. */
    status: evidenceStatusEnum("status").notNull().default("missing"),
    /** Person or role being asked for the artifact. */
    requestedFrom: text("requested_from"),
    /** URI to the uploaded artifact (if status = present/approved). */
    fileUri: text("file_uri"),
    /** SHA-256 of the artifact for integrity. */
    sha256: text("sha256"),
    /** When the artifact was uploaded. */
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    /** When the CCO or designated reviewer attested. */
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** Attester. */
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    matterIdx: index("evidence_items_matter_idx").on(t.matterId),
    orgIdx: index("evidence_items_org_idx").on(t.organizationId),
    statusIdx: index("evidence_items_status_idx").on(t.matterId, t.status),
  }),
);

export type EvidenceItemRow = typeof evidenceItems.$inferSelect;
export type NewEvidenceItemRow = typeof evidenceItems.$inferInsert;
