/**
 * GET /api/demo/milan/plan          → plan over the canonical Milan scenario
 * POST /api/demo/milan/plan         → plan over arbitrary text { text: string }
 *
 * Exposes the Gemini-backed planner. When GEMINI_API_KEY is set on the
 * host the response carries `source: "gemini"` and a real Gemini
 * latency. Without the key it returns the deterministic plan with
 * `source: "deterministic"`, so smoke + judges-without-network still
 * see a stable payload.
 */

import { NextRequest, NextResponse } from "next/server";
import { MILAN_SCENARIO_TEXT } from "../../../../../lib/demo/cognitive-risk";
import { plan } from "../../../../../lib/demo/gemini-planner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 20_000;

export async function GET() {
  const result = await plan(MILAN_SCENARIO_TEXT);
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
  const result = await plan(text);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
