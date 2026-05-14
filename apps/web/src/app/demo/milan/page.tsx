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

export default function MilanDemoPage() {
  const partners = getPartnerStatuses();
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <section className="mx-auto max-w-7xl px-6 py-10 lg:py-14">
        <div className="rounded-[2rem] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.22),_transparent_34%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(10,10,10,0.98))] p-6 shadow-2xl shadow-cyan-950/30 lg:p-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300">
                Milan AI Week Hackathon
              </p>
              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-white sm:text-6xl">
                XIO ProofOps Agent
              </h1>
              <p className="mt-5 text-xl text-neutral-300">
                Autonomous proof, approval, and audit trails for regulated business decisions.
              </p>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-400">
                Upload a deck, contract, policy, or voice transcript. The agent classifies the risk,
                plans the review, verifies the claims, scores cognitive manipulation, proposes safer
                language, binds human approval to the output hash, and queues an audit-ready proof pack.
              </p>
            </div>
            <div className="grid min-w-72 gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm backdrop-blur">
              <Metric label="Decision lanes" value="4" detail="securities, privacy, marketing, AI-use" />
              <Metric
                label="Cognitive risk"
                value={`${cognitiveRisk.score}/100`}
                detail="derived from deck + transcript text"
              />
              <Metric label="Export gate" value="locked" detail="awaiting hash-bound approval" />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <a
              href="/api/demo/milan/proof-pack"
              className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-neutral-950 hover:bg-cyan-200"
            >
              Download proof pack (.docx)
            </a>
            <a
              href="/api/demo/milan"
              className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white hover:bg-white/10"
            >
              View deterministic JSON
            </a>
            <a
              href="/matters/new"
              className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white hover:bg-white/10"
            >
              Open full matter wizard
            </a>
          </div>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">90-second agent timeline</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  The demo is shaped as a workflow, not a chatbot.
                </p>
              </div>
              <Badge tone="cyan">autonomous proof run</Badge>
            </div>
            <div className="mt-6 space-y-3">
              {workflow.map((step, index) => (
                <div
                  key={step.agent}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-neutral-900/80 p-4 sm:grid-cols-[2rem_1fr_auto] sm:items-center"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-300 text-sm font-bold text-neutral-950">
                    {index + 1}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-white">{step.agent}</h3>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-neutral-300">
                        {step.state}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-400">{step.detail}</p>
                  </div>
                  <div className="rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-cyan-200">
                    {step.signal}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">BrainSNN risk layer</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Compliance checks legality. BrainSNN checks what the message does to judgment.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-semibold text-rose-300">{cognitiveRisk.score}</div>
                  <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">risk</div>
                </div>
              </div>
              <div className="mt-5 grid gap-3 text-sm">
                <RiskBar label="Emotional activation" value={cognitiveRisk.dimensions.emotionalActivation} />
                <RiskBar label="Certainty pressure" value={cognitiveRisk.dimensions.certaintyPressure} />
                <RiskBar label="Trust erosion" value={cognitiveRisk.dimensions.trustErosion} />
                <RiskBar label="Urgency compression" value={cognitiveRisk.dimensions.urgencyCompression} />
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-2xl font-semibold text-white">Partner-category fit</h2>
                <span className="text-xs uppercase tracking-[0.25em] text-neutral-500">
                  env-var driven
                </span>
              </div>
              <div className="mt-5 grid gap-3">
                {partners.map((partner) => (
                  <div
                    key={partner.id}
                    className="rounded-2xl border border-white/10 bg-neutral-900/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-cyan-200">{partner.name}</div>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          partner.live
                            ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200"
                            : "border-white/15 bg-white/5 text-neutral-400"
                        }`}
                        title={partner.envVar ?? undefined}
                      >
                        {partner.live ? "live" : "stub"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-neutral-400">{partner.role}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-neutral-500">
                Set <code className="font-mono text-neutral-300">GEMINI_API_KEY</code>,{" "}
                <code className="font-mono text-neutral-300">SPEECHMATICS_API_KEY</code>,{" "}
                <code className="font-mono text-neutral-300">FEATHERLESS_API_KEY</code>, and{" "}
                <code className="font-mono text-neutral-300">VULTR_DEPLOY</code> on the host to
                flip each row from stub to live.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <CognitiveRiskTester initialText={MILAN_SCENARIO_TEXT} />
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:p-6">
            <h2 className="text-2xl font-semibold text-white">Risk findings</h2>
            <div className="mt-5 space-y-3">
              {findings.map((finding) => (
                <article key={finding.label} className="rounded-2xl border border-white/10 bg-neutral-900/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold text-white">{finding.label}</h3>
                    <Badge tone={finding.severity === "Critical" ? "rose" : finding.severity === "High" ? "amber" : "neutral"}>
                      {finding.severity}
                    </Badge>
                  </div>
                  <p className="mt-3 text-sm text-neutral-400">Evidence: {finding.evidence}</p>
                  <p className="mt-2 text-sm text-cyan-100">Fix: {finding.fix}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-white">Proof pack queued</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  This is the artifact judges should remember: evidence, not vibes.
                </p>
              </div>
              <Badge tone="cyan">export gated</Badge>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {proofArtifacts.map((artifact) => (
                <div key={artifact} className="rounded-2xl border border-white/10 bg-neutral-900/70 p-4 text-sm text-neutral-300">
                  <span className="mr-2 text-cyan-300">✓</span>
                  {artifact}
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
              <div className="text-xs uppercase tracking-[0.25em] text-cyan-200">submission line</div>
              <p className="mt-2 text-lg font-semibold text-white">
                Most agents generate answers. XIO ProofOps generates defensible business evidence.
              </p>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-neutral-950/60 p-3">
      <div className="text-xs uppercase tracking-[0.22em] text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-white">{value}</div>
      <div className="text-xs text-neutral-400">{detail}</div>
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
