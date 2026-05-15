/**
 * GET /api/demo/milan/transcribe
 *
 * Returns the canonical Milan voice transcript. When
 * SPEECHMATICS_API_KEY is set on the host, the response also includes
 * a fresh auth-verification block (`auth.ok`, latencyMs, status) so
 * judges can confirm the Speechmatics integration is wired without
 * needing to upload audio.
 */

import { NextResponse } from "next/server";
import { transcribe } from "../../../../../lib/demo/speechmatics-transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const result = await transcribe();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
