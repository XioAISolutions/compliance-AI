import { describe, it, expect } from "vitest";
import { PERSONA_SYSTEM_PROMPTS, PERSONA_LABELS } from "../personas";
import type { PersonaId } from "../types";

const EXPECTED_PERSONAS: PersonaId[] = [
  "drafter",
  "reviewer",
  "evidence-collector",
  "risk-assessor",
  "judge",
  "om-reviewer",
  "kyc-reviewer",
  "marketing-reviewer",
  "response-drafter",
];

describe("PERSONA_SYSTEM_PROMPTS", () => {
  it("covers every PersonaId", () => {
    for (const id of EXPECTED_PERSONAS) {
      expect(PERSONA_SYSTEM_PROMPTS[id]).toBeTypeOf("string");
      expect(PERSONA_SYSTEM_PROMPTS[id].length).toBeGreaterThan(100);
    }
  });

  it("has a label for every persona id", () => {
    for (const id of EXPECTED_PERSONAS) {
      expect(PERSONA_LABELS[id]).toBeTruthy();
    }
  });

  it("kyc-reviewer system prompt references NI 31-103 Part 13 and FINTRAC", () => {
    const p = PERSONA_SYSTEM_PROMPTS["kyc-reviewer"];
    expect(p).toContain("NI 31-103 Part 13");
    expect(p).toMatch(/FINTRAC|PCMLTFA/);
  });

  it("marketing-reviewer system prompt references NI 81-102 Part 15", () => {
    const p = PERSONA_SYSTEM_PROMPTS["marketing-reviewer"];
    expect(p).toContain("NI 81-102");
    expect(p).toMatch(/Part 15/);
  });

  it("response-drafter system prompt references regulators and follow-up commitments", () => {
    const p = PERSONA_SYSTEM_PROMPTS["response-drafter"];
    expect(p.toLowerCase()).toMatch(/regulat(or|ory)/);
    expect(p.toLowerCase()).toContain("commitment");
  });

  it("om-reviewer system prompt still anchors on NI 45-106 and OSC Rule 45-501", () => {
    const p = PERSONA_SYSTEM_PROMPTS["om-reviewer"];
    expect(p).toContain("NI 45-106");
    expect(p).toContain("OSC Rule 45-501");
  });
});
