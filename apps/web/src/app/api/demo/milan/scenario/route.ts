/**
 * GET /api/demo/milan/scenario
 *
 * The raw inputs BrainSNN + the planner + the redliner all run over.
 * Surfacing them as a dedicated endpoint reinforces the evidence-chain
 * story: a judge can click through and read the exact deck / transcript
 * / claim text the workflow was scored against, then compare it to the
 * proof-pack DOCX and the cognitive-risk dimensions.
 *
 * Format: parsed into discrete artifacts so a downstream caller can
 * pull just the transcript (or just the deck) without re-splitting.
 */

import { NextResponse } from "next/server";
import {
  MILAN_SCENARIO_TEXT,
  computeCognitiveRisk,
} from "../../../../../lib/demo/cognitive-risk";

export const runtime = "nodejs";
export const dynamic = "force-static";

interface Artifact {
  source: "deck" | "transcript" | "claim";
  label: string;
  text: string;
}

function parseScenario(raw: string): Artifact[] {
  const blocks: Record<Artifact["source"], string[]> = {
    deck: [],
    transcript: [],
    claim: [],
  };
  let current: Artifact["source"] | null = null;
  for (const line of raw.split("\n")) {
    const tagMatch = /^\[(deck|call|claim)\]\s*(.*)$/.exec(line);
    if (tagMatch) {
      const rawTag = tagMatch[1] ?? "";
      const rest = (tagMatch[2] ?? "").trim();
      current = rawTag === "call" ? "transcript" : (rawTag as Artifact["source"]);
      if (rest) blocks[current].push(rest);
      continue;
    }
    const trimmed = line.trim();
    if (current && trimmed) blocks[current].push(trimmed);
  }
  return [
    { source: "deck", label: "Investor deck excerpt", text: blocks.deck.join(" ") },
    { source: "transcript", label: "Sales-call transcript", text: blocks.transcript.join(" ") },
    { source: "claim", label: "Marketing claim", text: blocks.claim.join(" ") },
  ];
}

export async function GET() {
  const artifacts = parseScenario(MILAN_SCENARIO_TEXT);
  const risk = computeCognitiveRisk(MILAN_SCENARIO_TEXT);
  return NextResponse.json(
    {
      raw: MILAN_SCENARIO_TEXT,
      artifacts,
      cognitiveRisk: {
        score: risk.score,
        dimensions: risk.dimensions,
      },
      headlineClaim:
        "Protected returns, limited spots, AI-reviewed onboarding, and instant approval.",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=3600",
      },
    },
  );
}
