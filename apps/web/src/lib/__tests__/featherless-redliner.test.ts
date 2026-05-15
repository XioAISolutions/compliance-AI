import { afterEach, describe, expect, it, vi } from "vitest";
import { redline, isFeatherlessConfigured } from "../demo/featherless-redliner";

describe("featherless-redliner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  describe("redline() — Featherless request", () => {
    it("caps output tokens for chat completions", async () => {
      const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
      const fetchMock = vi.fn(
        async (_input: RequestInfo | URL, _init?: RequestInit) =>
          Response.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    edits: [
                      {
                        before: "Guaranteed performance.",
                        after: "Performance varies and is not guaranteed.",
                        reason: "Qualify absolute performance language.",
                      },
                    ],
                  }),
                },
              },
            ],
          }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const result = await redline("Guaranteed performance.", {
        FEATHERLESS_API_KEY: "test-key",
      });

      expect(result.source).toBe("featherless");
      const init = fetchMock.mock.calls[0]?.[1];
      expect(init).toBeDefined();
      expect(JSON.parse(String(init?.body))).toMatchObject({
        max_tokens: 512,
      });
      expect(timeoutSpy).toHaveBeenCalledWith(30_000);
    });
  });
});
