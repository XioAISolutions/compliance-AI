/**
 * Triad seed — the single source of truth for the judge-ready demo.
 *
 * Powers `/demo/judge` (the 90-second seeded review), the home-page result
 * preview card, the empty-state seeding on `/queue`, `/matters`, and
 * `/approvals`, and the README's "what you'll see" walkthrough.
 *
 * IMPORTANT — these numbers are seed data for a demo, not a customer
 * engagement. Keep them realistic enough that a compliance lawyer would
 * recognise the pattern, but never present them as actual customer
 * outcomes. The `disclosure` field at the bottom is the truthful framing
 * the UI surfaces.
 */
export const TRIAD_REVIEWERS = [
  {
    id: "counsel",
    name: "Regulatory Counsel",
    role: "Rule breaches · missing disclosures · jurisdiction issues",
    description:
      "Finds rule breaches, missing disclosures, and jurisdiction issues against the applicable corpus (NI 45-106, OSC Rule 45-501, NI 31-103).",
    accent: "blue" as const,
  },
  {
    id: "risk",
    name: "Risk Officer",
    role: "Severity · investor exposure · operational risk",
    description:
      "Scores business impact, severity, and operational exposure. Flags issues that would draw a regulator's eye even when technically defensible.",
    accent: "amber" as const,
  },
  {
    id: "evidence",
    name: "Evidence Auditor",
    role: "Citation verification · stale authority · source gaps",
    description:
      "Checks citations, stale authorities, unsupported claims, and source gaps. Refuses to sign off on findings without a verifiable authority.",
    accent: "emerald" as const,
  },
] as const;

export type TriadReviewerId = (typeof TRIAD_REVIEWERS)[number]["id"];

export type CitationBadge =
  | "verified"
  | "needs-check"
  | "missing-authority"
  | "stale"
  | "jurisdiction-mismatch";

export interface TriadCitation {
  id: string;
  authorityId: string;
  authorityTitle: string;
  section: string;
  quote: string;
  badge: CitationBadge;
  badgeReason: string;
}

export interface TriadFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  detail: string;
  /** Which reviewer raised this finding. */
  raisedBy: TriadReviewerId;
  /** Recommended fix in the reviewer's own voice. */
  recommendedFix: string;
  /** Citations attached to the finding (may be empty for unsupported claims). */
  citations: TriadCitation[];
}

export interface TriadDisagreement {
  id: string;
  issue: string;
  views: Record<TriadReviewerId, string>;
  finalAction: string;
}

export interface TriadApprovalState {
  outputHash: string;
  reviewerStatus: "ready-to-submit" | "iterate" | "rewrite";
  lastModified: string;
  approvalState: "pending" | "approved" | "rejected" | "blocked";
  exportState: "blocked-pending-approval" | "ready" | "exported";
  approver?: string;
}

export interface TriadAmdPanel {
  modelId: string;
  modelOwner: string;
  servingEngine: string;
  hardwareTarget: string;
  workflow: string;
  benefit: string;
  hostedPreviewDisclosure: string;
}

export interface TriadDemoMatter {
  id: string;
  title: string;
  jurisdiction: string;
  registrationCategory: string;
  taskType: string;
  documentType: string;
  documentExcerpt: string;
  reviewerInstruction: string;
  /** Aggregate score 0–100. Higher = closer to approval. */
  complianceScore: number;
  criticalGapCount: number;
  verifiedCitationCount: number;
  needsVerificationCount: number;
  reviewerDisagreementCount: number;
  recommendedFixCount: number;
  findings: TriadFinding[];
  disagreements: TriadDisagreement[];
  approval: TriadApprovalState;
  amd: TriadAmdPanel;
  /** Wall-clock summary of the seeded run, for the status strip. */
  recordedWallClockMs: number;
  recordedAt: string;
  recordedProvider: string;
  recordedModel: string;
  /** The honest-framing line the UI surfaces below the demo result. */
  disclosure: string;
}

/**
 * The Ontario OM matter — primary judge-demo content.
 * Mirrors the kind of finding pattern an OSC reviewer would flag on a
 * 45-106 deficiency review of a private placement OM.
 */
