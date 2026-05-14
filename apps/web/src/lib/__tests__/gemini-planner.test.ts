import { describe, it, expect } from "vitest";
import { plan, isGeminiConfigured } from "../demo/gemini-planner";

describe("gemini-planner", () => {
  describe("isGeminiConfigured", () => {
    it("is false without an API key", () => {
      expect(isGeminiConfigured({})).toBe(false);
    });
    it("is true when GEMINI_API_KEY is set", () => {
      expect(isGeminiConfigured({ GEMINI_API_KEY: "k" })).toBe(true);
    });
    it("is false for empty-string key", () => {
      expect(isGeminiConfigured({ GEMINI_API_KEY: "" })).toBe(false);
    });
  });

  describe("plan() — deterministic fallback", () => {
    it("returns deterministic source when no key is set", async () => {
      const result = await plan("any text", {});
      expect(result.source).toBe("deterministic");
      expect(result.model).toBe("stub");
      expect(result.lanes.length).toBeGreaterThan(0);
      expect(result.summary).toContain("review lanes");
    });

    it("deterministic plan always covers the four canonical lanes", async () => {
      const result = await plan("any text", {});
      const names = result.lanes.map((l) => l.name);
      expect(names).toContain("securities");
      expect(names).toContain("privacy");
      expect(names).toContain("marketing-signoff");
      expect(names).toContain("ai-use");
    });

    it("each lane has a rationale", async () => {
      const result = await plan("any text", {});
      for (const lane of result.lanes) {
        expect(typeof lane.rationale).toBe("string");
        expect(lane.rationale.length).toBeGreaterThan(10);
      }
    });
  });
});
