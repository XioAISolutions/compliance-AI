"use client";

/**
 * MatterStatsCard — compact overview of the tenant's matters by status.
 *
 * Rendered on the home page so a compliance lawyer lands with an
 * at-a-glance read of their queue: "3 need my attention, 2 in flight,
 * 5 complete." Attention-worthy states (needs-revision, blocked) are
 * rendered first and in their "attention" colors (orange + rose)
 * matching the matters-list chips.
 *
 * Renders nothing when there are zero matters — keeps a fresh tenant's
 * home page from showing an empty stats row.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface Matter {
  id: string;
  status: string;
}

interface StatusDef {
  value: string;
  label: string;
  pillClass: string;
}

// Order puts attention states first so the lawyer sees them in scan-left
// direction. Matches the STATUS_BADGE palette on /matters for consistency.
const STATUS_DEFS: StatusDef[] = [
  {
    value: "needs-revision",
    label: "Needs revision",
    pillClass: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  },
  {
    value: "blocked",
    label: "Blocked",
    pillClass: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
  {
    value: "in-review",
    label: "In review",
    pillClass: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  {
    value: "open",
    label: "Open",
    pillClass: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  {
    value: "complete",
    label: "Complete",
    pillClass: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
];

export function MatterStatsCard({ refreshToken }: { refreshToken?: number }) {
  const [matters, setMatters] = useState<Matter[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/matters");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as Matter[];
        if (!cancelled) {
          setMatters(body);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  if (err || !matters || matters.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const m of matters) {
    counts[m.status] = (counts[m.status] ?? 0) + 1;
  }

  // Any cell with zero isn't rendered — keeps the card tight even when the
  // tenant only has matters in one or two states.
  const rendered = STATUS_DEFS.filter((def) => (counts[def.value] ?? 0) > 0);
  if (rendered.length === 0) return null;

  const attentionCount = (counts["needs-revision"] ?? 0) + (counts["blocked"] ?? 0);

  return (
    <section className="mt-6 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Your matters · {matters.length}
        </h2>
        <Link
          href="/matters"
          className="text-[10px] text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
        >
          View all →
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {rendered.map((def) => (
          <Link
            key={def.value}
            href={`/matters`}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${def.pillClass}`}
            title={`${counts[def.value]} matter${counts[def.value] === 1 ? "" : "s"} at ${def.label}`}
          >
            {def.label} · {counts[def.value]}
          </Link>
        ))}
      </div>

      {attentionCount > 0 && (
        <p className="mt-3 text-[11px] text-neutral-500">
          {attentionCount} matter{attentionCount === 1 ? "" : "s"} need
          {attentionCount === 1 ? "s" : ""} your attention — review the judge&apos;s notes on the
          matter page to see why.
        </p>
      )}
    </section>
  );
}
