import { describe, it, expect } from "vitest";
import {
  transcribe,
  isSpeechmaticsConfigured,
} from "../demo/speechmatics-transcribe";

describe("speechmatics-transcribe", () => {
  describe("isSpeechmaticsConfigured", () => {
    it("is false without an API key", () => {
      expect(isSpeechmaticsConfigured({})).toBe(false);
    });
    it("is true when SPEECHMATICS_API_KEY is set", () => {
      expect(isSpeechmaticsConfigured({ SPEECHMATICS_API_KEY: "k" })).toBe(true);
    });
  });

  describe("transcribe() — deterministic fallback", () => {
    it("returns deterministic source when no key is set", async () => {
      const result = await transcribe({});
      expect(result.source).toBe("deterministic");
      expect(result.auth).toBeNull();
      expect(result.transcript.length).toBeGreaterThan(0);
    });

    it("transcript contains advisor + prospect markers", async () => {
      const result = await transcribe({});
      expect(result.transcript).toContain("[advisor]");
      expect(result.transcript).toContain("[prospect]");
    });
  });
});
