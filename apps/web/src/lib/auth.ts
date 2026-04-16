/**
 * Auth abstraction — wraps NextAuth when configured, falls back to a preview
 * session otherwise.
 *
 * In preview mode (no `NEXTAUTH_SECRET`), every request gets a synthetic
 * "preview" session so all existing routes keep working without interruption.
 *
 * In configured mode, `getSession()` returns the real NextAuth session and
 * `requireSession()` throws a 401 if unauthenticated. Route handlers should
 * call `requireSession()` to get an authenticated `{ user, organizationId }`
 * pair; Next.js middleware (see `apps/web/src/middleware.ts`) handles the
 * redirect side of access control.
 *
 * NextAuth wiring lives in `apps/web/src/auth.ts` — that file only loads when
 * auth is configured. This module is the consumer-facing entry point.
 */

export interface Session {
  user: {
    id: string;
    email: string;
    name?: string;
    role: "owner" | "admin" | "member" | "auditor";
  };
  organizationId: string;
}

const PREVIEW_SESSION: Session = {
  user: {
    id: "preview-user",
    email: "preview@compliance-ai.local",
    name: "Preview User",
    role: "owner",
  },
  organizationId: "preview",
};

/** Is auth configured? Used by routes + middleware to decide whether to gate. */
export function isAuthConfigured(): boolean {
  return Boolean(process.env.NEXTAUTH_SECRET);
}

/**
 * Get the current session. Returns the preview session when auth is not
 * configured (so the demo keeps working); returns the real NextAuth session
 * when it is.
 */
export async function getSession(): Promise<Session | null> {
  if (!isAuthConfigured()) {
    return PREVIEW_SESSION;
  }
  try {
    // Dynamic import keeps NextAuth out of the bundle when auth is disabled.
    const { auth } = await import("../auth");
    const nextAuthSession = await auth();
    if (!nextAuthSession?.user) return null;
    const u = nextAuthSession.user as {
      id?: string;
      email?: string;
      name?: string;
      role?: string;
      organizationId?: string;
    };
    if (!u.id || !u.email || !u.organizationId) return null;
    return {
      user: {
        id: u.id,
        email: u.email,
        ...(u.name ? { name: u.name } : {}),
        role: (u.role as Session["user"]["role"]) ?? "member",
      },
      organizationId: u.organizationId,
    };
  } catch {
    return null;
  }
}

/**
 * Require an authenticated session. Throws a 401-shaped error if missing.
 * Callers in route handlers should catch and respond appropriately.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const err = new Error("Unauthorized") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return session;
}
