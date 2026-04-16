import { describe, it, expect } from "vitest";
import { scoreMatter } from "../recommender";
import type { Matter } from "../matter-store";

function makeMatter(overrides: Partial<Matter> = {}): Matter {
  const now = new Date("2026-04-16T12:00:00Z");
  return {
    id: "m1",
    organizationId: "preview",
    title: "Test matter",
    jurisdiction: "ontario",
    registrationCategory: "emd",
    taskType: "om-review",
    status: "open",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("scoreMatter", () => {
  const now = new Date("2026-04-16T12:00:00Z");

  it("returns negative urgency for complete matters", () => {
    const m = makeMatter({ status: "complete" });
    const r = scoreMatter(m, { hasDocs: true, transcriptLength: 5, now });
    expect(r.urgencyScore).toBe(-1);
  });

  it("returns negative urgency for archived matters", () => {
    const m = makeMatter({ status: "archived" });
    const r = scoreMatter(m, { hasDocs: false, transcriptLength: 0, now });
    expect(r.urgencyScore).toBe(-1);
  });

  it("adds a bump for in-review status", () => {
    const open = scoreMatter(makeMatter(), { hasDocs: false, transcriptLength: 0, now });
    const inReview = scoreMatter(makeMatter({ status: "in-review" }), {
      hasDocs: false,
      transcriptLength: 0,
      now,
    });
    expect(inReview.urgencyScore).toBeGreaterThan(open.urgencyScore);
    expect(inReview.reasons).toContain("in review");
  });

  it("adds staleness bump when updatedAt is older than 1 day", () => {
    const stale = new Date("2026-04-10T12:00:00Z");
    const r = scoreMatter(makeMatter({ updatedAt: stale }), {
      hasDocs: false,
      transcriptLength: 0,
      now,
    });
    expect(r.urgencyScore).toBeGreaterThan(0);
    expect(r.reasons.some((x) => x.includes("since update"))).toBe(true);
  });

  it("adds age bump when createdAt is older than 7 days", () => {
    const old = new Date("2026-03-30T12:00:00Z");
    const r = scoreMatter(makeMatter({ createdAt: old, updatedAt: old }), {
      hasDocs: false,
      transcriptLength: 0,
      now,
    });
    expect(r.reasons.some((x) => x.includes("old"))).toBe(true);
  });

  it("bumps when docs are uploaded but no transcript exists", () => {
    const r = scoreMatter(makeMatter(), {
      hasDocs: true,
      transcriptLength: 0,
      now,
    });
    expect(r.reasons).toContain("docs uploaded, no review yet");
  });

  it("bumps when the last judge verdict was ITERATE", () => {
    const r = scoreMatter(makeMatter(), {
      hasDocs: true,
      transcriptLength: 3,
      lastJudgeVerdict: "ITERATE",
      now,
    });
    expect(r.reasons.some((x) => x.includes("ITERATE"))).toBe(true);
  });

  it("defaults reason to 'open matter' when no other signal fires", () => {
    const r = scoreMatter(makeMatter(), {
      hasDocs: false,
      transcriptLength: 0,
      now,
    });
    expect(r.reasons).toContain("open matter");
  });
});
