import { NextResponse } from "next/server";

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
  },
  partnerFit: {
    vultr: "Production-shaped web agent for enterprise compliance workflows.",
    gemini: "Planner and multimodal reasoning layer for documents, decks, and transcript context.",
    speechmatics: "Transcript ingestion boundary for sales, investor, and compliance calls.",
    featherless: "Open-source domain-review fallback for auditable private deployments.",
  },
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
      output: "Cognitive-risk score 82/100 driven by urgency compression and certainty pressure.",
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
  brainSnnRisk: {
    score: 82,
    dimensions: {
      emotionalActivation: 88,
      certaintyPressure: 84,
      trustErosion: 71,
      urgencyCompression: 91,
    },
  },
  proofPack: [
    "Risk-ranked claim table",
    "BrainSNN cognitive-risk receipt",
    "Verified citation ledger",
    "Redlined safer language",
    "Human approval hash",
    "DOCX proof pack queued for export",
  ],
};

export async function GET() {
  return NextResponse.json(demoRun, {
    headers: {
      "Cache-Control": "public, max-age=60",
    },
  });
}
