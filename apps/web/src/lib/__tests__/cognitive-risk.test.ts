import { describe, it, expect } from "vitest";
import {
  computeCognitiveRisk,
  MILAN_SCENARIO_TEXT,
} from "../demo/cognitive-risk";

describe("computeCognitiveRisk", () => {
  it("scores zero on neutral text", () => {
    const result = computeCognitiveRisk(
      "The board reviewed the quarterly results and approved the standard disclosure package.",
    );
    expect(result.score).toBe(0);
    expect(result.dimensions.emotionalActivation).toBe(0);
    expect(result.dimensions.certaintyPressure).toBe(0);
    expect(result.dimensions.trustErosion).toBe(0);
    expect(result.dimensions.urgencyCompression).toBe(0);
  });

  it("scores high on the canonical Milan scenario", () => {
    const result = computeCognitiveRisk(MILAN_SCENARIO_TEXT);
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.dimensions.urgencyCompression).toBeGreaterThanOrEqual(60);
    expect(result.dimensions.certaintyPressure).toBeGreaterThanOrEqual(60);
  });

  it("is deterministic — same input produces same output", () => {
    const a = computeCognitiveRisk(MILAN_SCENARIO_TEXT);
    const b = computeCognitiveRisk(MILAN_SCENARIO_TEXT);
    expect(a).toEqual(b);
  });

  it("varies with input — removing pressure language drops the score", () => {
    const heavy = computeCognitiveRisk(MILAN_SCENARIO_TEXT);
    const cleaned = computeCognitiveRisk(
      MILAN_SCENARIO_TEXT.replace(/guaranteed|protected returns|risk-free|100%/gi, "performance-dependent")
        .replace(/instant approval|no paperwork/gi, "human review")
        .replace(/closing today|act now|only a few seats left/gi, "open enrollment"),
    );
    expect(cleaned.score).toBeLessThan(heavy.score);
  });

  it("isolates urgency from certainty — pure-urgency text does not score on certainty", () => {
    const result = computeCognitiveRisk(
      "Closing today. Act now. Limited spots. Last chance. Hurry.",
    );
    expect(result.dimensions.urgencyCompression).toBeGreaterThan(0);
    expect(result.dimensions.certaintyPressure).toBe(0);
  });
});
