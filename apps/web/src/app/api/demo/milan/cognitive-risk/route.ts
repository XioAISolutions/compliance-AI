/**
 * POST /api/demo/milan/cognitive-risk
 *
 * Live BrainSNN scoring over arbitrary text. A judge pastes any deck
 * paragraph, sales-call transcript, or marketing claim and gets back
 * the same four-dimensional risk vector + composite that the canned
 * Milan demo run uses. This is the credibility test for the BrainSNN
 * agent: the score has to move when the input moves.
 *
 * Deliberately unauthenticated and CORS-open — judges may run it from
 * the lablab page, devtools, or curl during the review window.
 */

import { NextRequest, NextResponse } from "next/server";
import { computeCognitiveRisk } from "../../../../../lib/demo/cognitive-risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 20_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  let body: { text?: unknown };
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Body must be JSON: { text: string }" },
      { status: 400, headers: corsHeaders },
    );
  }
  const text = body.text;
  if (typeof text !== "string") {
    return NextResponse.json(
      { error: "`text` is required and must be a string" },
      { status: 400, headers: corsHeaders },
    );
  }
  if (text.length === 0) {
    return NextResponse.json(
      { error: "`text` cannot be empty" },
      { status: 400, headers: corsHeaders },
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json(
      { error: `\`text\` exceeds ${MAX_TEXT_LENGTH} characters` },
      { status: 413, headers: corsHeaders },
    );
  }

  const risk = computeCognitiveRisk(text);
  return NextResponse.json(
    {
      score: risk.score,
      dimensions: risk.dimensions,
      inputLength: text.length,
    },
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Cache-Control": "no-store",
      },
    },
  );
}
