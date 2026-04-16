import { describe, it, expect } from "vitest";
import { calculatePriorityScore, prioritize } from "../optimizer";

describe("calculatePriorityScore", () => {
  it("scores critical-risk missing-evidence imminent-deadline maximally", () => {
    const score = calculatePriorityScore({
      riskLevel: "critical",
      evidenceStatus: "missing",
      dueInDays: 0,
      aiExposure: true,
      personalDataExposure: true,
      regulatorExposure: true,
    });
    // 100 (critical) + 30 (missing) + 30 (deadline) + 12 + 10 + 14 = 196
    expect(score).toBe(196);
  });

  it("scores low-risk approved-evidence far-deadline minimally", () => {
    const score = calculatePriorityScore({
      riskLevel: "low",
      evidenceStatus: "approved",
      dueInDays: 365,
    });
    // 20 + 0 + 0 + 0 = 20
    expect(score).toBe(20);
  });

  it("clamps deadline pressure at 30 days", () => {
    const a = calculatePriorityScore({
      riskLevel: "low",
      evidenceStatus: "approved",
      dueInDays: 30,
    });
    const b = calculatePriorityScore({
      riskLevel: "low",
      evidenceStatus: "approved",
      dueInDays: 100,
    });
    expect(a).toBe(b); // both are beyond the pressure threshold
  });

  it("exposure flags are additive", () => {
    const base = calculatePriorityScore({
      riskLevel: "medium",
      evidenceStatus: "present",
      dueInDays: 30,
    });
    const withAi = calculatePriorityScore({
      riskLevel: "medium",
      evidenceStatus: "present",
      dueInDays: 30,
      aiExposure: true,
    });
    expect(withAi).toBe(base + 12);
  });

  it("deadline pressure kicks in inside the 30-day window", () => {
    const far = calculatePriorityScore({
      riskLevel: "low",
      evidenceStatus: "approved",
      dueInDays: 30,
    });
    const near = calculatePriorityScore({
      riskLevel: "low",
      evidenceStatus: "approved",
      dueInDays: 5,
    });
    expect(near).toBeGreaterThan(far);
  });
});

describe("prioritize", () => {
  it("sorts highest score first", () => {
    const items = [
      { item: "low", signals: { riskLevel: "low" as const, evidenceStatus: "approved" as const, dueInDays: 100 } },
      { item: "high", signals: { riskLevel: "high" as const, evidenceStatus: "missing" as const, dueInDays: 3 } },
      { item: "medium", signals: { riskLevel: "medium" as const, evidenceStatus: "stale" as const, dueInDays: 15 } },
    ];

    const prioritized = prioritize(items);
    expect(prioritized.map((p) => p.item)).toEqual(["high", "medium", "low"]);
  });

  it("is stable on ties (preserves input order)", () => {
    const a = { item: "a", signals: { riskLevel: "low" as const, evidenceStatus: "approved" as const, dueInDays: 30 } };
    const b = { item: "b", signals: { riskLevel: "low" as const, evidenceStatus: "approved" as const, dueInDays: 30 } };
    const c = { item: "c", signals: { riskLevel: "low" as const, evidenceStatus: "approved" as const, dueInDays: 30 } };

    const prioritized = prioritize([a, b, c]);
    expect(prioritized.map((p) => p.item)).toEqual(["a", "b", "c"]);
  });
});
