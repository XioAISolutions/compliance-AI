import type { ReactNode } from "react";
import {
  MILAN_SCENARIO_TEXT,
  computeCognitiveRisk,
} from "../../../lib/demo/cognitive-risk";
import { getPartnerStatuses } from "../../../lib/demo/partner-status";
import { CognitiveRiskTester } from "./CognitiveRiskTester";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "XIO ProofOps Agent | Milan AI Week",
  description:
    "Autonomous proof, approval, and audit trails for regulated business decisions.",
};

const THESIS =
  "Most AI agents generate answers. XIO ProofOps generates defensible business evidence.";

const cognitiveRisk = computeCognitiveRisk(MILAN_SCENARIO_TEXT);

const workflow = [
  {
    agent: "Intake Agent",
    state: "Complete",
    detail: "Loaded investor deck, sales-call transcript, and risky marketing claim.",
    signal: "3 artifacts",
  },
  {
    agent: "Gemini Planner",
    state: "Complete",
    detail: "Split the matter into marketing-signoff, privacy, securities, and AI-use lanes.",
    signal: "4 lanes",
  },
  {
    agent: "Compliance Reviewer",
    state: "Complete",
    detail: "Checked unsupported guarantees, missing disclosures, privacy consent, and authority fit.",
    signal: "8 findings",
  },
  {
    agent: "BrainSNN Cognitive Risk Agent",
    state: "Complete",
    detail: "Scored pressure tactics, certainty language, trust erosion, and emotional activation.",
    signal: `${cognitiveRisk.score} risk`,
  },
  {
    agent: "Citation Verifier",
    state: "Verified",
    detail: "Matched source-pack citations and marked weak claims for manual verification.",
    signal: "6/7 verified",
  },
  {
    agent: "Redline Agent",
    state: "Ready",
    detail: "Rewrote risky claims into safer language while preserving the business intent.",
    signal: "5 edits",
  },
  {
    agent: "Approval Gate",
    state: "Waiting",
    detail: "Export remains blocked until approval binds to the exact output hash.",
    signal: "SHA-256",
  },
  {
    agent: "Export Agent",
    state: "Blocked",
    detail: "DOCX proof pack, exhibit appendix, transcript, and audit trail are queued.",
    signal: "proof pack",
  },
] as const;

const findings = [
  {
    label: "Guaranteed-outcome language",
    severity: "Critical",
    evidence: "The deck says returns are protected and predictable.",
    fix: "Replace guarantee with risk-qualified, evidence-backed performance language.",
  },
  {
    label: "Investor pressure pattern",
    severity: "High",
    evidence: "Transcript uses scarcity and urgency to compress buyer judgment.",
    fix: "Add balanced disclosure and cooling-off language before subscription steps.",
  },
  {
    label: "Privacy-consent gap",
    severity: "High",
    evidence: "Call recording is reviewed for lead scoring without clear consent wording.",
    fix: "Add explicit collection purpose, retention period, and consent capture.",
  },
  {
    label: "AI-use disclosure risk",
    severity: "Medium",
    evidence: "The workflow drafts filed material without a visible human review attestation.",
    fix: "Attach human approval, model-use note, and artifact hash to the export pack.",
  },
] as const;

const proofArtifacts = [
  "Risk-ranked claim table",
  "BrainSNN cognitive-risk receipt",
  "Verified citation ledger",
  "Redlined safer language",
  "Human approval hash",
  "Full audit trail",
] as const;

const endpoints = [
  ["GET", "/api/demo/milan", "Deterministic workflow JSON + partner statuses."],
  ["POST", "/api/demo/milan/cognitive-risk", "BrainSNN score over arbitrary { text }."],
  ["GET", "/api/demo/milan/plan", "Gemini-planned review lanes (deterministic fallback)."],
  ["GET", "/api/demo/milan/redline", "Featherless safer-language edits (fallback safe)."],
  ["GET", "/api/demo/milan/transcribe", "Canonical voice transcript + Speechmatics auth ping."],
  ["GET", "/api/demo/milan/proof-pack", "DOCX proof pack with live partner output rolled in."],
] as const;

