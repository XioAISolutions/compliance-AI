import { NextResponse } from "next/server";
import {
  MILAN_SCENARIO_TEXT,
  computeCognitiveRisk,
} from "../../../../lib/demo/cognitive-risk";
import { getPartnerStatuses } from "../../../../lib/demo/partner-status";

export const dynamic = "force-dynamic";

const cognitiveRisk = computeCognitiveRisk(MILAN_SCENARIO_TEXT);

const demoRun = {
  id: "milan-proofops-001",
  product: "XIO ProofOps Agent",
  tagline: "Autonomous proof, approval, and audit trails for regulated business decisions.",
  scenario: {
    name: "Investor deck + sales call compliance proof",
    artifacts: [
      "investor-deck-excerpt.txt",
      "sales-call-transcript.txt",
      "marketing-claim.txt",
    ],
    claim: "Protected returns, limited spots, AI-reviewed onboarding, and instant approval.",
    text: MILAN_SCENARIO_TEXT,
  },
  // partnerFit is rebuilt per-request in the handler so it reflects
  // which sponsor keys are configured on the deploy.
  workflow: [
    {
      step: 1,
      agent: "Intake Agent",
      status: "complete",
      output: "Loaded 3 artifacts and normalized them into a single matter context.",
    },
    {
      step: 2,
      agent: "Gemini Planner",
      status: "complete",
      output: "Selected securities, privacy, marketing-signoff, and AI-use review lanes.",
    },
    {
      step: 3,
      agent: "Compliance Reviewer",
      status: "complete",
      output: "Found guaranteed-outcome language, missing disclosure, and privacy-consent gaps.",
    },
    {
      step: 4,
      agent: "BrainSNN Cognitive Risk Agent",
      status: "complete",
      output: `Cognitive-risk score ${cognitiveRisk.score}/100 driven by urgency compression and certainty pressure.`,
    },
    {
      step: 5,
      agent: "Citation Verifier",
      status: "verified",
      output: "Verified 6 of 7 authority references; 1 requires manual review.",
    },
    {
      step: 6,
      agent: "Redline Agent",
      status: "ready",
      output: "Prepared 5 safer-language edits for counsel approval.",
    },
    {
      step: 7,
      agent: "Approval Gate",
      status: "waiting",
      output: "Export blocked until approval binds to sha256(output).",
    },
    {
      step: 8,
      agent: "Export Agent",
      status: "blocked",
      output: "DOCX proof pack, transcript appendix, and audit trail are queued.",
    },
  ],
  findings: [
    {
      severity: "critical",
      label: "Guaranteed-outcome language",
      evidence: "The deck says returns are protected and predictable.",
      recommendation: "Replace guarantee with risk-qualified, evidence-backed performance language.",
    },
    {
      severity: "high",
      label: "Investor pressure pattern",
      evidence: "The transcript uses scarcity and urgency to compress buyer judgment.",
      recommendation: "Add balanced disclosure and cooling-off language before subscription steps.",
    },
    {
      severity: "high",
      label: "Privacy-consent gap",
      evidence: "Call recording is reviewed for lead scoring without clear consent wording.",
      recommendation: "Add explicit collection purpose, retention period, and consent capture.",
    },
    {
      severity: "medium",
      label: "AI-use disclosure risk",
      evidence: "The workflow drafts filed material without a visible human review attestation.",
      recommendation: "Attach human approval, model-use note, and artifact hash to the export pack.",
    },
  ],
  brainSnnRisk: cognitiveRisk,
  proofPack: {
    artifacts: [
      "Risk-ranked claim table",
      "BrainSNN cognitive-risk receipt",
      "Verified citation ledger",
      "Redlined safer language",
      "Human approval hash",
      "Audit trail",
    ],
    downloadUrl: "/api/demo/milan/proof-pack",
  },
};

export async function GET() {
  const partners = getPartnerStatuses();
  const partnerFit = Object.fromEntries(
    partners.map((p) => [p.id, p.role]),
  );
  const body = {
    ...demoRun,
    partnerFit,
    partners: partners.map((p) => ({
      id: p.id,
      name: p.name,
      live: p.live,
      role: p.role,
    })),
  };
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
