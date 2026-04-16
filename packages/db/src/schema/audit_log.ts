/**
 * Audit log — hash-chained, tamper-evident record of every substantive action.
 *
 * Every question asked, every retrieval, every generation, every judge verdict,
 * and every export writes a row. The prevRowHash field creates a hash chain:
 * each row includes the hash of the previous row, making retroactive tampering
 * detectable by re-verifying the chain.
 *
 * This is the feature a compliance officer needs to hand a regulator:
 * "show me your work."
 */

import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { matters } from "./matters.js";

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    matterId: uuid("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    /** ISO timestamp of the action. */
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
    /** Who or what performed the action. */
    actor: text("actor").notNull(),
    /** What happened: query, retrieval, generation, verdict, export. */
    action: text("action").notNull(),
    /** SHA-256 of the input (user message, uploaded file, etc.). */
    inputHash: text("input_hash").notNull(),
    /** Authority IDs used in context for this action. */
    authoritiesUsed: jsonb("authorities_used").notNull().$type<string[]>().default([]),
    /** SHA-256 of the output (generated memo, checklist, etc.). */
    outputHash: text("output_hash"),
    /** Judge verdict if this was a generation action. */
    judgeVerdict: text("judge_verdict"),
    /** SHA-256 of the previous row in this matter's chain. Null for the first row. */
    prevRowHash: text("prev_row_hash"),
    /** Full input text (for expandable view in UI). */
    inputContent: text("input_content"),
    /** Full output text (for expandable view in UI). */
    outputContent: text("output_content"),
  },
  (t) => ({
    matterIdx: index("audit_log_matter_idx").on(t.matterId, t.timestamp),
    orgIdx: index("audit_log_org_idx").on(t.organizationId, t.timestamp),
  }),
);

export type AuditLogEntry = typeof auditLog.$inferSelect;
export type NewAuditLogEntry = typeof auditLog.$inferInsert;
