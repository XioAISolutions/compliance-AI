/**
 * GET /api/version — build identity. Read at deploy time from env vars
 * injected by Railway / CI.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    name: "compliance-ai",
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
    commit: process.env.NEXT_PUBLIC_GIT_SHA ?? "unknown",
    builtAt: process.env.NEXT_PUBLIC_BUILT_AT ?? null,
    node: process.version,
  });
}
