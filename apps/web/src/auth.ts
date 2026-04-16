/**
 * NextAuth v5 (Auth.js) setup.
 *
 * Providers:
 *   - Credentials (email + magic-link for demo; real setups swap in Email/OAuth)
 *   - GitHub (opt-in via AUTH_GITHUB_ID + AUTH_GITHUB_SECRET)
 *   - Google (opt-in via AUTH_GOOGLE_ID + AUTH_GOOGLE_SECRET)
 *
 * The Drizzle adapter wires session + account persistence to our Postgres
 * `users` / `accounts` / `sessions` / `verification_tokens` tables defined
 * in `packages/db/src/schema/auth.ts` + `users.ts`.
 *
 * This file is only loaded when auth is configured (`NEXTAUTH_SECRET` is
 * set). The abstraction in `lib/auth.ts` gates the import.
 */

import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb, schema } from "@compliance-ai/db";

const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Email",
    credentials: {
      email: { label: "Email", type: "email" },
    },
    async authorize(credentials) {
      const email = credentials?.email;
      if (typeof email !== "string" || !email.includes("@")) return null;

      // Dev-mode: sign in by email only. Real setups would send a magic link
      // via an Email provider. This path exists so the demo can work against
      // a Postgres DB without SMTP.
      return { id: `cred-${email}`, email, name: email.split("@")[0] };
    },
  }),
];

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  const { default: GitHub } = await import("next-auth/providers/github");
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  );
}

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  const { default: Google } = await import("next-auth/providers/google");
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

const adapter = process.env.DATABASE_URL
  ? DrizzleAdapter(getDb(), {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    })
  : undefined;

// NextAuth returns a heavily-inferred object shape. We intentionally erase
// the type on export to sidestep "inferred type cannot be named" portability
// warnings while we're straddling the v5 beta types. Consumers get plain
// function/object types; runtime behavior is unchanged.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nextAuth: any = NextAuth({
  adapter,
  providers,
  session: { strategy: adapter ? "database" : "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async session({ session, user, token }) {
      // Augment the session user with organizationId + role from our schema.
      // Adapter mode: `user` is the DB row. JWT mode: read from token.
      if (user) {
        const dbUser = user as typeof session.user & {
          organizationId?: string | null;
          role?: string;
        };
        (session.user as typeof session.user & {
          organizationId?: string | null;
          role?: string;
        }).organizationId = dbUser.organizationId ?? null;
        (session.user as typeof session.user & {
          organizationId?: string | null;
          role?: string;
        }).role = dbUser.role ?? "member";
      } else if (token) {
        (session.user as typeof session.user & {
          organizationId?: string | null;
          role?: string;
        }).organizationId = (token as { organizationId?: string }).organizationId ?? null;
        (session.user as typeof session.user & {
          organizationId?: string | null;
          role?: string;
        }).role = (token as { role?: string }).role ?? "member";
      }
      return session;
    },
  },
});

export const handlers: {
  GET: (req: Request) => Promise<Response>;
  POST: (req: Request) => Promise<Response>;
} = nextAuth.handlers;
export const auth: () => Promise<{ user?: Record<string, unknown> } | null> = nextAuth.auth;
export const signIn: (...args: unknown[]) => Promise<unknown> = nextAuth.signIn;
export const signOut: (...args: unknown[]) => Promise<unknown> = nextAuth.signOut;
