"use client";

/**
 * Matter list — create or select a matter to work on.
 *
 * This is the default post-login landing page in the redesigned flow.
 * Replaces the old /controls catalog index as the primary entry point.
 */

import { useState, useEffect } from "react";
import Link from "next/link";

interface Matter {
  id: string;
  title: string;
  jurisdiction: string;
  registrationCategory: string;
  taskType: string;
  status: string;
  createdAt: string;
  // Consumer-law fields (optional)
  clientName?: string;
  opposingParty?: string;
  claimType?: string;
  classActionFlag?: boolean;
  proceduralPosture?: string;
  nextDeadline?: string;
  nextDeadlineLabel?: string;
  limitationDate?: string;
}

const JURISDICTIONS = [
  { value: "ontario", label: "Ontario" },
  { value: "quebec", label: "Quebec" },
  { value: "british-columbia", label: "British Columbia" },
  { value: "alberta", label: "Alberta" },
  { value: "saskatchewan", label: "Saskatchewan" },
  { value: "manitoba", label: "Manitoba" },
  { value: "nova-scotia", label: "Nova Scotia" },
  { value: "new-brunswick", label: "New Brunswick" },
  { value: "newfoundland", label: "Newfoundland & Labrador" },
  { value: "pei", label: "Prince Edward Island" },
  { value: "northwest-territories", label: "Northwest Territories" },
  { value: "yukon", label: "Yukon" },
  { value: "nunavut", label: "Nunavut" },
  { value: "federal", label: "Federal" },
  { value: "multi-provincial", label: "Multi-provincial" },
];

const REGISTRATION_CATEGORIES = [
  { value: "emd", label: "Exempt Market Dealer" },
  { value: "pm", label: "Portfolio Manager" },
  { value: "iiroc", label: "IIROC Dealer (CIRO)" },
  { value: "issuer", label: "Reporting Issuer" },
  { value: "none", label: "None / Outside Counsel" },
];

const TASK_TYPES = [
  { value: "om-review", label: "Review offering memo for gaps" },
  { value: "kyc-gap-check", label: "KYC/AML gap check" },
  { value: "marketing-signoff", label: "Marketing material sign-off" },
  { value: "response-memo", label: "Draft response / comfort memo" },
];

const TASK_ICONS: Record<string, string> = {
  "om-review": "OM",
  "kyc-gap-check": "KYC",
  "marketing-signoff": "MKT",
  "response-memo": "RSP",
};

const CLAIM_ICONS: Record<string, string> = {
  "false-advertising": "AD",
  "defective-product": "DEF",
  "hidden-fees": "FEE",
  "data-breach": "DAT",
  "privacy-misuse": "PRV",
  "unfair-terms": "TRM",
  "telemarketing-spam": "TEL",
  "price-fixing": "FIX",
  other: "OTH",
};

const CLAIM_LABELS: Record<string, string> = {
  "false-advertising": "False advertising",
  "defective-product": "Defective product",
  "hidden-fees": "Hidden fees",
  "data-breach": "Data breach",
  "privacy-misuse": "Privacy misuse",
  "unfair-terms": "Unfair terms",
  "telemarketing-spam": "Telemarketing / spam",
  "price-fixing": "Price fixing",
  other: "Other",
};

const POSTURE_LABELS: Record<string, string> = {
  investigation: "Investigation",
  "pre-litigation": "Pre-litigation",
  "proposed-class": "Proposed class",
  certification: "Certification",
  discovery: "Discovery",
  settlement: "Settlement",
  trial: "Trial",
  appeal: "Appeal",
  closed: "Closed",
};

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86_400_000);
}

const STATUS_BADGE: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "in-review": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  complete: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  // needs-revision: judge said ITERATE, round cap hit — soft stop, human
  // can pick up from the current draft.
  "needs-revision": "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  // blocked: judge said REWRITE or review errored — hard stop, don't
  // auto-rerun. Rose so it stands out from needs-revision in scan mode.
  blocked: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  archived: "bg-neutral-100 text-neutral-500 dark:bg-neutral-900 dark:text-neutral-500",
};

// Status filter chips, in the order a compliance lawyer scanning the list
// would triage them: attention-worthy states first (needs-revision, blocked),
// then in-progress, then done / new / archived. "all" is the default so
// existing behaviour is unchanged for users who don't click a filter.
const STATUS_FILTERS: Array<{ value: "all" | string; label: string }> = [
  { value: "all", label: "All" },
  { value: "needs-revision", label: "Needs revision" },
  { value: "blocked", label: "Blocked" },
  { value: "in-review", label: "In review" },
  { value: "open", label: "Open" },
  { value: "complete", label: "Complete" },
  { value: "archived", label: "Archived" },
];

