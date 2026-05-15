/**
 * POST /api/demo/milan/rewrite
 *
 * The full proof loop in one call: judge pastes a risky claim, we
 * BrainSNN-score the original, route it through Featherless to get
 * safer-language edits, then BrainSNN-score the concatenated safer
 * text. Returns the before / after pair so the page can show a side-
 * by-side comparison and let the score visibly drop.
 *
 * This is the demo beat that ties two sponsors together — Featherless
 * does the rewrite, BrainSNN measures the delta. A judge sees the
 * differentiator twice in one click: scoring is computation (not a
 * constant) AND open-weights inference produces safer language.
 *
 * Body:    { text: string }
 * Returns: {
 *   before: { text, cognitiveRisk: { score, dimensions } },
 *   after:  { text, cognitiveRisk: { score, dimensions } },
 *   redline: { source, model, latencyMs, edits[], error? },
 *   delta:  { score, dimensions }
 * }
 *
 * If Featherless is on stub, the deterministic edits are used and the
 * after-text is computed from those — the page still shows a clean
 * before/after even without the partner key.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  computeCognitiveRisk,
  type CognitiveRiskDimensions,
} from "../../../../../lib/demo/cognitive-risk";
import { redline } from "../../../../../lib/demo/featherless-redliner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEXT_LENGTH = 20_000;

function diff(
  before: CognitiveRiskDimensions,
  after: CognitiveRiskDimensions,
): CognitiveRiskDimensions {
  return {
    emotionalActivation: before.emotionalActivation - after.emotionalActivation,
    certaintyPressure: before.certaintyPressure - after.certaintyPressure,
    trustErosion: before.trustErosion - after.trustErosion,
    urgencyCompression: before.urgencyCompression - after.urgencyCompression,
  };
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

  const beforeRisk = computeCognitiveRisk(text);
  const redlineResult = await redline(text);
  // Concatenated safer-language passage. We use only the .after fields
  // because the .before fields were the model's quotes from the input
  // (sometimes loose) — concatenating them as a synthetic "rewritten
  // version" gives BrainSNN a clean text to score.
  const afterText = redlineResult.edits.map((e) => e.after).join(" ");
  const afterRisk = computeCognitiveRisk(afterText);

  return NextResponse.json(
    {
      before: {
        text,
        cognitiveRisk: {
          score: beforeRisk.score,
          dimensions: beforeRisk.dimensions,
        },
      },
      after: {
        text: afterText,
        cognitiveRisk: {
          score: afterRisk.score,
          dimensions: afterRisk.dimensions,
        },
      },
      redline: {
        source: redlineResult.source,
        model: redlineResult.model,
        latencyMs: redlineResult.latencyMs,
        edits: redlineResult.edits,
        error: redlineResult.error,
      },
      delta: {
        score: beforeRisk.score - afterRisk.score,
        dimensions: diff(beforeRisk.dimensions, afterRisk.dimensions),
      },
    },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
