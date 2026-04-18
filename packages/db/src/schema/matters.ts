/**
 * Matters — workspace containers for compliance review tasks.
 *
 * A matter groups a set of documents, a jurisdiction + registration category
 * scope, and a task type. It's the top-level unit of work in the securities
 * workbench. Think of it as a "case" or "engagement" in legal-practice terms.
 *
 * The jurisdiction and registration category fields drive retrieval filtering:
 * only authorities applicable to the matter's scope are loaded into context.
 */

import { pgTable, uuid, text, timestamp, pgEnum, index, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { users } from "./users.js";

export const jurisdictionEnum = pgEnum("jurisdiction", [
  "ontario",
  "quebec",
  "british-columbia",
  "alberta",
  "federal",
]);

export const registrationCategoryEnum = pgEnum("registration_category", [
  "emd", // Exempt Market Dealer
  "pm", // Portfolio Manager
  "iiroc", // IIROC Dealer Member (now CIRO)
  "issuer", // Reporting Issuer
  "none", // No registration (e.g., outside counsel)
]);

export const matterStatusEnum = pgEnum("matter_status", [
  "open",
  "in-review",
  "complete",
  // Soft stop: judge said ITERATE, round cap hit. Draft is cited but not
  // signed off. Human can resume.
  "needs-revision",
  // Hard stop: judge said REWRITE OR review errored mid-stream. Don't
  // auto-rerun; human must intervene.
  "blocked",
  "archived",
]);

export const taskTypeEnum = pgEnum("task_type", [
  "om-review",
  "kyc-gap-check",
  "marketing-signoff",
  "response-memo",
]);

export const claimTypeEnum = pgEnum("claim_type", [
  "false-advertising",
  "defective-product",
  "hidden-fees",
  "data-breach",
  "privacy-misuse",
  "unfair-terms",
  "telemarketing-spam",
  "price-fixing",
  "other",
]);

export const proceduralPostureEnum = pgEnum("procedural_posture", [
  "investigation",
  "pre-litigation",
  "proposed-class",
  "certification",
  "discovery",
  "settlement",
  "trial",
  "appeal",
  "closed",
]);

export const courtLevelEnum = pgEnum("court_level", [
  "superior",
  "federal",
  "small-claims",
  "divisional",
  "court-of-appeal",
  "supreme",
]);

export const matters = pgTable(
  "matters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    jurisdiction: jurisdictionEnum("jurisdiction").notNull(),
    registrationCategory: registrationCategoryEnum("registration_category").notNull(),
    taskType: taskTypeEnum("task_type").notNull(),
    status: matterStatusEnum("status").notNull().default("open"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    // Consumer-law fields — all nullable for back-compat with securities matters
    clientName: text("client_name"),
    opposingParty: text("opposing_party"),
    courtLevel: courtLevelEnum("court_level"),
    legalRegime: jsonb("legal_regime").$type<string[]>(),
    claimType: claimTypeEnum("claim_type"),
    classActionFlag: boolean("class_action_flag"),
    estimatedClassSize: text("estimated_class_size"),
    harmDescription: text("harm_description"),
    proceduralPosture: proceduralPostureEnum("procedural_posture"),
    limitationDate: timestamp("limitation_date", { withTimezone: true }),
    certificationDate: timestamp("certification_date", { withTimezone: true }),
    nextDeadline: timestamp("next_deadline", { withTimezone: true }),
    nextDeadlineLabel: text("next_deadline_label"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("matters_org_idx").on(t.organizationId),
    statusIdx: index("matters_status_idx").on(t.organizationId, t.status),
  }),
);

export type MatterRow = typeof matters.$inferSelect;
export type NewMatterRow = typeof matters.$inferInsert;

/** Document types — auto-classified on upload, user can override. */
export const documentTypeEnum = pgEnum("document_type", [
  "authority-rule",
  "regulatory-guidance",
  "offering-memo",
  "kyc-aml-file",
  "marketing-material",
  "reference-material", // collapsed "Legacy *" categories
  "other",
]);

export const matterDocuments = pgTable(
  "matter_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matterId: uuid("matter_id")
      .notNull()
      .references(() => matters.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    documentType: documentTypeEnum("document_type").notNull().default("other"),
    /** Number of chunks after indexing. */
    chunkCount: integer("chunk_count").notNull().default(0),
    /** SHA-256 of the original file for integrity verification. */
    sha256: text("sha256").notNull(),
    /** Page count for paged formats (PDF). Null for DOCX / TXT. */
    pageCount: integer("page_count"),
    /** Optional storage URI for the original file (S3/R2). Null if not retained. */
    sourceUri: text("source_uri"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    matterIdx: index("matter_documents_matter_idx").on(t.matterId),
    orgIdx: index("matter_documents_org_idx").on(t.organizationId),
  }),
);

export type MatterDocumentRow = typeof matterDocuments.$inferSelect;
export type NewMatterDocumentRow = typeof matterDocuments.$inferInsert;
