/**
 * /demo/judge — the 90-second judge demo.
 *
 * One-click seeded compliance review of an Ontario OM excerpt. Loads the
 * triad seed, no upload, no API call, no AMD-credit spend. Designed to
 * answer the six judge-questions in 90 seconds:
 *   1. What document/matter is being reviewed?
 *   2. What risks were found?
 *   3. What citations support the findings?
 *   4. Where did the AI reviewers disagree?
 *   5. What should the user do next?
 *   6. Can this output be approved/exported?
 */

import Link from "next/link";
import {
  TRIAD_DEMO_MATTER,
  TRIAD_REVIEWERS,
  type CitationBadge,
  type TriadCitation,
  type TriadFinding,
  type TriadReviewerId,
} from "../../../lib/triad-seed";

export const dynamic = "force-static";

const SEVERITY_STYLES: Record<TriadFinding["severity"], string> = {
  critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  low: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

const REVIEWER_ACCENT: Record<
  TriadReviewerId,
  { border: string; pill: string; dot: string; text: string }
> = {
  counsel: {
    border: "border-blue-300 dark:border-blue-800",
    pill: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-300",
  },
  risk: {
    border: "border-amber-300 dark:border-amber-800",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
  },
  evidence: {
    border: "border-emerald-300 dark:border-emerald-800",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-300",
  },
};

const BADGE_LABELS: Record<CitationBadge, { label: string; className: string }> = {
  verified: {
    label: "Verified",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  "needs-check": {
    label: "Needs manual check",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  },
  "missing-authority": {
    label: "Missing authority",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  stale: {
    label: "Stale authority",
    className: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  },
  "jurisdiction-mismatch": {
    label: "Jurisdiction mismatch",
    className: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  },
};

export default function JudgeDemoPage() {
  const m = TRIAD_DEMO_MATTER;
  const counselFindings = m.findings.filter((f) => f.raisedBy === "counsel");
  const riskFindings = m.findings.filter((f) => f.raisedBy === "risk");
  const evidenceFindings = m.findings.filter((f) => f.raisedBy === "evidence");

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6">
        <Link href="/" className="text-xs text-neutral-500 hover:underline">
          ← XIO Compliance Brain
        </Link>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <h1 className="text-3xl font-semibold sm:text-4xl">90-second judge demo</h1>
          <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white dark:bg-white dark:text-neutral-900">
            Demo mode · seeded
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-neutral-600 dark:text-neutral-400">
          A pre-recorded Triad Review of an Ontario offering memorandum. Three reviewers, verified
          citations, surfaced disagreement, hash-bound approval. No upload required — read top to
          bottom.
        </p>
      </header>

      {/* 1. Matter strip */}
      <section className="mb-5 rounded-lg border-2 border-neutral-900 bg-neutral-50 p-4 dark:border-white dark:bg-neutral-900">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase text-neutral-500">Matter</p>
            <h2 className="mt-1 text-xl font-semibold">{m.title}</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {m.documentType} · {m.jurisdiction} · {m.registrationCategory} · NI 45-106
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Stat label="Compliance score" value={`${m.complianceScore}%`} tone="neutral" />
            <Stat
              label="Critical gaps"
              value={String(m.criticalGapCount)}
              tone={m.criticalGapCount > 0 ? "danger" : "ok"}
            />
            <Stat label="Verified citations" value={String(m.verifiedCitationCount)} tone="ok" />
            <Stat
              label="Needs verification"
              value={String(m.needsVerificationCount)}
              tone={m.needsVerificationCount > 0 ? "warn" : "ok"}
            />
            <Stat
              label="Reviewer disagreement"
              value={`${m.reviewerDisagreementCount} material`}
              tone={m.reviewerDisagreementCount > 0 ? "warn" : "ok"}
            />
            <Stat label="Export" value="Blocked · pending approval" tone="danger" />
          </div>
        </div>
        <div className="mt-3 rounded border border-neutral-200 bg-white p-3 text-xs leading-relaxed text-neutral-700 dark:border-neutral-800 dark:bg-black dark:text-neutral-300">
          <span className="text-[10px] font-medium uppercase text-neutral-500">
            Excerpt under review
          </span>
          <p className="mt-1 italic">&ldquo;{m.documentExcerpt}&rdquo;</p>
          <p className="mt-2 text-[10px] text-neutral-500">
            Reviewer instruction: {m.reviewerInstruction}
          </p>
        </div>
      </section>

      {/* 2. The three reviewers */}
      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        {TRIAD_REVIEWERS.map((rev) => {
          const accent = REVIEWER_ACCENT[rev.id];
          const findingsForReviewer =
            rev.id === "counsel"
              ? counselFindings
              : rev.id === "risk"
                ? riskFindings
                : evidenceFindings;
          return (
            <article
              key={rev.id}
              className={`flex flex-col rounded-lg border-2 p-4 ${accent.border}`}
            >
              <header className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${accent.dot}`} />
                <h3 className="text-sm font-semibold">{rev.name}</h3>
              </header>
              <p className={`mt-1 text-[10px] uppercase tracking-wide ${accent.text}`}>
                {rev.role}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                {rev.description}
              </p>
              <p className="mt-3 text-[10px] text-neutral-500">
                Raised {findingsForReviewer.length} finding
                {findingsForReviewer.length === 1 ? "" : "s"} on this matter.
              </p>
            </article>
          );
        })}
      </section>

      {/* 3. Findings */}
      <section className="mb-5">
        <p className="mb-2 text-[10px] font-medium uppercase text-neutral-500">
          Findings · {m.findings.length} total · {m.recommendedFixCount} recommended fixes
        </p>
        <ul className="space-y-3">
          {m.findings.map((f) => {
            const reviewer = TRIAD_REVIEWERS.find((r) => r.id === f.raisedBy)!;
            const accent = REVIEWER_ACCENT[f.raisedBy];
            return (
              <li
                key={f.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950"
              >
                <header className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${SEVERITY_STYLES[f.severity]}`}
                    >
                      {f.severity}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${accent.pill}`}
                    >
                      {reviewer.name}
                    </span>
                  </div>
                </header>
                <p className="mt-2 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                  {f.detail}
                </p>
                <p className="mt-2 rounded border border-neutral-200 bg-neutral-50 p-2 text-xs leading-relaxed text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
                  <span className="text-[10px] font-medium uppercase text-neutral-500">
                    Recommended fix
                  </span>
                  <br />
                  {f.recommendedFix}
                </p>
                {f.citations.length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {f.citations.map((c) => (
                      <CitationRow key={c.id} citation={c} />
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs italic text-red-600 dark:text-red-400">
                    No citation attached — Evidence Auditor would refuse to sign off until a
                    verifiable authority is supplied.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* 4. Disagreement panel */}
      <section className="mb-5 rounded-lg border-2 border-amber-300 bg-amber-50/40 p-4 dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-[10px] font-medium uppercase text-amber-700 dark:text-amber-300">
          Where reviewers disagreed · {m.disagreements.length} material issue
          {m.disagreements.length === 1 ? "" : "s"}
        </p>
        {m.disagreements.map((d) => (
          <div key={d.id} className="mt-2">
            <h3 className="text-sm font-semibold">{d.issue}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {TRIAD_REVIEWERS.map((rev) => {
                const accent = REVIEWER_ACCENT[rev.id];
                return (
                  <div
                    key={rev.id}
                    className={`rounded border ${accent.border} bg-white p-3 dark:bg-black`}
                  >
                    <p className={`text-[10px] font-semibold uppercase ${accent.text}`}>
                      {rev.name}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                      {d.views[rev.id]}
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 rounded border-2 border-neutral-900 bg-white p-3 text-xs font-medium leading-relaxed text-neutral-900 dark:border-white dark:bg-black dark:text-white">
              <span className="text-[10px] uppercase text-neutral-500">Final action</span>
              <br />
              {d.finalAction}
            </p>
          </div>
        ))}
      </section>

      {/* 5. Approval / export gate */}
      <section className="mb-5 rounded-lg border-2 border-rose-300 bg-rose-50/40 p-4 dark:border-rose-800 dark:bg-rose-950/30">
        <p className="text-[10px] font-medium uppercase text-rose-700 dark:text-rose-300">
          Approval required before export
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 text-xs">
            <Row k="Output hash" v={<code className="font-mono">{m.approval.outputHash}</code>} />
            <Row
              k="Reviewer status"
              v={<UpperBadge value={m.approval.reviewerStatus} tone="warn" />}
            />
            <Row
              k="Approval state"
              v={<UpperBadge value={m.approval.approvalState} tone="warn" />}
            />
            <Row k="Export state" v={<UpperBadge value={m.approval.exportState} tone="danger" />} />
            <Row k="Last modified" v={new Date(m.approval.lastModified).toLocaleString()} />
          </div>
          <div className="space-y-2">
            <ApprovalAction label="Export DOCX" enabled={false} reason="Approval pending" />
            <ApprovalAction label="Export redline" enabled={false} reason="Approval pending" />
            <ApprovalAction
              label="Download CRUMB handoff pack"
              enabled={true}
              href="/api/demo/handoff"
              reason="Available — handoff pack is read-only and safe to export"
            />
          </div>
        </div>
        <p className="mt-3 text-[10px] text-neutral-500">
          Demo mode: DOCX/redline buttons are disabled to demonstrate the export gate. The CRUMB
          handoff endpoint is real — clicking it returns the seeded YAML/markdown audit pack that
          production matters export.
        </p>
      </section>

      {/* 6. AMD technical panel */}
      <section className="mb-5 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <p className="text-[10px] font-medium uppercase text-neutral-500">Why AMD matters</p>
        <h3 className="mt-1 text-sm font-semibold">Triad Review on AMD Instinct MI300X</h3>
        <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
          <Row k="Model" v={m.amd.modelId} />
          <Row k="Owner" v={m.amd.modelOwner} />
          <Row k="Serving" v={m.amd.servingEngine} />
          <Row k="Hardware target" v={m.amd.hardwareTarget} />
          <Row k="Workflow" v={m.amd.workflow} />
          <Row
            k="Live healthcheck"
            v={
              <Link href="/api/healthcheck/llm" className="font-mono text-blue-600 hover:underline">
                /api/healthcheck/llm
              </Link>
            }
          />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
          {m.amd.benefit}
        </p>
        <p className="mt-2 text-[10px] text-neutral-500">{m.amd.hostedPreviewDisclosure}</p>
      </section>

      {/* Footer disclosure + next steps */}
      <footer className="mb-12 rounded-lg border border-dashed border-neutral-300 p-4 text-xs text-neutral-500 dark:border-neutral-700">
        <p>{m.disclosure}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/demo/debate"
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Run a live debate →
          </Link>
          <Link
            href="/queue"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-[11px] hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Open the risk queue
          </Link>
          <Link
            href="/approvals"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-[11px] hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            View approvals
          </Link>
        </div>
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : tone === "danger"
          ? "text-rose-700 dark:text-rose-300"
          : "text-neutral-900 dark:text-white";
  return (
    <div className="rounded border border-neutral-200 bg-white p-2 text-right dark:border-neutral-800 dark:bg-black">
      <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function CitationRow({ citation }: { citation: TriadCitation }) {
  const badge = BADGE_LABELS[citation.badge];
  return (
    <li className="flex flex-wrap items-start gap-2 rounded border border-neutral-200 bg-neutral-50 p-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
        title={citation.badgeReason}
      >
        {badge.label}
      </span>
      <div className="flex-1">
        <p className="font-medium text-neutral-700 dark:text-neutral-200">
          {citation.authorityTitle} · <span className="text-neutral-500">{citation.section}</span>
        </p>
        <p className="mt-1 italic text-neutral-600 dark:text-neutral-400">
          &ldquo;{citation.quote}&rdquo;
        </p>
        <p className="mt-1 text-[10px] text-neutral-500">{citation.badgeReason}</p>
      </div>
    </li>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[10px] font-medium uppercase text-neutral-500">{k}</span>
      <span className="text-right text-xs text-neutral-700 dark:text-neutral-300">{v}</span>
    </div>
  );
}

function UpperBadge({ value, tone }: { value: string; tone: "ok" | "warn" | "danger" }) {
  const className =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : tone === "warn"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${className}`}>
      {value.replace(/-/g, " ")}
    </span>
  );
}

function ApprovalAction({
  label,
  enabled,
  href,
  reason,
}: {
  label: string;
  enabled: boolean;
  href?: string;
  reason: string;
}) {
  if (enabled && href) {
    return (
      <Link
        href={href}
        className="flex items-center justify-between rounded-md border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium hover:bg-neutral-50 dark:border-white dark:bg-black dark:hover:bg-neutral-900"
      >
        <span>{label} →</span>
        <span className="text-[10px] font-normal text-neutral-500">{reason}</span>
      </Link>
    );
  }
  return (
    <div className="flex items-center justify-between rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900">
      <span>{label}</span>
      <span className="text-[10px]">{reason}</span>
    </div>
  );
}
