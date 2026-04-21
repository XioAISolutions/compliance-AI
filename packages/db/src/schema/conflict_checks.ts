/**
 * Conflict checks — records of pre-matter conflict-search runs.
 *
 * The Canadian law society rules of professional conduct require a
 * lawyer to verify they don't represent anyone adverse to a prospective
 * client before opening the file. This table is the system-of-record
 * for that check: each row is one search the firm ran, the matters
 * that came back as potential conflicts, and the rationale a partner
 * gave when clearing it (or the reason the firm declined the engagement).
 *
 * The matter-creation route validates that a `conflict_clearance_id` is
 * supplied AND its status is `cleared` before allowing a new matter to
 * land. Operators with elevated permissions can pass an explicit
 * override flag, which is itself audited.
 *
 * Status machine:
 *   pending  → search ran, no decision yet
 *   cleared  → partner reviewed hits and cleared (or no hits at all)
 *   declined → firm declined the engagement (legitimate conflict)
 */

import { pgTable, uuid, text, timestamp, index, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";

export const conflictDecisionEnum = pgEnum("conflict_decision", [
  "pending",
  "cleared",
  "declined",
]);

export const conflictChecks = pgTable(
  "conflict_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** Client party name searched. */
    clientName: text("client_name").notNull(),
    /** Opposing party name searched (optional — some matters have none). */
    opposingParty: text("opposing_party"),
    /** Free-form scope description; informs the engagement letter. */
    scope: text("scope"),
    /** JSON-encoded list of matter ids that came back as potential conflicts. */
    hitMatterIds: text("hit_matter_ids").notNull(),
    decision: conflictDecisionEnum("decision").notNull().default("pending"),
    /** Who ran the search. */
    searchedBy: text("searched_by").notNull(),
    searchedAt: timestamp("searched_at", { withTimezone: true }).notNull().defaultNow(),
    /** Who cleared / declined. */
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    /** Required when decision is cleared with hits, or declined. */
    rationale: text("rationale"),
  },
  (t) => ({
    orgIdx: index("conflict_checks_org_idx").on(t.organizationId, t.searchedAt),
    decisionIdx: index("conflict_checks_decision_idx").on(t.organizationId, t.decision),
  }),
);

export type ConflictCheckRow = typeof conflictChecks.$inferSelect;
export type NewConflictCheckRow = typeof conflictChecks.$inferInsert;
