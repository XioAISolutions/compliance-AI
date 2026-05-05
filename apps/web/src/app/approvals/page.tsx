"use client";

/**
 * /approvals — queue of pending approval requests for owners/admins.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { TRIAD_DEMO_APPROVALS } from "../../lib/triad-seed";

interface ApprovalRequest {
  id: string;
  matterId: string;
  summary: string;
  outputHash: string;
  requestedBy: string;
  requestedAt: string;
  status: "requested" | "approved" | "rejected" | "withdrawn";
  reviewedBy?: string;
  reviewedAt?: string;
  rationale?: string;
}

const STATUS_STYLES: Record<ApprovalRequest["status"], string> = {
  requested: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  withdrawn: "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-500",
};

export default function ApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [rationale, setRationale] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch("/api/approvals");
      if (res.ok) {
        setRequests(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchRequests();
  }, []);

  async function review(id: string, status: "approved" | "rejected") {
    setActing(id);
    try {
      const res = await fetch("/api/approvals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, rationale: rationale[id] ?? "" }),
      });
      if (res.ok) void fetchRequests();
    } finally {
      setActing(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Pending approvals</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Reviewer outputs that have reached READY_TO_SUBMIT and await CCO sign-off.
      </p>

      {loading && (
        <div className="mt-6 space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
            />
          ))}
        </div>
      )}

      {!loading && requests.length === 0 && (
        <>
          <div className="mt-6 rounded-md border border-dashed border-neutral-300 bg-neutral-50/50 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/40">
            <strong>Demo mode:</strong> no live tenant approvals yet. Below is the seeded Triad
            Review approval queue showing how the export gate works in production. Output hashes
            bind every approval to the exact reviewer output they signed off on.
          </div>
          <ul className="mt-4 space-y-3">
            {TRIAD_DEMO_APPROVALS.map((a) => {
              const stateClass =
                a.state === "approved"
                  ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                  : a.state === "rejected"
                    ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                    : a.state === "blocked"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300";
              return (
                <li
                  key={a.id}
                  className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link href="/demo/judge" className="text-sm font-medium hover:underline">
                        {a.summary}
                      </Link>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Requested by {a.requestedBy} · {new Date(a.requestedAt).toLocaleString()} ·
                        reviewer says <em>{a.reviewerStatus.replace(/-/g, " ")}</em>
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] text-neutral-400">
                        Output hash: {a.outputHash.slice(0, 32)}…
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase ${stateClass}`}
                    >
                      {a.state}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href="/demo/judge"
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                    >
                      View matter
                    </Link>
                    {a.state === "pending" && (
                      <span className="rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 dark:border-neutral-700">
                        Approve / reject in production
                      </span>
                    )}
                    {a.state === "blocked" && (
                      <span className="rounded-md border border-dashed border-rose-300 px-3 py-1.5 text-xs text-rose-600 dark:border-rose-800 dark:text-rose-300">
                        Export blocked — reviewer requested revision
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <ul className="mt-6 space-y-3">
        {requests.map((r) => (
          <li
            key={r.id}
            className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <Link
                  href={`/matters/${r.matterId}`}
                  className="text-sm font-medium hover:underline"
                >
                  {r.summary}
                </Link>
                <p className="mt-0.5 text-xs text-neutral-500">
                  Requested by {r.requestedBy} · {new Date(r.requestedAt).toLocaleString()}
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-neutral-400">
                  Output hash: {r.outputHash.slice(0, 16)}…
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status]}`}
              >
                {r.status}
              </span>
            </div>

            {r.status === "requested" && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={rationale[r.id] ?? ""}
                  onChange={(e) => setRationale((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Optional rationale / conditions"
                  rows={2}
                  className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => review(r.id, "approved")}
                    disabled={acting === r.id}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => review(r.id, "rejected")}
                    disabled={acting === r.id}
                    className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
                  >
                    Reject
                  </button>
                </div>
              </div>
            )}

            {r.reviewedAt && (
              <p className="mt-2 text-[10px] text-neutral-500">
                Reviewed by {r.reviewedBy} on {new Date(r.reviewedAt).toLocaleString()}
                {r.rationale && <> — {r.rationale}</>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