export default function MattersPage() {
  const [matters, setMatters] = useState<Matter[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [jurisdiction, setJurisdiction] = useState("ontario");
  const [registrationCategory, setRegistrationCategory] = useState("emd");
  const [taskType, setTaskType] = useState("om-review");
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    void fetchMatters();
  }, []);

  async function fetchMatters() {
    try {
      const res = await fetch("/api/matters");
      if (res.ok) {
        const data = (await res.json()) as Matter[];
        setMatters(data);
      }
    } catch {
      // Preview mode may not have the API yet
    }
  }

  async function archiveMatter(id: string) {
    // Don't prompt on single-click archival — the matter stays recoverable
    // because the backend store keeps archived matters (the list just hides
    // them unless the Archived filter chip is selected). If we ever add a
    // hard-delete this should prompt first.
    try {
      const res = await fetch(`/api/matters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (res.ok) {
        setMatters((prev) => prev.map((m) => (m.id === id ? { ...m, status: "archived" } : m)));
      }
    } catch {
      /* ignore — UI retry is a page refresh */
    }
  }

  async function createMatter(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/matters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, jurisdiction, registrationCategory, taskType }),
      });
      if (res.ok) {
        setTitle("");
        setCreating(false);
        void fetchMatters();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Matters</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Select a matter or create a new one to start a compliance review.
          </p>
        </div>
        <Link
          href="/matters/new"
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
        >
          + New matter
        </Link>
      </div>

      {creating && (
        <form
          onSubmit={createMatter}
          className="mt-6 space-y-4 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
        >
          <div>
            <label className="block text-sm font-medium">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., ABC Capital OM Review — Q2 2026"
              className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium">Jurisdiction</label>
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              >
                {JURISDICTIONS.map((j) => (
                  <option key={j.value} value={j.value}>
                    {j.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Registration</label>
              <select
                value={registrationCategory}
                onChange={(e) => setRegistrationCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              >
                {REGISTRATION_CATEGORIES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium">Task</label>
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                className="mt-1 w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !title.trim()}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
            >
              {loading ? "Creating…" : "Create matter"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {matters.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.value === "all"
                ? matters.length
                : matters.filter((m) => m.status === f.value).length;
            const active = statusFilter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                disabled={count === 0 && f.value !== "all"}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {f.label} · {count}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {matters.length === 0 && !creating && (
          <div className="rounded-lg border border-dashed border-neutral-300 py-10 px-6 text-left dark:border-neutral-700">
            <p className="text-center text-neutral-500">No matters yet.</p>
            <p className="mt-1 text-center text-sm text-neutral-400">
              Create your first matter to start reviewing.
            </p>
            <div className="mt-6 mx-auto max-w-xl rounded-md bg-neutral-50 p-4 text-xs text-neutral-600 dark:bg-neutral-900/50 dark:text-neutral-300">
              <p className="font-medium text-neutral-700 dark:text-neutral-200">
                How it works
              </p>
              <ol className="mt-2 space-y-1 pl-5">
                <li>
                  1. <span className="font-medium">Pick a task type</span> — OM review,
                  PIPEDA, court AI-disclosure, contract redline, and more.
                </li>
                <li>
                  2. <span className="font-medium">Drop a document</span>. The app
                  classifies and routes it to the right Canadian-law reviewer.
                </li>
                <li>
                  3. <span className="font-medium">Review streams in</span> with
                  auto-verified citations — green <span className="font-mono">✓ verified</span>,
                  blue <span className="font-mono">↗ canlii</span>, or red if
                  the authority can&apos;t be located.
                </li>
                <li>
                  4. <span className="font-medium">Request approval</span> —
                  bound to the output hash, so any edit invalidates it.
                </li>
                <li>
                  5. <span className="font-medium">Export DOCX</span>. Blocked
                  until an approved approval binds to your output.
                </li>
              </ol>
            </div>
          </div>
        )}
        {matters
          .filter((m) => statusFilter === "all" || m.status === statusFilter)
          .map((m) => (
            <Link
              key={m.id}
              href={`/matters/${m.id}`}
              className="group flex items-center gap-4 rounded-lg border border-neutral-200 p-4 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900/50"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                m.claimType
                  ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                  : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              }`}>
                {m.claimType ? (CLAIM_ICONS[m.claimType] ?? "CL") : (TASK_ICONS[m.taskType] ?? "?")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-sm font-medium">{m.title}</h3>
                  {m.classActionFlag && (
                    <span className="shrink-0 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                      Class
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {m.clientName && m.opposingParty
                    ? `${m.clientName} v. ${m.opposingParty} · `
                    : m.clientName
                      ? `${m.clientName} · `
                      : ""}
                  {JURISDICTIONS.find((j) => j.value === m.jurisdiction)?.label ?? m.jurisdiction}
                  {m.claimType
                    ? ` · ${CLAIM_LABELS[m.claimType] ?? m.claimType}`
                    : ` · ${TASK_TYPES.find((t) => t.value === m.taskType)?.label ?? m.taskType}`}
                  {m.proceduralPosture && ` · ${POSTURE_LABELS[m.proceduralPosture] ?? m.proceduralPosture}`}
                </p>
                {(() => {
                  const days = daysUntil(m.nextDeadline ?? m.limitationDate);
                  if (days === null) return null;
                  const label = m.nextDeadlineLabel ?? (m.limitationDate ? "Limitation" : "Deadline");
                  return (
                    <p className={`mt-0.5 text-[10px] font-medium ${
                      days < 0 ? "text-red-600" : days <= 30 ? "text-amber-600" : "text-neutral-400"
                    }`}>
                      {label}: {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
                    </p>
                  );
                })()}
              </div>
              <span
                className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[m.status] ?? STATUS_BADGE.open}`}
              >
                {m.status}
              </span>
              {/* Archive action — hover-reveal to keep the row clean.
                  Stops propagation so clicking the button doesn't also
                  navigate to the matter page. Only offered on final
                  states; "open" and "in-review" matters shouldn't be
                  archived mid-flight. */}
              {m.status !== "archived" && m.status !== "open" && m.status !== "in-review" && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    void archiveMatter(m.id);
                  }}
                  className="ml-2 shrink-0 rounded-md px-2 py-1 text-[10px] text-neutral-400 opacity-0 transition-opacity hover:bg-neutral-200 hover:text-neutral-700 group-hover:opacity-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                  title="Archive this matter"
                >
                  Archive
                </button>
              )}
            </Link>
          ))}
      </div>
    </main>
  );
}
