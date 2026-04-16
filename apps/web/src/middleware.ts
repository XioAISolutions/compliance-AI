/**
 * Next.js middleware — gates protected routes when auth is configured.
 *
 * Preview mode (no NEXTAUTH_SECRET): no-op, all routes open.
 * Configured mode: unauthenticated users hitting `/matters/**`, `/queue`,
 * `/approvals`, or `/onboarding` get redirected to `/login`. Users with
 * no organizationId get redirected to `/onboarding` instead.
 */

import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/matters", "/queue", "/approvals", "/onboarding"];

export async function middleware(req: NextRequest) {
  // If auth isn't configured, let everything through.
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.next();
  }

  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Lazy-import the auth middleware because NextAuth's middleware helper
  // requires the full config.
  const { auth } = await import("./auth");
  const session = await auth();

  if (!session?.user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }

  const orgId = (session.user as { organizationId?: string | null }).organizationId;
  if (!orgId && !pathname.startsWith("/onboarding")) {
    const url = req.nextUrl.clone();
    url.pathname = "/onboarding";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/matters/:path*", "/queue", "/approvals/:path*", "/onboarding/:path*"],
};
