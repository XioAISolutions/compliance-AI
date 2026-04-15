/**
 * Control revisions — the audit-trail spine.
 *
 * Modeled on ASI-Evolve's experiment-database node shape (Apache 2.0):
 * each revision has a parent link, a motivation (why the user invoked the
 * agent), the produced content, and an optional judge verdict + rationale.
 *
 * Why this matters for compliance: regulators ask "show me how this control
 * evolved over the audit period." A flat history table answers that with a
 * literal git-log-of-controls. The parent link also enables future
 * "branch off this revision" workflows (compare alternative drafts).
 */

import { pgTable, uuid, text, timestamp, jsonb, pgEnum, index } from "drizzle-orm/pg-core";
import { controls } from "./controls.js";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

/** Verdict tokens emitted by the judge persona. Mirrors `JudgeVerdict`. */
export const judgeVerdictEnum = pgEnum("judge_verdict", ["READY_TO_SUBMIT", "ITERATE", "REWRITE"]);

/** Which persona produced this revision. Mirrors `PersonaId` in agents. */
export const personaIdEnum = pgEnum("persona_id", [
  "drafter",
  "reviewer",
  "evidence-collector",
  "risk-assessor",
  "judge",
]);

export const controlRevisions = pgTable(
  "control_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    controlId: uuid("control_id")
      .notNull()
      .references(() => controls.id, { onDelete: "cascade" }),
    /** Null for the first revision; otherwise points at the prior version. */
    parentId: uuid("parent_id"),
    /** The user message / drafter input that produced this revision. */
    motivation: text("motivation").notNull(),
    /** The persona that produced the content of this revision. */
    persona: personaIdEnum("persona").notNull(),
    /** Generated draft (for drafter) or critique (for reviewer/judge). */
    content: text("content").notNull(),
    /** Set when persona = 'judge'. */
    verdict: judgeVerdictEnum("verdict"),
    /** IDs of CognitionItems retrieved into this round's context, for replay. */
    retrievedCognitionIds: jsonb("retrieved_cognition_ids").notNull().$type<string[]>().default([]),
    /** Token usage for observability. Shape: { inputTokens, outputTokens, cacheReadTokens } */
    usage: jsonb("usage")
      .notNull()
      .$type<{ inputTokens: number; outputTokens: number; cacheReadTokens: number }>()
      .default({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }),
    /** Who triggered this revision. */
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    controlIdx: index("control_revisions_control_idx").on(t.controlId, t.createdAt),
    parentIdx: index("control_revisions_parent_idx").on(t.parentId),
    orgIdx: index("control_revisions_org_idx").on(t.organizationId, t.createdAt),
  }),
);

export type ControlRevision = typeof controlRevisions.$inferSelect;
export type NewControlRevision = typeof controlRevisions.$inferInsert;
