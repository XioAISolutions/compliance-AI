"use client";

/**
 * Queue — prioritized cross-matter work list.
 *
 * Replaces the demo-layer `/demo/risk-queue` page. The queue is generated
 * server-side by combining matter metadata + evidence counts through the
 * classical priority optimizer and applying UCB1 island diversity so the
 * queue isn't all OM reviews every day.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

type RiskLevel = "critical" | "high" | "medium" | "low";
type EvidenceStatus = "missing" | "requested" | "stale" | "present" | "approved";

interface MatterSummary {
  id: string;
  title: string;
  taskType: string;
  status: string;
  jurisdiction: string;
  registrationCategory: string;
  lastActivityDaysAgo: number;
  evidenceCounts: Record<EvidenceStatus, number>;
}

interface PrioritySignals {
  riskLevel: RiskLevel;
  evidenceStatus: EvidenceStatus;
  dueInDays: number;
  regulatorExposure?: boolean;
}

interface QueueItem {
  item: MatterSummary;
  score: number;
  signals: PrioritySignals;
}

const RISK_STYLES: Record<RiskLevel, string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

const TASK_LABELS: Record<string, string> = {
  "om-review": "OM review",
  "kyc-gap-check": "KYC gap",
  "marketing-signoff": "Marketing",
  "response-memo": "Response memo",
};

const TASK_ICONS: Record<string, string> = {
  "om-review": "OM",
  "kyc-gap-check": "KYC",
  "marketing-signoff": "MKT",
  "response-memo": "RSP",
};

export default function QueuePage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/queue");
        if (res.ok) {
          setQueue(await res.json());
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Today&apos;s queue</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Prioritized by risk × evidence gap × deadline pressure. Diversified by task type
            so the queue isn&apos;t all OM reviews.
          </p>
        </div>
        <Link
          href="/matters"
          className="rounded-md border border-neutral-300 px-3 py-2 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          All matters
        </Link>
      </div>

      {loading && <p className="mt-8 text-sm text-neutral-400">Building queue…</p>}

      {!loading && queue.length === 0 && (
        <div className="mt-8 rounded-lg border border-dashed border-neutral-300 py-12 text-center dark:border-neutral-700">
          <p className="text-neutral-500">No matters in the queue.</p>
          <Link
            href="/matters"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            Create your first matter
          </Link>
        </div>
      )}

      {!loading && queue.length > 0 && (
        <ul className="mt-6 space-y-2">
          {queue.map((q) => (
            <li key={q.item.id}>
              <Link
                href={`/matters/${q.item.id}`}
                className="flex items-center gap-4 rounded-lg border border-neutral-200 p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-xs font-bold text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                  {TASK_ICONS[q.item.taskType] ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="truncate text-sm font-medium">{q.item.title}</h3>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {TASK_LABELS[q.item.taskType] ?? q.item.taskType} ·{" "}
                    {q.item.jurisdiction} / {q.item.registrationCategory.toUpperCase()}
                    {q.item.evidenceCounts.missing > 0 && (
                      <> · {q.item.evidenceCounts.missing} missing evidence</>
                    )}
                    {q.item.lastActivityDaysAgo >= 0 && (
                      <> · {q.item.lastActivityDaysAgo}d since last activity</>
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${RISK_STYLES[q.signals.riskLevel]}`}
                >
                  {q.signals.riskLevel}
                </span>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-lg font-bold text-neutral-900 dark:text-neutral-100">
                    {q.score}
                  </p>
                  <p className="text-[10px] text-neutral-400">priority</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-[10px] text-neutral-400">
        Scoring is deterministic and reproducible. Ranking combines classical priority +
        UCB1 island diversity across task types. QUBO/QAOA optimizer sidecar slot reserved.
      </p>
    </main>
  );
}
