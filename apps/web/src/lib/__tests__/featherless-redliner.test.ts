import { describe, it, expect } from "vitest";
import { redline, isFeatherlessConfigured } from "../demo/featherless-redliner";

describe("featherless-redliner", () => {
  describe("isFeatherlessConfigured", () => {
    it("is false without an API key", () => {
      expect(isFeatherlessConfigured({})).toBe(false);
    });
    it("is true when FEATHERLESS_API_KEY is set", () => {
      expect(isFeatherlessConfigured({ FEATHERLESS_API_KEY: "k" })).toBe(true);
    });
  });

  describe("redline() — deterministic fallback", () => {
    it("returns deterministic source when no key is set", async () => {
      const result = await redline("any text", {});
      expect(result.source).toBe("deterministic");
      expect(result.model).toBe("stub");
      expect(result.edits.length).toBeGreaterThan(0);
    });

    it("each deterministic edit has before/after/reason", async () => {
      const result = await redline("any text", {});
      for (const edit of result.edits) {
        expect(typeof edit.before).toBe("string");
        expect(typeof edit.after).toBe("string");
        expect(typeof edit.reason).toBe("string");
        expect(edit.before.length).toBeGreaterThan(0);
        expect(edit.after.length).toBeGreaterThan(0);
        expect(edit.reason.length).toBeGreaterThan(0);
      }
    });
  });
});
