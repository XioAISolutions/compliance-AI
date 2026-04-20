import { describe, it, expect } from "vitest";
import {
  getRetrievalPlan,
  listPlanTaskTypes,
  type RetrievalPlanTaskType,
} from "../retrieval-plans";
import {
  KYC_REVIEWER_RETRIEVAL_PLAN,
  KYC_REVIEWER_SYSTEM,
} from "../personas/kyc-reviewer";
import {
  MARKETING_REVIEWER_RETRIEVAL_PLAN,
  MARKETING_REVIEWER_SYSTEM,
} from "../personas/marketing-reviewer";
import {
  RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN,
  RESPONSE_MEMO_DRAFTER_SYSTEM,
} from "../personas/response-memo-drafter";
import {
  COURT_AI_DISCLOSURE_DRAFTER_RETRIEVAL_PLAN,
  COURT_AI_DISCLOSURE_DRAFTER_SYSTEM,
} from "../personas/court-ai-disclosure-drafter";
import {
  MISSING_AUTHORITY_SCANNER_RETRIEVAL_PLAN,
  MISSING_AUTHORITY_SCANNER_SYSTEM,
} from "../personas/missing-authority-scanner";
import {
  PIPEDA_REVIEWER_RETRIEVAL_PLAN,
  PIPEDA_REVIEWER_SYSTEM,
} from "../personas/pipeda-reviewer";
import {
  CONTRACT_REDLINER_RETRIEVAL_PLAN,
  CONTRACT_REDLINER_SYSTEM,
} from "../personas/contract-redliner";

describe("retrieval plans registry", () => {
  it("registers a plan for each of the eight core task types", () => {
    const expected: RetrievalPlanTaskType[] = [
      "om-review",
      "kyc-gap-check",
      "marketing-signoff",
      "response-memo",
      "court-ai-disclosure",
      "missing-authority-scan",
      "pipeda-check",
      "contract-redline",
    ];
    const registered = listPlanTaskTypes().sort();
    expect(registered).toEqual([...expected].sort());
  });

  it("returns the right plan per task type", () => {
    expect(getRetrievalPlan("kyc-gap-check")).toBe(KYC_REVIEWER_RETRIEVAL_PLAN);
    expect(getRetrievalPlan("marketing-signoff")).toBe(MARKETING_REVIEWER_RETRIEVAL_PLAN);
    expect(getRetrievalPlan("response-memo")).toBe(RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN);
    expect(getRetrievalPlan("court-ai-disclosure")).toBe(
      COURT_AI_DISCLOSURE_DRAFTER_RETRIEVAL_PLAN,
    );
    expect(getRetrievalPlan("missing-authority-scan")).toBe(
      MISSING_AUTHORITY_SCANNER_RETRIEVAL_PLAN,
    );
    expect(getRetrievalPlan("pipeda-check")).toBe(PIPEDA_REVIEWER_RETRIEVAL_PLAN);
    expect(getRetrievalPlan("contract-redline")).toBe(CONTRACT_REDLINER_RETRIEVAL_PLAN);
  });

  it("returns null for unknown task types so callers can fall back", () => {
    expect(getRetrievalPlan("not-a-real-task")).toBeNull();
    expect(getRetrievalPlan("")).toBeNull();
  });
});

describe("KYC reviewer plan", () => {
  it("is non-empty and contains short, targeted queries", () => {
    expect(KYC_REVIEWER_RETRIEVAL_PLAN.length).toBeGreaterThanOrEqual(8);
    for (const q of KYC_REVIEWER_RETRIEVAL_PLAN) {
      expect(q.length).toBeGreaterThan(10);
      expect(q.length).toBeLessThan(200);
    }
  });

  it("covers the authority clusters the persona's checklist cites", () => {
    const blob = KYC_REVIEWER_RETRIEVAL_PLAN.join(" | ").toLowerCase();
    for (const needle of [
      "pcmltfa",
      "fintrac",
      "31-103",
      "13.3",
      "13.13",
      "pep",
      "beneficial ownership",
      "source of funds",
      "ongoing monitoring",
    ]) {
      expect(blob).toContain(needle);
    }
  });

  it("instructs the model to produce the review even when retrieval is partial", () => {
    expect(KYC_REVIEWER_SYSTEM).toMatch(/NEEDS VERIFICATION/);
    expect(KYC_REVIEWER_SYSTEM).toMatch(/never\s+output\s+a\s+meta-refusal/i);
  });
});

