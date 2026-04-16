import { describe, it, expect } from "vitest";
import { buildRiskQueue, signalsFromMatter, type MatterSummary } from "../risk-queue";

function matter(partial: Partial<MatterSummary> & { id: string; title: string; taskType: string }): MatterSummary {
  return {
    status: "open",
    jurisdiction: "ontario",
    registrationCategory: "emd",
    lastActivityDaysAgo: 0,
    evidenceCounts: { missing: 0, requested: 0, stale: 0, present: 0, approved: 0 },
    surfaceCount: 0,
    ...partial,
  };
}

describe("signalsFromMatter", () => {
  it("escalates to critical when regulator exposure is flagged", () => {
    const m = matter({ id: "m-1", title: "t", taskType: "om-review", regulatorExposure: true });
    expect(signalsFromMatter(m).riskLevel).toBe("critical");
  });

  it("downgrades complete matters to low risk", () => {
    const m = matter({
      id: "m-1",
      title: "t",
      taskType: "om-review",
      status: "complete",
      evidenceCounts: { missing: 10, requested: 0, stale: 0, present: 0, approved: 0 },
    });
    expect(signalsFromMatter(m).riskLevel).toBe("low");
  });

  it("treats 5+ missing evidence items as high risk", () => {
    const m = matter({
      id: "m-1",
      title: "t",
      taskType: "om-review",
      evidenceCounts: { missing: 5, requested: 0, stale: 0, present: 0, approved: 0 },
    });
    expect(signalsFromMatter(m).riskLevel).toBe("high");
  });

  it("treats 2-4 missing as medium risk", () => {
    const m = matter({
      id: "m-1",
      title: "t",
      taskType: "om-review",
      evidenceCounts: { missing: 3, requested: 0, stale: 0, present: 0, approved: 0 },
    });
    expect(signalsFromMatter(m).riskLevel).toBe("medium");
  });

  it("reports worst evidence status across counts", () => {
    const allMissing = signalsFromMatter(
      matter({
        id: "a",
        title: "a",
        taskType: "om-review",
        evidenceCounts: { missing: 1, requested: 2, stale: 0, present: 5, approved: 3 },
      }),
    );
    expect(allMissing.evidenceStatus).toBe("missing");

    const stale = signalsFromMatter(
      matter({
        id: "b",
        title: "b",
        taskType: "om-review",
        evidenceCounts: { missing: 0, requested: 0, stale: 1, present: 1, approved: 0 },
      }),
    );
    expect(stale.evidenceStatus).toBe("stale");
  });
});

describe("buildRiskQueue", () => {
  it("returns empty for empty input", () => {
    expect(buildRiskQueue([])).toEqual([]);
  });

  it("returns every matter when topN >= matters.length", () => {
    const matters = [
      matter({ id: "a", title: "A", taskType: "om-review" }),
      matter({ id: "b", title: "B", taskType: "kyc-gap-check" }),
      matter({ id: "c", title: "C", taskType: "marketing-signoff" }),
    ];
    const queue = buildRiskQueue(matters);
    expect(queue.length).toBe(3);
  });

  it("limits to topN", () => {
    const matters = Array.from({ length: 10 }, (_, i) =>
      matter({ id: `m-${i}`, title: `Matter ${i}`, taskType: "om-review" }),
    );
    const queue = buildRiskQueue(matters, { topN: 5 });
    expect(queue.length).toBe(5);
  });

  it("includes score + signals for each item", () => {
    const queue = buildRiskQueue([
      matter({ id: "m-1", title: "M1", taskType: "om-review", regulatorExposure: true }),
    ]);
    expect(queue[0]!.score).toBeGreaterThan(0);
    expect(queue[0]!.signals.riskLevel).toBe("critical");
  });

  it("diversifies across task types", () => {
    // Seven OMs + one KYC. Without diversity, the queue would be OM-first, OM-first, ...
    // With UCB1 island diversity, the KYC should surface within the first few.
    const matters: MatterSummary[] = [];
    for (let i = 0; i < 7; i++) {
      matters.push(
        matter({
          id: `om-${i}`,
          title: `OM ${i}`,
          taskType: "om-review",
          evidenceCounts: { missing: 5, requested: 0, stale: 0, present: 0, approved: 0 },
        }),
      );
    }
    matters.push(
      matter({
        id: "kyc-1",
        title: "KYC",
        taskType: "kyc-gap-check",
        evidenceCounts: { missing: 3, requested: 0, stale: 0, present: 0, approved: 0 },
      }),
    );

    const queue = buildRiskQueue(matters, { topN: 3 });
    const taskTypes = queue.map((q) => q.item.taskType);
    // With 7 OMs and 1 KYC and topN=3, the diversity pass should include
    // at least one non-OM. Allow either ordering.
    expect(new Set(taskTypes).size).toBeGreaterThanOrEqual(2);
  });

  it("is deterministic for a fixed matter set", () => {
    const matters = [
      matter({ id: "a", title: "A", taskType: "om-review" }),
      matter({ id: "b", title: "B", taskType: "kyc-gap-check" }),
      matter({ id: "c", title: "C", taskType: "marketing-signoff" }),
    ];
    const q1 = buildRiskQueue(matters, { topN: 3 });
    const q2 = buildRiskQueue(matters, { topN: 3 });
    expect(q1.map((q) => q.item.id)).toEqual(q2.map((q) => q.item.id));
  });
});
