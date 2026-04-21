/**
 * GET /api/digests/deadlines
 *
 * Returns matters with deadlines in the next N days (default 30),
 * sorted most-urgent-first. Cron-friendly: a Railway scheduled job or
 * an external monitor can poll this and email the firm a daily limit-
 * date digest.
 *
 * Query parameters:
 *   ?days=N     — window in days; default 30; clamped to [1, 365]
 *   ?include=overdue — also include matters whose deadline already
 *                       passed but where status isn't "archived" (the
 *                       lawyer probably wants to see these LOUDER, not
 *                       hide them).
 *
 * Response: { generatedAt, windowDays, items: DigestItem[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultMatterStore } from "../../../../lib/matter-store";
import { pickMatterDeadline, type DeadlineUrgency } from "../../../../lib/deadline-urgency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DigestItem {
  matterId: string;
  matterTitle: string;
  jurisdiction: string;
  taskType: string;
  status: string;
  deadlineDate: string;
  deadlineLabel: string;
  daysRemaining: number;
  urgency: DeadlineUrgency;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const daysRaw = parseInt(url.searchParams.get("days") ?? "30", 10);
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, daysRaw)) : 30;
  const includeOverdue = url.searchParams.get("include") === "overdue";

  const store = getDefaultMatterStore();
  const matters = await store.list();

  const items: DigestItem[] = [];
  for (const m of matters) {
    if (m.status === "archived") continue;
    const summary = pickMatterDeadline(m);
    if (summary.daysRemaining === null || !summary.date || !summary.label) continue;
    if (summary.daysRemaining < 0) {
      if (!includeOverdue) continue;
    } else if (summary.daysRemaining > days) {
      continue;
    }
    items.push({
      matterId: m.id,
      matterTitle: m.title,
      jurisdiction: m.jurisdiction,
      taskType: m.taskType,
      status: m.status,
      deadlineDate: summary.date,
      deadlineLabel: summary.label,
      daysRemaining: summary.daysRemaining,
      urgency: summary.urgency,
    });
  }

  // Most-urgent first: overdue items lead, then ascending days-
  // remaining. Within the same daysRemaining, alphabetical title for
  // determinism in tests.
  items.sort((a, b) => {
    if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining;
    return a.matterTitle.localeCompare(b.matterTitle);
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    windowDays: days,
    includeOverdue,
    count: items.length,
    items,
  });
}
