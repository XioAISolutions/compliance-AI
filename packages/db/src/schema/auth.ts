/**
 * NextAuth v5 (Auth.js) Drizzle adapter tables.
 *
 * Reserved for Layer 4 — the schemas are here now so migrations land in
 * one batch. When Layer 4 wires NextAuth, `DrizzleAdapter(getDb(), { ... })`
 * points at these tables directly.
 *
 * Spec: https://authjs.dev/getting-started/adapters/drizzle
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    pk: primaryKey({ columns: [account.provider, account.providerAccountId] }),
  }),
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true, mode: "date" }).notNull(),
  },
  (vt) => ({
    pk: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export type Account = typeof accounts.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type VerificationToken = typeof verificationTokens.$inferSelect;
