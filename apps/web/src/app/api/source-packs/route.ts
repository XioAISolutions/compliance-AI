/**
 * GET /api/source-packs
 *
 * Lists the source packs available on this deployment. Powers the matter
 * wizard's source-pack chips and an operator's audit view ("what's in
 * scope for my tenant?").
 *
 * Query parameters:
 *   - ?taskType=<taskType>                — filter to packs relevant to a task
 *   - ?lane=<lane>                         — filter to packs for a lane
 *   - ?registrationCategory=<category>     — used with taskType to refine securities lanes
 *
 * Response shape: { packs: SourcePackSummary[] }. Bodies are summaries
 * (id, label, description, jurisdictions, practiceAreas, itemCount) — the
 * actual authority content is retrieved via the matter review pipeline,
 * not exposed through this endpoint.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  SOURCE_PACKS,
  selectPacksForLane,
  selectPacksForTaskType,
  summarizePack,
  type MatterLane,
  type SourcePack,
} from "@compliance-ai/cognition";

export const runtime = "nodejs";

const VALID_LANES: readonly MatterLane[] = [
  "securities-emd",
  "securities-pm",
  "securities-iiroc",
  "securities-issuer",
  "consumer-protection",
  "privacy",
  "court-ai-disclosure",
  "regulator-response",
  "cross-cutting",
];

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const taskType = url.searchParams.get("taskType");
  const laneParam = url.searchParams.get("lane");
  const registrationCategory = url.searchParams.get("registrationCategory") ?? undefined;

  let packs: SourcePack[];
  if (taskType) {
    packs = selectPacksForTaskType(taskType, registrationCategory);
  } else if (laneParam && (VALID_LANES as readonly string[]).includes(laneParam)) {
    packs = selectPacksForLane(laneParam as MatterLane);
  } else {
    packs = [...SOURCE_PACKS];
  }

  return NextResponse.json({
    packs: packs.map(summarizePack),
  });
}