describe("Marketing reviewer plan", () => {
  it("is non-empty and contains short, targeted queries", () => {
    expect(MARKETING_REVIEWER_RETRIEVAL_PLAN.length).toBeGreaterThanOrEqual(8);
    for (const q of MARKETING_REVIEWER_RETRIEVAL_PLAN) {
      expect(q.length).toBeGreaterThan(10);
      expect(q.length).toBeLessThan(200);
    }
  });

  it("covers the authority clusters the persona's flagged-claims table cites", () => {
    const blob = MARKETING_REVIEWER_RETRIEVAL_PLAN.join(" | ").toLowerCase();
    for (const needle of [
      "81-102",
      "15.2",
      "15.3",
      "13.18",
      "33-316",
      "performance data",
      "forward looking",
      "guarantee",
    ]) {
      expect(blob).toContain(needle);
    }
  });

  it("instructs the model to produce the review even when retrieval is partial", () => {
    expect(MARKETING_REVIEWER_SYSTEM).toMatch(/NEEDS-VERIFICATION/);
    expect(MARKETING_REVIEWER_SYSTEM).toMatch(/never\s+output\s+a\s+meta-refusal/i);
  });
});

describe("Response-memo drafter plan", () => {
  it("is non-empty and contains short, targeted queries", () => {
    expect(RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN.length).toBeGreaterThanOrEqual(8);
    for (const q of RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN) {
      expect(q.length).toBeGreaterThan(10);
      expect(q.length).toBeLessThan(200);
    }
  });

  it("covers the OSC / CIRO / FINTRAC deficiency-pattern clusters and underlying rules", () => {
    const blob = RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN.join(" | ").toLowerCase();
    for (const needle of [
      "osc compliance",
      "ciro",
      "fintrac",
      "31-103",
      "13.3",
      "13.18",
      "pcmltfa",
      "trade surveillance",
      "remediation",
    ]) {
      expect(blob).toContain(needle);
    }
  });

  it("instructs the drafter to produce the memo even when retrieval is partial", () => {
    expect(RESPONSE_MEMO_DRAFTER_SYSTEM).toMatch(/NEEDS VERIFICATION/);
    expect(RESPONSE_MEMO_DRAFTER_SYSTEM).toMatch(/never\s+output\s+a\s+meta-refusal/i);
  });
});

describe("Court AI-disclosure drafter plan", () => {
  it("is non-empty and contains short, targeted queries", () => {
    expect(COURT_AI_DISCLOSURE_DRAFTER_RETRIEVAL_PLAN.length).toBeGreaterThanOrEqual(8);
    for (const q of COURT_AI_DISCLOSURE_DRAFTER_RETRIEVAL_PLAN) {
      expect(q.length).toBeGreaterThan(10);
      expect(q.length).toBeLessThan(200);
    }
  });

  it("covers the Canadian court + law-society AI-use clusters the persona cites", () => {
    const blob = COURT_AI_DISCLOSURE_DRAFTER_RETRIEVAL_PLAN.join(" | ").toLowerCase();
    for (const needle of [
      "federal court",
      "ontario superior court",
      "alberta",
      "british columbia",
      "law society",
      "duty of candour",
      "hallucinated citations",
    ]) {
      expect(blob).toContain(needle);
    }
  });

  it("requires the five-section output structure", () => {
    for (const heading of [
      "AI-Use Disclosure Statement",
      "Court-Specific Requirements Checklist",
      "Citation Verification Appendix",
      "Verification Blockers",
      "Counsel Signoff Appendix",
    ]) {
      expect(COURT_AI_DISCLOSURE_DRAFTER_SYSTEM).toContain(heading);
    }
  });

  it("instructs the drafter to produce the memo even when retrieval is partial", () => {
    expect(COURT_AI_DISCLOSURE_DRAFTER_SYSTEM).toMatch(/NEEDS VERIFICATION/);
    expect(COURT_AI_DISCLOSURE_DRAFTER_SYSTEM).toMatch(/never\s+output\s+a\s+meta-refusal/i);
  });

  it("mandates the counsel signoff block", () => {
    expect(COURT_AI_DISCLOSURE_DRAFTER_SYSTEM).toMatch(/counsel of record/i);
    expect(COURT_AI_DISCLOSURE_DRAFTER_SYSTEM).toMatch(/professional responsibility/i);
  });
});

