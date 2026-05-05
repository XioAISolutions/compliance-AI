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
  type TriadAuditRow,
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

      <ReadPath />

      {/* 0. One answer vs Triad — the originality story, made visible.
            A generic legal-AI chatbot would return one confident paragraph for
            this same input. The Triad found 3 critical gaps, 5 verified
            citations, and 1 material disagreement. Both columns are seeded;
            no LLM call. */}
      <OneAnswerVsTriadPanel />

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
            <ApprovalAction
              label="Export DOCX"
              enabled={true}
              href="/api/demo/handoff/docx"
              reason="Demo render — production export is gated on the output hash above"
            />
            <ApprovalAction
              label="Export redline PDF"
              enabled={true}
              href="/api/demo/handoff/pdf"
              reason="Demo render — production export is gated on the output hash above"
            />
            <ApprovalAction
              label="Download CRUMB handoff pack"
              enabled={true}
              href="/api/demo/handoff"
              reason="Available — handoff pack is read-only and safe to export"
            />
          </div>
        </div>
        <p className="mt-3 text-[10px] text-neutral-500">
          Demo mode: all three buttons return seeded artifacts so a judge can see the shape of each
          export. In production the DOCX and redline-PDF endpoints are gated on a human approver
          signing the output hash above; only the CRUMB handoff pack ships unconditionally because
          it is a read-only audit trail.
        </p>

        {/* Inline audit-row preview — the chain a regulator would see if
            they asked "show me your work." Hash-chained, tamper-evident,
            provider-stamped. Default-collapsed so it doesn't dominate the
            primary scan; a curious judge can expand it. */}
        <details
          id="audit-chain"
          className="mt-4 rounded border border-neutral-200 bg-white p-3 text-xs dark:border-neutral-800 dark:bg-black"
        >
          <summary className="cursor-pointer text-[10px] font-medium uppercase tracking-wide text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
            Show audit chain ({m.auditRows.length} rows · hash-linked · provider-stamped)
          </summary>
          <p className="mt-2 text-[10px] text-neutral-500">
            Each row records actor, action, input/output hash, prev-row hash, authorities cited, and
            which provider/model served it. The chain is what a regulator receives in a CRUMB
            handoff pack.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left font-mono text-[10px]">
              <thead>
                <tr className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
                  <th className="py-1 pr-3 font-medium">#</th>
                  <th className="py-1 pr-3 font-medium">Actor · Action</th>
                  <th className="py-1 pr-3 font-medium">Output hash</th>
                  <th className="py-1 pr-3 font-medium">↳ chains to prev</th>
                  <th className="py-1 pr-3 font-medium">Authorities</th>
                  <th className="py-1 font-medium">Served by</th>
                </tr>
              </thead>
              <tbody className="text-neutral-700 dark:text-neutral-300">
                {m.auditRows.map((r) => (
                  <AuditRowLine key={r.sequence} row={r} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-neutral-500">
            Notice every row's <code>servedBy</code> stamp. A review run tomorrow on OpenAI would
            produce the <em>same audit shape</em> with a different stamp — that&apos;s what
            &ldquo;provider abstraction beats vendor lock-in&rdquo; means in practice.
          </p>
        </details>
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
            Optional live debate →
          </Link>
          <Link
            href="/api/demo/handoff"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-[11px] hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Download CRUMB handoff pack
          </Link>
          <Link
            href="https://github.com/XioAISolutions/compliance-AI/tree/feat/amd-mi300x-vllm"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-[11px] hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            target="_blank"
            rel="noopener"
          >
            Source branch
          </Link>
        </div>
      </footer>
    </main>
  );
}

function ReadPath() {
  const steps = [
    "Compare one answer vs Triad",
    "Scan the six findings",
    "Check disagreement and export gate",
    "Open the audit chain",
  ];

  return (
    <section className="mb-5 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
            Read this in 90 seconds
          </p>
          <p className="mt-1 text-sm font-medium">
            Start at the comparison, then follow the evidence trail to the approval gate.
          </p>
        </div>
        <Link
          href="#audit-chain"
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-[11px] font-medium text-neutral-700 hover:bg-white dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-black"
        >
          Jump to audit chain
        </Link>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step}
            className="rounded border border-neutral-200 bg-white px-3 py-2 text-xs dark:border-neutral-800 dark:bg-black"
          >
            <span className="mr-1 font-mono text-[10px] text-neutral-500">
              {String(index + 1).padStart(2, "0")}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </section>
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
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <span className="text-[10px] font-medium uppercase text-neutral-500">{k}</span>
      <span className="min-w-0 break-all text-right text-xs text-neutral-700 dark:text-neutral-300">
        {v}
      </span>
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
        className="flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-medium hover:bg-neutral-50 dark:border-white dark:bg-black dark:hover:bg-neutral-900"
      >
        <span>{label} →</span>
        <span className="text-right text-[10px] font-normal text-neutral-500">{reason}</span>
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-400 dark:border-neutral-700 dark:bg-neutral-900">
      <span>{label}</span>
      <span className="text-right text-[10px]">{reason}</span>
    </div>
  );
}

/**
 * The "One answer vs Triad" comparison — the originality story made visible.
 * Left column: what a generic legal-AI chatbot would say (confident, uncited,
 * no disagreement). Right column: what XIO's Triad found on the same input
 * (gaps, citations, disagreement, export-blocked). Both columns are seeded
 * from triad-seed.ts; no LLM call.
 *
 * Placed above the matter strip on /demo/judge so the contrast is the first
 * thing a judge sees after the page header.
 */
