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
  openGraph: {
    title: "XIO ProofOps Agent — Milan AI Week",
    description:
      "Most AI agents generate answers. XIO ProofOps generates defensible business evidence.",
    type: "website",
    siteName: "XIO ProofOps Agent",
  },
  twitter: {
    card: "summary_large_image",
    title: "XIO ProofOps Agent — Milan AI Week",
    description:
      "Most AI agents generate answers. XIO ProofOps generates defensible business evidence.",
  },
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
  ["GET", "/api/demo/milan/scenario", "Raw deck / transcript / claim text the workflow runs over."],
  ["POST", "/api/demo/milan/cognitive-risk", "BrainSNN score over arbitrary { text }."],
  ["GET", "/api/demo/milan/plan", "Gemini-planned review lanes (deterministic fallback)."],
  ["GET", "/api/demo/milan/redline", "Featherless safer-language edits (fallback safe)."],
  ["POST", "/api/demo/milan/rewrite", "Full loop — score, rewrite via Featherless, re-score, return delta."],
  ["GET", "/api/demo/milan/transcribe", "Canonical voice transcript + Speechmatics auth ping."],
  ["GET", "/api/demo/milan/proof-pack", "DOCX proof pack with live partner output rolled in."],
] as const;

const severityAccent: Record<(typeof findings)[number]["severity"], string> = {
  Critical: "before:bg-rose-400",
  High: "before:bg-amber-300",
  Medium: "before:bg-neutral-500",
};

