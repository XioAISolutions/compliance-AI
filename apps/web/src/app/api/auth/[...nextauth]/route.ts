/**
 * NextAuth catch-all route handler.
 *
 * When auth is configured (`NEXTAUTH_SECRET` set), this route serves every
 * NextAuth endpoint (`/api/auth/signin`, `/api/auth/signout`, callbacks,
 * etc.). When unconfigured (preview mode), returns 404 so the app surface
 * doesn't pretend auth exists.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getHandlers() {
  if (!process.env.NEXTAUTH_SECRET) return null;
  const mod = await import("../../../../auth");
  return mod.handlers;
}

export async function GET(req: Request): Promise<Response> {
  const handlers = await getHandlers();
  if (!handlers) return new Response("Auth not configured", { status: 404 });
  return handlers.GET(req as Parameters<typeof handlers.GET>[0]);
}

export async function POST(req: Request): Promise<Response> {
  const handlers = await getHandlers();
  if (!handlers) return new Response("Auth not configured", { status: 404 });
  return handlers.POST(req as Parameters<typeof handlers.POST>[0]);
}
