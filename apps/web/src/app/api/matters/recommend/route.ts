/**
 * GET /api/matters/recommend — top-N "work on this next" matter recs.
 *
 * Query params:
 *   topK=5             (default 5, clamp 1..20)
 *   balance=1          (use island sampling by taskType)
 *   surface=0          (don't bump surface counters — useful for badges)
 */

import { NextRequest, NextResponse } from "next/server";
import { recommendMatters } from "../../../../lib/recommender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const topK = Math.min(
    20,
    Math.max(1, Number(url.searchParams.get("topK") ?? "5") || 5),
  );
  const balance = url.searchParams.get("balance") === "1";
  const recordSurface = url.searchParams.get("surface") !== "0";

  const recommendations = recommendMatters({
    topK,
    balanceByTaskType: balance,
    recordSurface,
  });

  return NextResponse.json({
    recommendations: recommendations.map((r) => ({
      matterId: r.matter.id,
      title: r.matter.title,
      taskType: r.matter.taskType,
      jurisdiction: r.matter.jurisdiction,
      registrationCategory: r.matter.registrationCategory,
      status: r.matter.status,
      urgencyScore: r.urgencyScore,
      reasons: r.reasons,
      surfaceCount: r.surfaceCount,
    })),
  });
}