export default function MilanDemoPage() {
  const partners = getPartnerStatuses();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "XIO ProofOps Agent",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: THESIS,
    url: "/demo/milan",
    creator: { "@type": "Organization", name: "XIO AI Solutions" },
    audience: {
      "@type": "Audience",
      audienceType: "Compliance, legal, and regulated-industry teams",
    },
    featureList: [
      "Autonomous compliance review workflow",
      "BrainSNN cognitive-risk scoring derived from input text",
      "Hash-bound human approval gate",
      "DOCX proof-pack export",
      "Citation verification against authority corpus",
      "Sovereign-lane open-weights inference via Featherless",
      "Voice-call ingestion via Speechmatics",
      "Gemini-backed multimodal planner",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
  return (
    <main className="relative min-h-screen bg-neutral-950 text-neutral-100 antialiased">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Subtle background grid */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse at top, black 50%, transparent 90%)",
          WebkitMaskImage: "radial-gradient(ellipse at top, black 50%, transparent 90%)",
        }}
      />

      {/* Sticky top nav */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-3.5 text-sm">
          <a href="#top" className="flex items-center gap-2.5 text-neutral-100">
            <span className="inline-flex h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
            <span className="font-semibold tracking-tight">XIO ProofOps</span>
            <span className="hidden text-neutral-600 sm:inline">·</span>
            <span className="hidden text-neutral-500 sm:inline">Milan AI Week</span>
          </a>
          <nav className="hidden gap-6 text-xs font-medium text-neutral-400 md:flex">
            <a href="#workflow" className="transition hover:text-neutral-100">
              Workflow
            </a>
            <a href="#try-it" className="transition hover:text-neutral-100">
              BrainSNN
            </a>
            <a href="#findings" className="transition hover:text-neutral-100">
              Findings
            </a>
            <a href="#partners" className="transition hover:text-neutral-100">
              Partners
            </a>
            <a href="#endpoints" className="transition hover:text-neutral-100">
              API
            </a>
          </nav>
          <a
            href="/api/demo/milan/proof-pack"
            className="hidden items-center gap-1.5 rounded-full bg-cyan-300 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 transition hover:bg-cyan-200 sm:inline-flex"
          >
            Download proof pack
            <span aria-hidden>↓</span>
          </a>
        </div>
      </header>

      <span id="top" className="block" aria-hidden />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* HERO */}
        <section className="pt-20 pb-24 lg:pt-28 lg:pb-32">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-cyan-300">
            Milan AI Week Hackathon · Live demo
          </p>
          <h1 className="mt-6 text-5xl font-semibold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Defensible business
            <br />
            <span className="text-cyan-300">evidence</span>, not chat.
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-neutral-300 sm:text-xl">
            XIO ProofOps Agent is an autonomous proof workflow for regulated business decisions.
            Drop a deck, contract, policy, or voice transcript — the agent classifies risk, plans
            the review with Gemini, scores cognitive manipulation, drafts safer redlines on
            Featherless, binds human approval to the output hash, and ships a DOCX proof pack.
          </p>
          <p className="mt-6 max-w-2xl text-base italic text-neutral-400">
            &ldquo;{THESIS}&rdquo;
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <a
              href="/api/demo/milan/proof-pack"
              className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-200"
            >
              Download proof pack
              <span aria-hidden>↓</span>
            </a>
            <a
              href="#try-it"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/5"
            >
              Try BrainSNN live
              <span aria-hidden>→</span>
            </a>
            <a
              href="/matters/new"
              className="inline-flex items-center gap-2 px-2 py-3 text-sm font-medium text-neutral-400 transition hover:text-neutral-100"
            >
              Open full matter wizard ↗
            </a>
          </div>

          {/* metric strip */}
          <dl className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.04] sm:grid-cols-4">
            <Stat label="Cognitive risk" value={`${cognitiveRisk.score}`} unit="/100" hint="derived from text" />
            <Stat label="Decision lanes" value="4" hint="securities · privacy · marketing · AI-use" />
            <Stat label="Citations" value="6/7" hint="verified offline" />
            <Stat label="Export gate" value="locked" hint="hash-bound approval" />
          </dl>
        </section>

        <Divider />

        {/* WORKFLOW */}
        <section id="workflow" className="scroll-mt-20 py-20 lg:py-24">
          <SectionHead
            eyebrow="The autonomous proof run"
            title="Eight agents. One shipping artifact."
            sub="A workflow, not a chatbot. Every step writes to the audit trail."
          />
          <ol className="mt-12 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            {workflow.map((step, index) => (
              <li key={step.agent} className="group">
                <div className="flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-neutral-500">
                  <span className="font-mono">{String(index + 1).padStart(2, "0")}</span>
                  <span>{step.state}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-white">{step.agent}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{step.detail}</p>
                <p className="mt-3 font-mono text-xs text-cyan-300">{step.signal}</p>
              </li>
            ))}
          </ol>
        </section>

        <Divider />

        {/* BRAINSNN + TESTER */}
        <section id="try-it" className="scroll-mt-20 py-20 lg:py-24">
          <SectionHead
            eyebrow="BrainSNN cognitive-risk agent"
            title="Compliance checks legality. BrainSNN checks judgment."
            sub="The score is derived from input text. Change the words, watch it move. The agent runs in your browser tab — open devtools and inspect."
          />

          <div className="mt-12 grid gap-12 lg:grid-cols-[0.95fr_1.05fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-neutral-500">
                Canonical scenario
              </p>
              <div className="mt-4 flex items-baseline gap-3">
                <span className="text-7xl font-semibold tracking-tight text-rose-300">
                  {cognitiveRisk.score}
                </span>
                <span className="text-sm font-medium text-neutral-500">/ 100 composite</span>
              </div>
              <div className="mt-8 space-y-4">
                <RiskBar label="Emotional activation" value={cognitiveRisk.dimensions.emotionalActivation} />
                <RiskBar label="Certainty pressure" value={cognitiveRisk.dimensions.certaintyPressure} />
                <RiskBar label="Trust erosion" value={cognitiveRisk.dimensions.trustErosion} />
                <RiskBar label="Urgency compression" value={cognitiveRisk.dimensions.urgencyCompression} />
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500">
                <span>
                  Patterns + weights:{" "}
                  <code className="font-mono text-neutral-300">lib/demo/cognitive-risk.ts</code>
                </span>
                <a
                  href="/api/demo/milan/scenario"
                  className="font-medium text-cyan-300 transition hover:text-cyan-200"
                >
                  View raw inputs ↗
                </a>
              </div>
            </div>

            <CognitiveRiskTester initialText={MILAN_SCENARIO_TEXT} />
          </div>
        </section>

        <Divider />

        {/* FINDINGS + PROOF PACK */}
        <section id="findings" className="scroll-mt-20 py-20 lg:py-24">
          <SectionHead
            eyebrow="Evidence the workflow ships"
            title="Findings, then the artifact that carries them."
            sub="Every finding is hash-bound. Approval invalidates on edit. Export emits a DOCX."
          />

          <div className="mt-12 grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-neutral-500">
                Risk findings
              </p>
              <ul className="mt-6 space-y-6">
                {findings.map((finding) => (
                  <li
                    key={finding.label}
                    className={`relative pl-5 before:absolute before:left-0 before:top-1.5 before:h-2 before:w-2 before:rounded-full ${severityAccent[finding.severity]}`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="text-base font-semibold text-white">{finding.label}</h3>
                      <span className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                        {finding.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                      <span className="font-medium text-neutral-300">Evidence.</span>{" "}
                      {finding.evidence}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-cyan-100/80">
                      <span className="font-medium">Fix.</span> {finding.fix}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="rounded-2xl border border-cyan-300/30 bg-gradient-to-b from-cyan-300/[0.06] to-transparent p-6">
              <p className="text-xs font-medium uppercase tracking-[0.25em] text-cyan-300">
                Proof pack · DOCX
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                The artifact compliance keeps.
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                Findings, redline summary, cognitive-risk receipt, output + approval hashes, and
                the full audit trail. One file.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-neutral-300">
                {proofArtifacts.map((artifact) => (
                  <li key={artifact} className="flex items-start gap-2">
                    <span aria-hidden className="mt-[3px] text-cyan-300">
                      ▸
                    </span>
                    <span>{artifact}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/api/demo/milan/proof-pack"
                className="mt-7 flex items-center justify-center gap-2 rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-200"
              >
                Download proof pack
                <span aria-hidden>↓</span>
              </a>
              <p className="mt-3 text-center text-[11px] text-neutral-500">
                Headers expose <code className="font-mono">X-ProofPack-OutputHash</code> + each
                partner&apos;s source.
              </p>
            </aside>
          </div>
        </section>

        <Divider />

        {/* PARTNERS */}
        <section id="partners" className="scroll-mt-20 py-20 lg:py-24">
          <SectionHead
            eyebrow="Sponsor tracks"
            title="Partner-category fit."
            sub="Env-var driven. Set the keys on the host and rows flip from stub to live."
          />

          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {partners.map((partner) => (
              <li
                key={partner.id}
                className="group flex h-full flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg font-mono text-sm font-bold ${
                      partner.live
                        ? "bg-emerald-300/10 text-emerald-200 ring-1 ring-emerald-300/30"
                        : "bg-white/[0.04] text-neutral-400 ring-1 ring-white/[0.08]"
                    }`}
                    aria-hidden
                  >
                    {partner.name.slice(0, 2).toUpperCase()}
                  </div>
                  <span
                    className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider ${
                      partner.live ? "text-emerald-300" : "text-neutral-500"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        partner.live ? "bg-emerald-300 shadow-[0_0_6px_rgba(110,231,183,0.6)]" : "bg-neutral-600"
                      }`}
                      aria-label={partner.live ? "live" : "stub"}
                    />
                    {partner.live ? "live" : "stub"}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{partner.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-400">{partner.role}</p>
                {partner.envVar && (
                  <p className="mt-4 font-mono text-[10px] text-neutral-600">{partner.envVar}</p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <Divider />

        {/* ENDPOINTS */}
        <section id="endpoints" className="scroll-mt-20 py-20 lg:py-24">
          <SectionHead
            eyebrow="Technical evidence"
            title="Live endpoints judges can poke."
            sub="No auth. Every workflow step has a public route. Curl, devtools, Postman — same shape every time."
          />

          <div className="mt-10 overflow-hidden rounded-xl border border-white/[0.06]">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.02] text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 font-medium">Endpoint</th>
                  <th className="px-4 py-3 font-medium">Returns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-neutral-300">
                {endpoints.map(([method, endpoint, desc]) => (
                  <tr key={endpoint} className="transition hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-cyan-300">{method}</td>
                    <td className="px-4 py-3 font-mono text-xs text-neutral-100">{endpoint}</td>
                    <td className="px-4 py-3 text-neutral-400">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CLOSING THESIS */}
        <section className="py-20 text-center lg:py-28">
          <p className="text-xs font-medium uppercase tracking-[0.4em] text-cyan-300">
            Submission line
          </p>
          <p className="mx-auto mt-8 max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            &ldquo;{THESIS}&rdquo;
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/api/demo/milan/proof-pack"
              className="inline-flex items-center gap-2 rounded-full bg-cyan-300 px-6 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-200"
            >
              Download proof pack
              <span aria-hidden>↓</span>
            </a>
            <a
              href="https://github.com/XioAISolutions/compliance-AI/tree/feat/milan-proofops-agent"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/5"
              target="_blank"
              rel="noreferrer"
            >
              View source ↗
            </a>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-cyan-300" />
            <span className="font-semibold text-neutral-300">XIO ProofOps Agent</span>
            <span className="text-neutral-700">·</span>
            <span>Milan AI Week submission</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <a
              href="/api/demo/milan"
              className="font-mono transition hover:text-neutral-200"
            >
              /api/demo/milan
            </a>
            <a
              href="/api/healthcheck"
              className="font-mono transition hover:text-neutral-200"
            >
              /api/healthcheck
            </a>
            <span className="text-neutral-700">·</span>
            <span>
              Submission packet:{" "}
              <code className="font-mono text-neutral-400">docs/MILAN_SUBMISSION.md</code>
            </span>
          </div>
        </div>
      </footer>
    </main>
  );
}

function SectionHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-cyan-300">{eyebrow}</p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        {title}
      </h2>
      {sub && <p className="mt-4 text-base leading-relaxed text-neutral-400">{sub}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  hint: string;
}) {
  return (
    <div className="bg-neutral-950 p-5">
      <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight text-white">{value}</span>
        {unit && <span className="text-sm font-medium text-neutral-500">{unit}</span>}
      </div>
      <div className="mt-1 text-xs text-neutral-400">{hint}</div>
    </div>
  );
}

function Divider() {
  return <hr className="border-white/[0.06]" />;
}

function RiskBar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-neutral-300">{label}</span>
        <span className="font-mono text-neutral-500">{clamped}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-cyan-300/80" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
