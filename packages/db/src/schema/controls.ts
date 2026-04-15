import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { users } from "./users.js";
import { frameworkEnum, controlStatusEnum } from "./enums.js";
import type { Control } from "@compliance-ai/frameworks";

/**
 * Controls — Option A at the storage layer.
 *
 * A single table holds every control regardless of framework. Framework-specific
 * fields (points of focus, article number, risk tier, annex A domain, etc.) live
 * in `framework_metadata` as typed JSON. This lets us issue cross-framework
 * dashboard queries without UNION and lets us add a framework without a migration.
 *
 * Type safety is preserved in code via the discriminated union in
 * `@compliance-ai/frameworks` — see the `FrameworkMetadata` helper below.
 */
export const controls = pgTable(
  "controls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    framework: frameworkEnum("framework").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: controlStatusEnum("status").notNull().default("not-started"),
    ownerId: uuid("owner_id").references(() => users.id, { onDelete: "set null" }),
    /** Framework-specific fields typed by FrameworkMetadata<F>. */
    frameworkMetadata: jsonb("framework_metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgFrameworkIdx: index("controls_org_framework_idx").on(
      t.organizationId,
      t.framework,
    ),
    orgStatusIdx: index("controls_org_status_idx").on(t.organizationId, t.status),
    orgSlugUnique: unique("controls_org_slug_unique").on(t.organizationId, t.slug),
  }),
);

export type ControlRow = typeof controls.$inferSelect;
export type NewControlRow = typeof controls.$inferInsert;

/** Extract only the framework-specific fields from a Control union member. */
export type FrameworkMetadata<C extends Control = Control> = Omit<
  C,
  | "id"
  | "organizationId"
  | "slug"
  | "framework"
  | "code"
  | "title"
  | "description"
  | "status"
  | "ownerId"
  | "createdAt"
  | "updatedAt"
>;
