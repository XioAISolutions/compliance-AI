import { describe, it, expect } from "vitest";
import { routePersona } from "../router";

describe("routePersona", () => {
  it("routes to drafter for drafting requests", () => {
    const result = routePersona("Draft a policy statement for access control.");
    expect(result.persona).toBe("drafter");
  });

  it("routes to reviewer for review requests", () => {
    const result = routePersona("Review this draft for gaps and weaknesses.");
    expect(result.persona).toBe("reviewer");
  });

  it("routes to evidence-collector for evidence requests", () => {
    const result = routePersona("What evidence do we need to prove this control?");
    expect(result.persona).toBe("evidence-collector");
  });

  it("routes to risk-assessor for risk questions", () => {
    const result = routePersona("What risks could this control fail to mitigate?");
    expect(result.persona).toBe("risk-assessor");
  });

  it("routes to om-reviewer for offering memorandum requests", () => {
    const result = routePersona("Review this offering memorandum for compliance.");
    expect(result.persona).toBe("om-reviewer");
  });

  it("routes to om-reviewer for OM abbreviation", () => {
    const result = routePersona("Check the OM for missing disclosures.");
    expect(result.persona).toBe("om-reviewer");
  });

  it("routes to om-reviewer for NI 45-106 references", () => {
    const result = routePersona("Does this comply with NI 45-106 requirements?");
    expect(result.persona).toBe("om-reviewer");
  });

  it("routes to om-reviewer for securities OM references", () => {
    const result = routePersona("Review this OM against NI 45-106.");
    expect(result.persona).toBe("om-reviewer");
  });

  it("routes to kyc-reviewer for KYC file reviews", () => {
    const result = routePersona("Run a KYC gap check on this client file.");
    expect(result.persona).toBe("kyc-reviewer");
  });

  it("routes to kyc-reviewer for FINTRAC/PCMLTFA questions", () => {
    const result = routePersona("Is this client file FINTRAC compliant under PCMLTFA?");
    expect(result.persona).toBe("kyc-reviewer");
  });

  it("routes to marketing-reviewer for NI 81-102 questions", () => {
    const result = routePersona("Check this marketing deck against NI 81-102 Part 15.");
    expect(result.persona).toBe("marketing-reviewer");
  });

  it("routes to marketing-reviewer for sign-off requests", () => {
    const result = routePersona("Sign off on this one-pager sales communication.");
    expect(result.persona).toBe("marketing-reviewer");
  });

  it("routes to response-memo-drafter for regulator letter responses", () => {
    const result = routePersona("Draft a response to the OSC deficiency letter.");
    expect(result.persona).toBe("response-memo-drafter");
  });

  it("routes to response-memo-drafter for FINTRAC audit replies", () => {
    const result = routePersona("Reply to the FINTRAC audit findings.");
    expect(result.persona).toBe("response-memo-drafter");
  });

  it("defaults to drafter when no signal is found", () => {
    const result = routePersona("Hello, how are you?");
    expect(result.persona).toBe("drafter");
    expect(result.reason).toContain("defaulting to drafter");
  });

  it("provides a reason for the routing decision", () => {
    const result = routePersona("Review the offering memo for gaps.");
    expect(result.reason).toBeTruthy();
    expect(typeof result.reason).toBe("string");
  });
});
