/**
 * GET /api/demo/milan/redline          → redline edits over the canonical scenario
 * POST /api/demo/milan/redline         → redline edits over arbitrary text { text }
 *
 * Exposes the Featherless-backed redliner. Live when
 * FEATHERLESS_API_KEY is set; deterministic fallback otherwise.
 */

import { NextRequest, NextResponse } from "next/server";
import { MILAN_SCENARIO_TEXT } from "../../../../../lib/demo/cognitive-risk";
import { redline } from "../../../../../lib/demo/featherless-redliner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 20_000;

export async function GET() {
  const result = await redline(MILAN_SCENARIO_TEXT);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: NextRequest) {
  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON: { text: string }" },
      { status: 400 },
    );
  }
  const text = body.text;
  if (typeof text !== "string" || text.length === 0) {
    return NextResponse.json(
      { error: "`text` is required and must be a non-empty string" },
      { status: 400 },
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `\`text\` exceeds ${MAX_TEXT_LENGTH} characters` },
      { status: 413 },
    );
  }
  const result = await redline(text);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
