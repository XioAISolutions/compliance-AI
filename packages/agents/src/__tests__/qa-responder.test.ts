/**
 * Structural tests for the QA_RESPONDER_SYSTEM prompt.
 *
 * These tests are intentionally coarse — they don't try to validate prose
 * quality, just that the load-bearing instructions (empty-retrieval refusal
 * branch, dual-audience sections, standing disclaimer, never-fabricate
 * citation rule) are all present. A refactor that silently deletes the
 * refusal branch or the disclaimer would flip these tests red.
 *
 * Also checks the persona is registered end-to-end: it appears in
 * PERSONA_SYSTEM_PROMPTS and PERSONA_LABELS, the router's scoring record
 * is exhaustive for it, and the heuristic router never picks it.
 */

import { describe, it, expect } from "vitest";
import { QA_RESPONDER_SYSTEM } from "../personas/qa-responder";
import { PERSONA_SYSTEM_PROMPTS, PERSONA_LABELS } from "../personas/index";
import { routePersona } from "../router";

describe("QA_RESPONDER_SYSTEM — prompt shape", () => {
  it("declares the dual-audience output sections", () => {
    expect(QA_RESPONDER_SYSTEM).toContain("### Plain-language summary");
    expect(QA_RESPONDER_SYSTEM).toContain("### Professional answer");
    expect(QA_RESPONDER_SYSTEM).toContain("### Cross-jurisdiction note");
  });

  it("declares the empty-retrieval refusal branch", () => {
    // Covers: "RETRIEVAL GAP" directive cooperation with renderCognitionContext.
    expect(QA_RESPONDER_SYSTEM).toContain("RETRIEVAL GAP");
    expect(QA_RESPONDER_SYSTEM.toLowerCase()).toContain("no authorities");
  });

  it("forbids fabricating citation markers", () => {
    expect(QA_RESPONDER_SYSTEM.toLowerCase()).toContain("never fabricate");
    expect(QA_RESPONDER_SYSTEM).toContain("[cN]");
  });

  it("mandates the non-advice disclaimer in every response", () => {
    // The key load-bearing phrases in the disclaimer.
    expect(QA_RESPONDER_SYSTEM).toContain("not legal advice");
    expect(QA_RESPONDER_SYSTEM).toContain("qualified counsel");
  });

  it("instructs to omit the cross-jurisdiction note when it does not apply", () => {
    // Guard against a drift where the persona starts emitting boilerplate
    // "N/A" notes for single-jurisdiction answers.
    expect(QA_RESPONDER_SYSTEM).toContain("OMIT this section entirely");
  });

  it("prefers verbatim quotes for thresholds / definitions", () => {
    expect(QA_RESPONDER_SYSTEM.toLowerCase()).toContain("verbatim");
  });
});

describe("qa-responder persona registration", () => {
  it("is present in PERSONA_SYSTEM_PROMPTS", () => {
    expect(PERSONA_SYSTEM_PROMPTS["qa-responder"]).toBe(QA_RESPONDER_SYSTEM);
  });

  it("has a human-readable label", () => {
    expect(PERSONA_LABELS["qa-responder"]).toBeTruthy();
    expect(PERSONA_LABELS["qa-responder"].length).toBeGreaterThan(0);
  });

  it("is NEVER selected by the heuristic router (force-only persona)", () => {
    // Sample a few prompts that could plausibly match Q&A-ish language —
    // the router should pick drafter/reviewer/etc., never qa-responder.
    const qaLikePrompts = [
      "What is an accredited investor?",
      "Who qualifies under Rule 506?",
      "Tell me about the offering memorandum exemption.",
      "Answer this question about securities.",
      "Explain the difference between 506(b) and 506(c).",
    ];
    for (const prompt of qaLikePrompts) {
      const decision = routePersona(prompt);
      expect(decision.persona).not.toBe("qa-responder");
    }
  });
});