describe("Missing-authority scanner plan + persona", () => {
  it("plan is non-empty and contains short, targeted queries", () => {
    expect(MISSING_AUTHORITY_SCANNER_RETRIEVAL_PLAN.length).toBeGreaterThanOrEqual(5);
    for (const q of MISSING_AUTHORITY_SCANNER_RETRIEVAL_PLAN) {
      expect(q.length).toBeGreaterThan(10);
      expect(q.length).toBeLessThan(200);
    }
  });

  it("plan covers the professional-responsibility + verification clusters", () => {
    const blob = MISSING_AUTHORITY_SCANNER_RETRIEVAL_PLAN.join(" | ").toLowerCase();
    for (const needle of [
      "verification",
      "duty of candour",
      "hallucinated",
      "authoritative source",
      "primary authority",
    ]) {
      expect(blob).toContain(needle);
    }
  });

  it("persona emits a five-section audit structure", () => {
    for (const heading of [
      "Citation Risk Summary",
      "Per-Citation Audit Table",
      "Uncited Assertions",
      "Corpus Coverage Gaps",
      "Pre-Filing Punch List",
    ]) {
      expect(MISSING_AUTHORITY_SCANNER_SYSTEM).toContain(heading);
    }
  });

  it("persona refuses to rewrite and never refuses outright", () => {
    expect(MISSING_AUTHORITY_SCANNER_SYSTEM).toMatch(/never\s+rewrite/i);
    expect(MISSING_AUTHORITY_SCANNER_SYSTEM).toMatch(/never\s+output\s+a\s+meta-refusal/i);
  });

  it("persona uses the core issue vocabulary", () => {
    for (const token of [
      "LOW-CONFIDENCE",
      "STALE",
      "WRONG-JURISDICTION",
      "MISSING-METADATA",
      "MISSING-QUOTE",
      "UNSUPPORTED",
    ]) {
      expect(MISSING_AUTHORITY_SCANNER_SYSTEM).toContain(token);
    }
  });
});

describe("PIPEDA reviewer plan + persona", () => {
  it("plan is non-empty and contains short, targeted queries", () => {
    expect(PIPEDA_REVIEWER_RETRIEVAL_PLAN.length).toBeGreaterThanOrEqual(10);
    for (const q of PIPEDA_REVIEWER_RETRIEVAL_PLAN) {
      expect(q.length).toBeGreaterThan(10);
      expect(q.length).toBeLessThan(200);
    }
  });

  it("plan covers PIPEDA + OPC + provincial-substantially-similar clusters", () => {
    const blob = PIPEDA_REVIEWER_RETRIEVAL_PLAN.join(" | ").toLowerCase();
    for (const needle of [
      "pipeda",
      "schedule 1",
      "breach",
      "real risk significant harm",
      "opc",
      "cross-border",
      "quebec law 25",
      "alberta pipa",
      "british columbia pipa",
    ]) {
      expect(blob).toContain(needle);
    }
  });

  it("persona instructs the model to produce the review even when retrieval is partial", () => {
    expect(PIPEDA_REVIEWER_SYSTEM).toMatch(/NEEDS VERIFICATION/);
    expect(PIPEDA_REVIEWER_SYSTEM).toMatch(/never\s+output\s+a\s+meta-refusal/i);
  });

  it("persona requires the six-section output structure", () => {
    for (const heading of [
      "Executive Summary",
      "PIPEDA Ten Fair Information Principles",
      "Breach-Notification Readiness",
      "Cross-Border and Third-Party Transfers",
      "Provincial Substantially-Similar Regime Check",
      "Remediation Punch List",
    ]) {
      expect(PIPEDA_REVIEWER_SYSTEM).toContain(heading);
    }
  });
});

describe("Contract redliner plan + persona", () => {
  it("plan is non-empty and targeted", () => {
    expect(CONTRACT_REDLINER_RETRIEVAL_PLAN.length).toBeGreaterThanOrEqual(8);
    for (const q of CONTRACT_REDLINER_RETRIEVAL_PLAN) {
      expect(q.length).toBeGreaterThan(10);
      expect(q.length).toBeLessThan(200);
    }
  });

  it("plan covers the contract-law + adjacent-statute clusters", () => {
    const blob = CONTRACT_REDLINER_RETRIEVAL_PLAN.join(" | ").toLowerCase();
    for (const needle of [
      "contract law",
      "sale of goods",
      "limitation of liability",
      "indemnity",
      "choice of law",
      "pipeda",
      "casl",
      "limitation period",
      "entire agreement",
      "termination",
      "confidentiality",
      "intellectual property",
    ]) {
      expect(blob).toContain(needle);
    }
  });

  it("persona documents the three diff tokens exactly", () => {
    expect(CONTRACT_REDLINER_SYSTEM).toContain("[-old text-]");
    expect(CONTRACT_REDLINER_SYSTEM).toContain("{+new text+}");
    expect(CONTRACT_REDLINER_SYSTEM).toContain("<<NOTE:");
  });

  it("persona refuses meta-refusals and preserves structure", () => {
    expect(CONTRACT_REDLINER_SYSTEM).toMatch(/never\s+output\s+a\s+meta-refusal/i);
    expect(CONTRACT_REDLINER_SYSTEM).toMatch(/Never reformat paragraphs/i);
  });
});
