import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations.js";
import { userRoleEnum } from "./enums.js";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /**
     * Nullable until onboarding completes. A brand-new signup has no org
     * until they either create one or join an invite.
     */
    organizationId: uuid("organization_id").references(() => organizations.id, {
      onDelete: "cascade",
    }),
    email: text("email").notNull(),
    name: text("name"),
    /** Set when the user verifies their email (NextAuth email provider). */
    emailVerified: timestamp("email_verified", { withTimezone: true, mode: "date" }),
    /** Profile avatar URL from OAuth provider. */
    image: text("image"),
    role: userRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgEmailIdx: index("users_org_email_idx").on(t.organizationId, t.email),
    emailIdx: index("users_email_idx").on(t.email),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
