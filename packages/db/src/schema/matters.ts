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

import { pgTable, uuid, text, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
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
  "emd",        // Exempt Market Dealer
  "pm",         // Portfolio Manager
  "iiroc",      // IIROC Dealer Member (now CIRO)
  "issuer",     // Reporting Issuer
  "none",       // No registration (e.g., outside counsel)
]);

export const matterStatusEnum = pgEnum("matter_status", [
  "open",
  "in-review",
  "complete",
  "archived",
]);

export const taskTypeEnum = pgEnum("task_type", [
  "om-review",
  "kyc-gap-check",
  "marketing-signoff",
  "response-memo",
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
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("matters_org_idx").on(t.organizationId),
    statusIdx: index("matters_status_idx").on(t.organizationId, t.status),
  }),
);

export type Matter = typeof matters.$inferSelect;
export type NewMatter = typeof matters.$inferInsert;

/** Document types — auto-classified on upload, user can override. */
export const documentTypeEnum = pgEnum("document_type", [
  "authority-rule",
  "regulatory-guidance",
  "offering-memo",
  "kyc-aml-file",
  "marketing-material",
  "reference-material",  // collapsed "Legacy *" categories
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
    chunkCount: text("chunk_count"),
    /** SHA-256 of the original file for integrity verification. */
    sha256: text("sha256"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    matterIdx: index("matter_documents_matter_idx").on(t.matterId),
  }),
);

export type MatterDocument = typeof matterDocuments.$inferSelect;
export type NewMatterDocument = typeof matterDocuments.$inferInsert;
