/**
 * Approval requests — reviewer-bound signoff gate.
 *
 * An approval binds to the SHA-256 of a specific output artifact, so a
 * post-approval edit invalidates the approval. Status machine:
 *
 *   requested → approved | rejected | withdrawn
 *
 * The hard-signoff gate on /api/matters/[id]/export and export-redline
 * rejects any export whose output hash does not match a currently-approved
 * approval.
 */

import { pgTable, uuid, text, timestamp, index, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { matters } from "./matters.js";

export const approvalStatusEnum = pgEnum("approval_status", [
  "requested",
  "approved",
  "rejected",
  "withdrawn",
]);

export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    matterId: uuid("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    /** SHA-256 of the output artifact this approval authorizes. Binds the
     * signoff to the exact text — any edit invalidates the approval. */
    outputHash: text("output_hash").notNull(),
    summary: text("summary").notNull(),
    /** Who submitted the request (user id or free-form string for preview). */
    requestedBy: text("requested_by").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    status: approvalStatusEnum("status").notNull().default("requested"),
    /** Who acted on it (approver). */
    reviewedBy: text("reviewed_by"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    /** Approver's rationale or conditions. */
    rationale: text("rationale"),
  },
  (t) => ({
    matterIdx: index("approval_requests_matter_idx").on(t.matterId),
    orgPendingIdx: index("approval_requests_org_pending_idx").on(t.organizationId, t.status),
    hashIdx: index("approval_requests_hash_idx").on(t.matterId, t.outputHash, t.status),
  }),
);

export type ApprovalRequestRow = typeof approvalRequests.$inferSelect;
export type NewApprovalRequestRow = typeof approvalRequests.$inferInsert;