const severityTone: Record<(typeof findings)[number]["severity"], "rose" | "amber" | "neutral"> = {
  Critical: "rose",
  High: "amber",
  Medium: "neutral",
};

const severityBorder: Record<(typeof findings)[number]["severity"], string> = {
  Critical: "border-l-rose-400/70",
  High: "border-l-amber-300/70",
  Medium: "border-l-white/20",
};

export default function MilanDemoPage() {
  const partners = getPartnerStatuses();
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:py-14">
        {/* ─────────── HERO ─────────── */}
        <section className="relative overflow-hidden rounded-[2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_34%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(10,10,10,0.98))] p-6 shadow-2xl shadow-cyan-950/30 lg:p-12">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300">
                Milan AI Week Hackathon
              </p>
              <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
                XIO ProofOps Agent
              </h1>
              <p className="mt-6 text-xl text-neutral-200 sm:text-2xl">
                Autonomous proof, approval, and audit trails for regulated business decisions.
              </p>
              <blockquote className="mt-8 border-l-2 border-cyan-300/60 pl-5 text-lg italic leading-relaxed text-cyan-50 sm:text-xl">
                &ldquo;{THESIS}&rdquo;
              </blockquote>
              <p className="mt-6 max-w-2xl text-sm leading-6 text-neutral-400">
                Drop a deck, contract, policy, or voice transcript. The agent classifies the risk,
                plans the review with Gemini, verifies citations, scores cognitive manipulation,
                drafts safer redlines on Featherless, binds human approval to the output hash, and
                queues an audit-ready DOCX proof pack.
              </p>

              <div className="mt-8 flex flex-wrap gap-3 text-sm">
                <a
                  href="/api/demo/milan/proof-pack"
                  className="rounded-full bg-cyan-300 px-6 py-3 font-semibold text-neutral-950 shadow-lg shadow-cyan-300/20 transition hover:bg-cyan-200"
                >
                  Download proof pack (.docx)
                </a>
                <a
                  href="#try-it"
                  className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-6 py-3 font-semibold text-cyan-100 transition hover:bg-cyan-300/20"
                >
                  Try BrainSNN live →
                </a>
                <a
                  href="/api/demo/milan"
                  className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  View JSON
                </a>
                <a
                  href="/matters/new"
                  className="rounded-full border border-white/15 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Open full matter wizard
                </a>
              </div>
            </div>

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
              <Metric label="Decision lanes" value="4" detail="securities · privacy · marketing · AI-use" />
              <Metric
                label="Cognitive risk"
                value={`${cognitiveRisk.score}/100`}
                detail="derived live from deck + transcript text"
              />
              <Metric label="Citations" value="6/7" detail="verified against offline corpus" />
              <Metric label="Export gate" value="locked" detail="awaiting hash-bound approval" />
            </div>
          </div>
        </section>

        {/* ─────────── WORKFLOW BAND ─────────── */}
        <section className="mt-14">
          <SectionHeader
            eyebrow="The autonomous proof run"
            title="8 agents. One shipping artifact."
            subtitle="A workflow, not a chatbot. Every step writes to the audit trail."
            chip="autonomous proof run"
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((step, index) => (
              <article
                key={step.agent}
                className="relative flex h-full flex-col rounded-2xl border border-white/10 bg-neutral-900/70 p-5 transition hover:border-cyan-300/30 hover:bg-neutral-900/90"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-300 text-sm font-bold text-neutral-950">
                    {index + 1}
                  </span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-neutral-300">
                    {step.state}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{step.agent}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-400">{step.detail}</p>
                <div className="mt-4 inline-flex w-fit rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  {step.signal}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ─────────── BRAINSNN + INTERACTIVE TESTER ─────────── */}
        <section id="try-it" className="mt-14">
          <SectionHeader
            eyebrow="BrainSNN cognitive-risk agent"
            title="Compliance checks legality. BrainSNN checks judgment."
            subtitle="The score is derived from the input text — change the words, watch it move."
            chip="lexical · deterministic"
          />
          <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white">Canonical scenario</h3>
                  <p className="mt-1 text-sm text-neutral-400">
                    Investor deck + sales-call transcript + marketing claim.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-5xl font-semibold text-rose-300">{cognitiveRisk.score}</div>
                  <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">composite</div>
                </div>
              </div>
              <div className="mt-6 grid gap-3 text-sm">
                <RiskBar label="Emotional activation" value={cognitiveRisk.dimensions.emotionalActivation} />
                <RiskBar label="Certainty pressure" value={cognitiveRisk.dimensions.certaintyPressure} />
                <RiskBar label="Trust erosion" value={cognitiveRisk.dimensions.trustErosion} />
                <RiskBar label="Urgency compression" value={cognitiveRisk.dimensions.urgencyCompression} />
              </div>
              <p className="mt-6 text-xs text-neutral-500">
                Saturation thresholds tuned so canonical Milan input lands at 78/100. Patterns + weights live in{" "}
                <code className="font-mono text-neutral-300">lib/demo/cognitive-risk.ts</code>.
              </p>
            </div>

            <CognitiveRiskTester initialText={MILAN_SCENARIO_TEXT} />
          </div>
        </section>

        {/* ─────────── FINDINGS + PROOF PACK ─────────── */}
        <section className="mt-14">
          <SectionHeader
            eyebrow="Evidence the workflow ships"
            title="Findings and the artifact that carries them."
            subtitle="Every finding is hash-bound. Approval invalidates on edit. Export emits a DOCX."
            chip="export gated"
          />
          <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
              <h3 className="text-lg font-semibold text-white">Risk findings</h3>
              <p className="mt-1 text-sm text-neutral-400">
                Ranked by severity, every finding carries evidence + a proposed fix.
              </p>
              <div className="mt-5 space-y-3">
                {findings.map((finding) => (
                  <article
                    key={finding.label}
                    className={`rounded-2xl border border-white/10 border-l-4 ${severityBorder[finding.severity]} bg-neutral-900/70 p-4`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h4 className="font-semibold text-white">{finding.label}</h4>
                      <Badge tone={severityTone[finding.severity]}>{finding.severity}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-neutral-400">
                      <span className="font-semibold text-neutral-300">Evidence:</span> {finding.evidence}
                    </p>
                    <p className="mt-2 text-sm text-cyan-100">
                      <span className="font-semibold">Fix:</span> {finding.fix}
                    </p>
                  </article>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-cyan-300/[0.06] via-white/[0.03] to-transparent p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-white">Proof pack</h3>
                <Badge tone="cyan">DOCX</Badge>
              </div>
              <p className="mt-1 text-sm text-neutral-400">
                The artifact a compliance officer keeps. Findings, redline summary, cognitive-risk
                receipt, output + approval hashes, and the full audit trail — in one file.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {proofArtifacts.map((artifact) => (
                  <div
                    key={artifact}
                    className="flex items-start gap-2 rounded-xl border border-white/10 bg-neutral-900/60 p-3 text-sm text-neutral-300"
                  >
                    <span className="mt-0.5 text-cyan-300">✓</span>
                    <span>{artifact}</span>
                  </div>
                ))}
              </div>
              <a
                href="/api/demo/milan/proof-pack"
                className="mt-6 flex items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-5 py-4 text-base font-semibold text-neutral-950 shadow-lg shadow-cyan-300/20 transition hover:bg-cyan-200"
              >
                Download proof pack (.docx)
                <span aria-hidden>↓</span>
              </a>
              <p className="mt-3 text-center text-xs text-neutral-500">
                Headers expose <code className="font-mono text-neutral-300">X-ProofPack-OutputHash</code> and
                each partner&apos;s source so judges can verify the evidence chain from curl.
              </p>
            </div>
          </div>
        </section>

        {/* ─────────── PARTNER ROW ─────────── */}
        <section className="mt-14">
          <SectionHeader
            eyebrow="Sponsor tracks"
            title="Partner-category fit."
            subtitle="Every integration is env-var driven. Set the keys on the host and the rows flip from stub to live."
            chip="env-var driven"
          />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {partners.map((partner) => (
              <article
                key={partner.id}
                className={`flex h-full flex-col rounded-2xl border p-5 transition ${
                  partner.live
                    ? "border-emerald-300/30 bg-emerald-300/[0.04]"
                    : "border-white/10 bg-neutral-900/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-semibold text-white">{partner.name}</div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                      partner.live
                        ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200"
                        : "border-white/15 bg-white/5 text-neutral-400"
                    }`}
                    title={partner.envVar ?? undefined}
                  >
                    {partner.live ? "● live" : "○ stub"}
                  </span>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-400">{partner.role}</p>
                {partner.envVar && (
                  <p className="mt-4 font-mono text-[11px] text-neutral-500">
                    {partner.envVar}
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* ─────────── LIVE ENDPOINTS ─────────── */}
        <section className="mt-14 rounded-3xl border border-white/10 bg-white/[0.03] p-6 lg:p-8">
          <SectionHeader
            eyebrow="Technical evidence"
            title="Live endpoints judges can poke."
            subtitle="Every workflow step has a public route. Curl, devtools, Postman — same shape every time."
            chip="no auth"
            compact
          />
          <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-neutral-900/80 text-xs uppercase tracking-wider text-neutral-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Endpoint</th>
                  <th className="px-4 py-3 font-semibold">What it returns</th>
                </tr>
              </thead>
              <tbody className="text-neutral-300">
                {endpoints.map(([method, endpoint, desc]) => (
                  <tr key={endpoint} className="border-t border-white/10 odd:bg-neutral-950/50">
                    <td className="px-4 py-3 font-mono text-xs text-cyan-200">{method}</td>
                    <td className="px-4 py-3 font-mono text-xs text-cyan-100">{endpoint}</td>
                    <td className="px-4 py-3 text-neutral-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─────────── CLOSING THESIS ─────────── */}
        <section className="mt-14 overflow-hidden rounded-[2rem] border border-cyan-300/30 bg-[radial-gradient(circle_at_bottom_right,_rgba(34,211,238,0.22),_transparent_42%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(10,10,10,0.98))] p-8 text-center shadow-2xl shadow-cyan-950/30 lg:p-14">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-cyan-300">
            submission line
          </p>
          <blockquote className="mx-auto mt-6 max-w-4xl text-2xl font-semibold leading-snug text-white sm:text-3xl lg:text-4xl">
            &ldquo;{THESIS}&rdquo;
          </blockquote>
          <p className="mt-6 text-sm text-neutral-400">
            Submission packet: <code className="font-mono text-neutral-300">docs/MILAN_SUBMISSION.md</code>{" "}
            · Architecture brief: <code className="font-mono text-neutral-300">docs/HACKATHON_MILAN.md</code>
          </p>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  chip,
  compact,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  chip?: string;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">{eyebrow}</p>
        <h2
          className={`${compact ? "mt-2 text-2xl" : "mt-3 text-3xl sm:text-4xl"} font-semibold tracking-tight text-white`}
        >
          {title}
        </h2>
        {subtitle && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-400">{subtitle}</p>}
      </div>
      {chip && <Badge tone="cyan">{chip}</Badge>}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/60 p-4">
      <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-neutral-400">{detail}</div>
    </div>
  );
}

function Badge({ children, tone }: { children: ReactNode; tone: "cyan" | "rose" | "amber" | "neutral" }) {
  const tones = {
    cyan: "border-cyan-300/30 bg-cyan-300/10 text-cyan-100",
    rose: "border-rose-300/30 bg-rose-300/10 text-rose-100",
    amber: "border-amber-300/30 bg-amber-300/10 text-amber-100",
    neutral: "border-white/15 bg-white/10 text-neutral-200",
  };
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

function RiskBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-neutral-400">
        <span>{label}</span>
        <span>{clamped}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-cyan-300" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
