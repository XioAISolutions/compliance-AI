/**
 * GET /api/cognition/metrics
 *
 * Returns the current lesson-layer MetricsSnapshot. Includes:
 *   - reinforce/insert/supersede counts and ratio
 *   - dedup count contributed by the garden
 *   - ambient tokens per day + per provider
 *   - sidecar/garden average latencies + slow-call counter
 *   - estimated turn-time saved by reinforcement vs naive insert
 *
 * Counts are process-local and reset with the worker. A
 * Postgres-backed metrics sink is the natural follow-up; the snapshot
 * shape here is the wire contract.
 */

import { NextResponse } from "next/server";
import { getLessonsBundle } from "../../../../lib/lessons";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { metrics, store, queue } = getLessonsBundle();
  const snapshot = metrics.snapshot();
  const lessonCount = await store.size();
  const pendingWakes = queue.pending().length;
  return NextResponse.json({ ...snapshot, lessonCount, pendingWakes });
}
