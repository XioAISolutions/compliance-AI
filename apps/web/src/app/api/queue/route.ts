/**
 * Queue API — GET returns the prioritized matter queue.
 *
 * Joins matter state with evidence counts, derives priority signals, runs
 * the classical optimizer, and applies UCB1 island diversity so the queue
 * isn't all OM reviews.
 */

import { NextResponse } from "next/server";
import { buildRiskQueue, type MatterSummary } from "@compliance-ai/prioritizer";
import type { EvidenceStatus } from "@compliance-ai/prioritizer";
import { getDefaultMatterStore } from "../../../lib/matter-store";
import { getDefaultEvidenceStore } from "../../../lib/evidence-store";
import { getDefaultAuditStore } from "../../../lib/audit-store";
import { requireSession } from "../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const matterStore = getDefaultMatterStore();
  const evidenceStore = getDefaultEvidenceStore();
  const auditStore = getDefaultAuditStore();

  const matters = await matterStore.list(session.organizationId);

  const summaries: MatterSummary[] = await Promise.all(
    matters.map(async (m) => {
      const [evidence, auditEntries] = await Promise.all([
        evidenceStore.list(m.id),
        auditStore.getByMatter(m.id),
      ]);

      const counts: Record<EvidenceStatus, number> = {
        missing: 0,
        requested: 0,
        stale: 0,
        present: 0,
        approved: 0,
      };
      for (const e of evidence) {
        counts[e.status] = (counts[e.status] ?? 0) + 1;
      }

      const lastActivity = auditEntries[0]?.timestamp;
      const lastActivityDaysAgo = lastActivity
        ? Math.floor(
            (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24),
          )
        : -1;

      return {
        id: m.id,
        title: m.title,
        taskType: m.taskType,
        status: m.status,
        jurisdiction: m.jurisdiction,
        registrationCategory: m.registrationCategory,
        lastActivityDaysAgo,
        evidenceCounts: counts,
        surfaceCount: 0,
      } satisfies MatterSummary;
    }),
  );

  const queue = buildRiskQueue(summaries, { topN: 20, diverseBy: "taskType" });
  return NextResponse.json(queue);
}
