import { describe, it, expect } from "vitest";
import { getPartnerStatuses } from "../demo/partner-status";

describe("getPartnerStatuses", () => {
  it("reports all partners as not live when env is empty", () => {
    const result = getPartnerStatuses({});
    expect(result).toHaveLength(4);
    expect(result.map((p) => p.id)).toEqual([
      "vultr",
      "gemini",
      "speechmatics",
      "featherless",
    ]);
    for (const p of result) {
      expect(p.live).toBe(false);
    }
  });

  it("activates Gemini when GEMINI_API_KEY is set", () => {
    const result = getPartnerStatuses({ GEMINI_API_KEY: "test-key" });
    const gemini = result.find((p) => p.id === "gemini")!;
    expect(gemini.live).toBe(true);
    const speechmatics = result.find((p) => p.id === "speechmatics")!;
    expect(speechmatics.live).toBe(false);
  });

  it("activates all four when all env vars are set", () => {
    const result = getPartnerStatuses({
      VULTR_DEPLOY: "1",
      GEMINI_API_KEY: "k",
      SPEECHMATICS_API_KEY: "k",
      FEATHERLESS_API_KEY: "k",
    });
    expect(result.every((p) => p.live)).toBe(true);
  });

  it("VULTR_API_KEY also activates the Vultr row", () => {
    const result = getPartnerStatuses({ VULTR_API_KEY: "abc" });
    const vultr = result.find((p) => p.id === "vultr")!;
    expect(vultr.live).toBe(true);
  });

  it("does not activate Gemini for empty-string key", () => {
    const result = getPartnerStatuses({ GEMINI_API_KEY: "" });
    const gemini = result.find((p) => p.id === "gemini")!;
    expect(gemini.live).toBe(false);
  });
});
