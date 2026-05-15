import { describe, it, expect } from "vitest";
import {
  MILAN_SCENARIO_TEXT,
  computeCognitiveRisk,
} from "../demo/cognitive-risk";

/**
 * The /api/demo/milan/scenario route splits MILAN_SCENARIO_TEXT into
 * three artifacts (deck / transcript / claim) by re-parsing the
 * `[deck]` / `[call]` / `[claim]` tags. We don't import the route
 * directly (avoids hauling Next route-handler types into the test
 * env), but we want to keep the canonical source-of-truth test:
 * the scenario string must contain all three tags and the score
 * must remain deterministic.
 */
describe("Milan canonical scenario", () => {
  it("contains [deck], [call], and [claim] tag markers", () => {
    expect(MILAN_SCENARIO_TEXT).toMatch(/\[deck\]/);
    expect(MILAN_SCENARIO_TEXT).toMatch(/\[call\]/);
    expect(MILAN_SCENARIO_TEXT).toMatch(/\[claim\]/);
  });

  it("produces the pinned cognitive-risk score (78)", () => {
    const result = computeCognitiveRisk(MILAN_SCENARIO_TEXT);
    expect(result.score).toBe(78);
  });

  it("has at least one line per artifact tag", () => {
    const lines = MILAN_SCENARIO_TEXT.split("\n");
    const deckLines = lines.filter((l) => l.startsWith("[deck]"));
    const callLines = lines.filter((l) => l.startsWith("[call]"));
    const claimLines = lines.filter((l) => l.startsWith("[claim]"));
    expect(deckLines.length).toBeGreaterThanOrEqual(1);
    expect(callLines.length).toBeGreaterThanOrEqual(1);
    expect(claimLines.length).toBeGreaterThanOrEqual(1);
  });
});