function OneAnswerVsTriadPanel() {
  const m = TRIAD_DEMO_MATTER;
  const generic = m.genericSingleAnswer;
  return (
    <section className="mb-5 grid gap-3 lg:grid-cols-2">
      <article className="rounded-lg border-2 border-rose-300 bg-rose-50/40 p-4 dark:border-rose-800 dark:bg-rose-950/30">
        <header className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-rose-700 dark:text-rose-300">
            What a single-answer tool would return
          </p>
          <span className="rounded-full bg-rose-200 px-2 py-0.5 text-[10px] font-medium text-rose-900 dark:bg-rose-900 dark:text-rose-200">
            {generic.toolKind}
          </span>
        </header>
        <p className="mt-3 text-xs italic leading-relaxed text-neutral-700 dark:text-neutral-300">
          &ldquo;{generic.answer}&rdquo;
        </p>
        <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-rose-700 dark:text-rose-300">
          What it&apos;s missing
        </p>
        <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300">
          {generic.missing.map((line, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-1 inline-block h-1 w-1 flex-none rounded-full bg-rose-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </article>

      <article className="rounded-lg border-2 border-emerald-400 bg-emerald-50/40 p-4 dark:border-emerald-700 dark:bg-emerald-950/30">
        <header className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            What XIO Triad found
          </p>
          <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200">
            3 reviewers · 1 GPU
          </span>
        </header>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <CompareStat label="Critical gaps" value={String(m.criticalGapCount)} tone="danger" />
          <CompareStat
            label="Verified citations"
            value={String(m.verifiedCitationCount)}
            tone="ok"
          />
          <CompareStat
            label="Material disagreement"
            value={`${m.reviewerDisagreementCount} issue${m.reviewerDisagreementCount === 1 ? "" : "s"}`}
            tone="warn"
          />
          <CompareStat
            label="Compliance score"
            value={`${m.complianceScore}%`}
            tone={m.complianceScore >= 80 ? "ok" : "warn"}
          />
        </dl>
        <p className="mt-3 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          What you also get
        </p>
        <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-neutral-700 dark:text-neutral-300">
          <li className="flex gap-2">
            <span className="mt-1 inline-block h-1 w-1 flex-none rounded-full bg-emerald-500" />
            <span>Every finding cites a verifiable authority — or is flagged as unsupported.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1 inline-block h-1 w-1 flex-none rounded-full bg-emerald-500" />
            <span>Export is blocked until a human approves the SHA-256 output hash.</span>
          </li>
          <li className="flex gap-2">
            <span className="mt-1 inline-block h-1 w-1 flex-none rounded-full bg-emerald-500" />
            <span>Audit chain (6 hash-linked rows) records every decision and provider stamp.</span>
          </li>
        </ul>
      </article>
      <p className="text-center text-[11px] italic text-neutral-500 lg:col-span-2">
        Both columns took the same input. One is dangerous in compliance.
      </p>
    </section>
  );
}

function CompareStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "danger";
}) {
  const toneClass =
    tone === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "text-amber-700 dark:text-amber-300"
        : "text-rose-700 dark:text-rose-300";
  return (
    <div className="rounded border border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-black">
      <dt className="text-[9px] font-medium uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold ${toneClass}`}>{value}</dd>
    </div>
  );
}

/**
 * Single audit_log row, rendered as a table row inside the inline audit
 * chain preview. Hashes are abbreviated to first 12 chars to fit the
 * visual rhythm; the full value is in the `title` tooltip.
 */
function AuditRowLine({ row }: { row: TriadAuditRow }) {
  return (
    <tr className="border-b border-neutral-100 align-top last:border-b-0 dark:border-neutral-900">
      <td className="py-2 pr-3">{row.sequence}</td>
      <td className="py-2 pr-3">
        <div>{row.actor}</div>
        <div className="text-neutral-500">{row.action}</div>
      </td>
      <td className="py-2 pr-3" title={row.outputHash}>
        {abbreviateHash(row.outputHash)}
      </td>
      <td className="py-2 pr-3" title={row.prevRowHash ?? "(no previous row — chain origin)"}>
        {row.prevRowHash ? abbreviateHash(row.prevRowHash) : "—"}
      </td>
      <td className="py-2 pr-3">
        {row.authoritiesUsed.length === 0 ? "—" : `${row.authoritiesUsed.length} cited`}
        {row.judgeVerdict && (
          <div className="text-[9px] uppercase text-amber-700 dark:text-amber-300">
            verdict: {row.judgeVerdict}
          </div>
        )}
      </td>
      <td className="py-2" title={row.servedBy}>
        {abbreviateProvider(row.servedBy)}
      </td>
    </tr>
  );
}

function abbreviateHash(h: string): string {
  // sha256:abc123... → sha256:abc123…
  const colon = h.indexOf(":");
  if (colon < 0) return h.slice(0, 12) + "…";
  return `${h.slice(0, colon + 1)}${h.slice(colon + 1, colon + 9)}…`;
}

function abbreviateProvider(p: string): string {
  // amd_vllm/Qwen/Qwen2.5-72B-Instruct → amd_vllm/Qwen2.5-72B
  const parts = p.split("/");
  if (parts.length < 2) return p;
  const tail = parts[parts.length - 1]?.replace(/-Instruct$/i, "") ?? "";
  return `${parts[0]}/${tail}`;
}
