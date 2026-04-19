import { describe, it, expect } from "vitest";
import { OM_REVIEWER_RETRIEVAL_PLAN, OM_REVIEWER_SYSTEM } from "../personas/om-reviewer";

describe("OM_REVIEWER_RETRIEVAL_PLAN", () => {
  it("is non-empty and contains short, targeted queries", () => {
    expect(OM_REVIEWER_RETRIEVAL_PLAN.length).toBeGreaterThanOrEqual(10);
    for (const q of OM_REVIEWER_RETRIEVAL_PLAN) {
      expect(typeof q).toBe("string");
      expect(q.length).toBeGreaterThan(10);
      expect(q.length).toBeLessThan(200);
    }
  });

  it("covers the authority clusters the persona cites in its output structure", () => {
    // If a cluster isn't in the plan, single-pass retrieval would miss it
    // and the model would be forced into the "corpus incomplete" refusal.
    const blob = OM_REVIEWER_RETRIEVAL_PLAN.join(" | ").toLowerCase();
    const required = [
      "45-106f2",
      "45-106f3",
      "45-106f4",
      "accredited investor",
      "minimum amount",
      "45-102",
      "45-501",
      "130.1",
      "31-103",
      "81-102",
      "45-106cp",
      "45-318",
      "45-716",
      "forward looking",
    ];
    for (const needle of required) {
      expect(blob).toContain(needle);
    }
  });
});

describe("OM_REVIEWER_SYSTEM prompt", () => {
  it("instructs the model to produce the review even when retrieval is partial", () => {
    // Regression guard against the "I cannot produce a compliant review
    // because the corpus is incomplete" failure mode.
    expect(OM_REVIEWER_SYSTEM).toMatch(/NEEDS VERIFICATION/);
    expect(OM_REVIEWER_SYSTEM).toMatch(/never refuse/i);
  });
});