export const TRIAD_DEMO_MATTER: TriadDemoMatter = {
  id: "demo-ontario-om-2026-q2",
  title: "Ontario OM Compliance Review — North Capital Series A",
  jurisdiction: "Ontario",
  registrationCategory: "Exempt Market Dealer",
  taskType: "om-review",
  documentType: "Offering memorandum (excerpt)",
  documentExcerpt:
    "The issuer offers Class A units to accredited investors only. Past performance has consistently exceeded benchmarks. Subscription proceeds will be applied to general working capital. Risk factors are listed in Schedule B.",
  reviewerInstruction:
    "Check investor disclosure, use of proceeds, past performance claims, and risk factor adequacy against NI 45-106 and OSC Rule 45-501.",
  complianceScore: 62,
  criticalGapCount: 3,
  verifiedCitationCount: 5,
  needsVerificationCount: 2,
  reviewerDisagreementCount: 1,
  recommendedFixCount: 4,
  findings: [
    {
      id: "f-perf-claim",
      severity: "critical",
      title: "Past-performance representation lacks substantiation",
      detail:
        "The OM states past performance has consistently exceeded benchmarks without identifying the benchmark, the period, calculation methodology, or net-of-fees presentation. Non-substantiated performance representations are the single most common deficiency on OSC 45-106 reviews.",
      raisedBy: "counsel",
      recommendedFix:
        "Replace the performance line with a benchmarked, period-bounded, net-of-fees calculation, and add a verifiable authority for the methodology used.",
      citations: [
        {
          id: "c1",
          authorityId: "auth-ni-45-106-cp-2.9",
          authorityTitle: "Companion Policy 45-106CP §2.9",
          section: "Statements that are not misleading",
          quote:
            "An offering memorandum should not contain promotional language and should be balanced in its presentation of risks and benefits.",
          badge: "verified",
          badgeReason: "Cited authority resolved against the seeded NI 45-106 corpus.",
        },
      ],
    },
    {
      id: "f-use-of-proceeds",
      severity: "critical",
      title: "Use of proceeds is not itemised",
      detail:
        "Form 45-106F2 Item 2.4 requires an itemised allocation of subscription proceeds. The phrase 'general working capital' is not specific enough to satisfy the form requirement and is a routine first-pass deficiency.",
      raisedBy: "counsel",
      recommendedFix:
        "Replace 'general working capital' with a top-three breakdown (e.g. acquisition reserves, operating cash, regulatory capital) and total-percent disclosure.",
      citations: [
        {
          id: "c2",
          authorityId: "auth-ni-45-106-form-2.4",
          authorityTitle: "Form 45-106F2 Item 2.4",
          section: "Use of available funds",
          quote: "Provide a detailed breakdown of how the issuer will use the available funds.",
          badge: "verified",
          badgeReason: "Cited authority resolved against the seeded NI 45-106 corpus.",
        },
      ],
    },
    {
      id: "f-rights-of-action",
      severity: "high",
      title: "Statutory rights of action — disclosure not located",
      detail:
        "NI 45-106 §2.9 grants statutory rights of action for misrepresentation in an OM. The excerpt above does not contain the rights-of-action disclosure language and the audit cannot confirm it appears elsewhere in the document. If absent, this is a deficiency on its own.",
      raisedBy: "evidence",
      recommendedFix:
        "Confirm the OM's Schedule B (or equivalent) contains the prescribed rights-of-action language and resurface the citation in the audit.",
      citations: [
        {
          id: "c3",
          authorityId: "auth-ni-45-106-2.9",
          authorityTitle: "NI 45-106 §2.9",
          section: "Rights of action",
          quote:
            "Securities legislation grants purchasers rights of action for damages or rescission against the issuer or selling security holder.",
          badge: "needs-check",
          badgeReason:
            "Authority resolves but the OM excerpt provided does not include the disclosure body — a manual confirmation against the full document is required.",
        },
      ],
    },
    {
      id: "f-marketing-tone",
      severity: "high",
      title: "Marketing-tone language elevates investor reliance",
      detail:
        "Phrasing like 'consistently exceeded benchmarks' invites investor reliance even if technically defensible. NI 81-102 §15 prohibitions and OSC Staff Notice 33-316 expectations apply by analogy. High likelihood of investor reliance increases material misrepresentation risk.",
      raisedBy: "risk",
      recommendedFix:
        "Strip promotional adjectives. Replace with the benchmarked calculation and a balanced statement of past performance not predicting future returns.",
      citations: [
        {
          id: "c4",
          authorityId: "auth-osc-sn-33-316",
          authorityTitle: "OSC Staff Notice 33-316",
          section: "Suitability and investor reliance",
          quote:
            "Registrants are reminded that promotional language increases the likelihood of investor reliance and the corresponding suitability obligations.",
          badge: "verified",
          badgeReason: "Cited authority resolved against the seeded OSC SN corpus.",
        },
      ],
    },
    {
      id: "f-jurisdiction-check",
      severity: "medium",
      title: "Jurisdiction check — confirm Ontario-only offering",
      detail:
        "Excerpt does not specify the jurisdictions of distribution. If the OM is also being used outside Ontario, additional disclosures may be required (BC instrument 45-533, Alberta, Quebec). Demo seed assumes Ontario-only — re-verify on the full document.",
      raisedBy: "evidence",
      recommendedFix:
        "Add an explicit 'Jurisdictions of distribution' section listing every province/territory the OM covers, and align supplementary disclosures.",
      citations: [
        {
          id: "c5",
          authorityId: "auth-bc-45-533",
          authorityTitle: "BC Instrument 45-533",
          section: "OM exemption — BC-specific",
          quote:
            "An issuer relying on the OM exemption in British Columbia must include the BC-specific risk acknowledgement form.",
          badge: "jurisdiction-mismatch",
          badgeReason:
            "Authority is BC-specific and the matter is filed as Ontario-only. Surface as a check, not a confirmed gap.",
        },
      ],
    },
    {
      id: "f-risk-factor-adequacy",
      severity: "medium",
      title: "Risk-factor schedule referenced but not inspected",
      detail:
        "The OM defers all risk factors to Schedule B. Schedule B itself has not been provided to the reviewer. Cannot complete the risk-factor adequacy assessment.",
      raisedBy: "risk",
      recommendedFix:
        "Provide Schedule B in full so risk factors can be assessed for completeness, ordering by materiality, and consistency with the body of the OM.",
      citations: [],
    },
  ],
  disagreements: [
    {
      id: "d-perf-claim",
      issue: "Past-performance language",
      views: {
        counsel:
          "Disclosure is too promotional without adequate limitation; the rule requires a balanced presentation.",
        risk: "High risk because the language directly invites investor reliance and elevates suitability exposure.",
        evidence:
          "Cannot stand without verifiable benchmark identification, period, and methodology citation — the source layer is empty.",
      },
      finalAction:
        "Rewrite the performance claim with a benchmarked, period-bounded, net-of-fees calculation. Attach a verified authority before resubmission.",
    },
  ],
  approval: {
    outputHash: "sha256:9f1e3a8c5b2d7f4e0c8a6b3d2e1f7a4c5b9d8e2f1a3c4b5d6e7f8a9b0c1d2e3f",
    reviewerStatus: "iterate",
    lastModified: "2026-05-04T23:55:00Z",
    approvalState: "pending",
    exportState: "blocked-pending-approval",
  },
  amd: {
    modelId: "Qwen/Qwen2.5-72B-Instruct",
    modelOwner: "vllm",
    servingEngine: "vLLM (OpenAI-compatible)",
    hardwareTarget: "AMD Instinct MI300X (192 GB HBM3)",
    workflow: "3 reviewer passes (parallel) → editor synthesis → optional Round 2 reflection",
    benefit:
      "Large-memory GPU serving fits a 72B model and a three-voice ensemble on a single card. The same workload on cloud APIs requires roughly 4× H100s.",
    hostedPreviewDisclosure:
      "The hosted preview at compliance-ai-amd-demo-production.up.railway.app is configured to use this AMD vLLM endpoint when the droplet is online. /api/healthcheck/llm reports the live provider, model, latency, tokens-per-second, and engine activity.",
  },
  recordedWallClockMs: 24400,
  recordedAt: "2026-05-04T23:55:00Z",
  recordedProvider: "amd_vllm",
  recordedModel: "Qwen/Qwen2.5-72B-Instruct",
  disclosure:
    "Demo seed. The Ontario OM excerpt and findings are illustrative — not a real customer engagement. Real-world reviews follow the same pipeline against your tenant corpus.",
};

export interface SeededQueueItem {
  id: string;
  title: string;
  taskType: "om-review" | "kyc-gap-check" | "marketing-signoff" | "response-memo";
  severity: "critical" | "high" | "medium" | "low";
  evidenceStatus: "missing" | "partial" | "present";
  reviewerDisagreements: number;
  nextAction: string;
}

export const TRIAD_DEMO_QUEUE: SeededQueueItem[] = [
  {
    id: "demo-ontario-om-2026-q2",
    title: "Ontario OM Review — North Capital Series A",
    taskType: "om-review",
    severity: "critical",
    evidenceStatus: "missing",
    reviewerDisagreements: 1,
    nextAction: "Resolve performance-claim rewrite + itemise use-of-proceeds before resubmission.",
  },
  {
    id: "demo-kyc-acme-2026",
    title: "KYC File — Acme Holdings (beneficial owners)",
    taskType: "kyc-gap-check",
    severity: "high",
    evidenceStatus: "partial",
    reviewerDisagreements: 0,
    nextAction:
      "Two of four beneficial owners lack supporting documents. Request KYC pack v2 from the relationship manager.",
  },
  {
    id: "demo-marketing-northpath",
    title: "Marketing Deck — NorthPath Income Fund",
    taskType: "marketing-signoff",
    severity: "medium",
    evidenceStatus: "partial",
    reviewerDisagreements: 1,
    nextAction:
      "Slide 7 has an unsupported performance claim. Add citation or strip the claim before sign-off.",
  },
  {
    id: "demo-response-osc-2026",
    title: "Response Memo — OSC Staff Comment Letter (45-106 review)",
    taskType: "response-memo",
    severity: "high",
    evidenceStatus: "present",
    reviewerDisagreements: 0,
    nextAction:
      "Draft response addresses 4 of 5 staff comments. Comment 3 (rights-of-action language) needs an authority pin.",
  },
];

export interface SeededMatterCard {
  id: string;
  title: string;
  matterType: "om-review" | "kyc-gap-check" | "marketing-signoff" | "response-memo";
  status: "open" | "in-review" | "needs-revision" | "complete" | "blocked";
  complianceScore: number;
  criticalGaps: number;
  verifiedCitations: number;
  lastReviewAgo: string;
  nextAction: string;
}

export const TRIAD_DEMO_MATTERS: SeededMatterCard[] = [
  {
    id: "demo-ontario-om-2026-q2",
    title: "Ontario OM Review — North Capital Series A",
    matterType: "om-review",
    status: "needs-revision",
    complianceScore: 62,
    criticalGaps: 3,
    verifiedCitations: 5,
    lastReviewAgo: "5 minutes ago",
    nextAction: "Approve or send back for fix",
  },
  {
    id: "demo-kyc-acme-2026",
    title: "KYC File — Acme Holdings",
    matterType: "kyc-gap-check",
    status: "in-review",
    complianceScore: 78,
    criticalGaps: 0,
    verifiedCitations: 3,
    lastReviewAgo: "23 minutes ago",
    nextAction: "Awaiting beneficial-owner support pack",
  },
  {
    id: "demo-marketing-northpath",
    title: "Marketing Deck — NorthPath Income Fund",
    matterType: "marketing-signoff",
    status: "in-review",
    complianceScore: 71,
    criticalGaps: 0,
    verifiedCitations: 4,
    lastReviewAgo: "1 hour ago",
    nextAction: "Slide-7 performance claim needs citation",
  },
  {
    id: "demo-response-osc-2026",
    title: "Response Memo — OSC Staff Comment Letter",
    matterType: "response-memo",
    status: "in-review",
    complianceScore: 84,
    criticalGaps: 0,
    verifiedCitations: 7,
    lastReviewAgo: "2 hours ago",
    nextAction: "Comment 3 — rights-of-action authority pin",
  },
];

export interface SeededApproval {
  id: string;
  matterId: string;
  summary: string;
  outputHash: string;
  requestedBy: string;
  requestedAt: string;
  state: "pending" | "approved" | "rejected" | "blocked";
  reviewerStatus: "ready-to-submit" | "iterate" | "rewrite";
}

export const TRIAD_DEMO_APPROVALS: SeededApproval[] = [
  {
    id: "appr-demo-1",
    matterId: "demo-ontario-om-2026-q2",
    summary: "Ontario OM Review — North Capital Series A · NEEDS REVISION",
    outputHash: "sha256:9f1e3a8c5b2d7f4e0c8a6b3d2e1f7a4c5b9d8e2f1a3c4b5d6e7f8a9b0c1d2e3f",
    requestedBy: "counsel-bot",
    requestedAt: "2026-05-04T23:55:00Z",
    state: "blocked",
    reviewerStatus: "iterate",
  },
  {
    id: "appr-demo-2",
    matterId: "demo-response-osc-2026",
    summary: "Response Memo — OSC Staff Comment Letter · READY TO SUBMIT",
    outputHash: "sha256:1a2b3c4d5e6f7081928374ad5b6c7d8e9f0a1b2c3d4e5f607182930a4b5c6d7e",
    requestedBy: "counsel-bot",
    requestedAt: "2026-05-04T22:10:00Z",
    state: "pending",
    reviewerStatus: "ready-to-submit",
  },
];

/** Tile-by-tile copy for the homepage "Result preview" card above the fold. */
export const TRIAD_HOMEPAGE_PREVIEW = {
  matterTitle: TRIAD_DEMO_MATTER.title,
  taskLabel: "OM compliance review · Ontario · NI 45-106",
  complianceScore: TRIAD_DEMO_MATTER.complianceScore,
  criticalGapCount: TRIAD_DEMO_MATTER.criticalGapCount,
  verifiedCitationCount: TRIAD_DEMO_MATTER.verifiedCitationCount,
  needsVerificationCount: TRIAD_DEMO_MATTER.needsVerificationCount,
  reviewerDisagreementCount: TRIAD_DEMO_MATTER.reviewerDisagreementCount,
  exportStatus: TRIAD_DEMO_MATTER.approval.exportState,
} as const;
