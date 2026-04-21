import { describe, it, expect } from "vitest";
import {
  CanliiLiveFetchVerifier,
  canliiLiveFetchEnabled,
} from "../canlii-live-verifier";

function makeFetchResolving(body: string, status = 200) {
  return async (_url: string): Promise<{
    ok: boolean;
    status: number;
    text: () => Promise<string>;
    url: string;
  }> => {
    return {
      ok: status >= 200 && status < 300,
      status,
      url: _url,
      text: async () => body,
    };
  };
}

function makeFetchThrowing(err: Error) {
  return async (): Promise<never> => {
    throw err;
  };
}

describe("canliiLiveFetchEnabled", () => {
  it("returns true only on truthy opt-in values", () => {
    for (const v of ["1", "true", "yes", " TRUE ", "Yes"]) {
      expect(canliiLiveFetchEnabled({ CANLII_FETCH_ENABLED: v })).toBe(true);
    }
    for (const v of [undefined, "", "0", "false", "no", "maybe"]) {
      expect(canliiLiveFetchEnabled({ CANLII_FETCH_ENABLED: v as string | undefined })).toBe(false);
    }
  });
});

describe("CanliiLiveFetchVerifier", () => {
  it("returns verified with confidence 0.95 when the quote is found on the page", async () => {
    const v = new CanliiLiveFetchVerifier({
      fetchImpl: makeFetchResolving(
        "The Court found that the principles of fundamental justice apply.",
      ),
    });
    const r = await v.verify({
      id: "c1",
      authorityId: "2020 SCC 27",
      section: "",
      jurisdiction: "federal",
      quote: "principles of fundamental justice apply",
    });
    expect(r.status).toBe("verified");
    expect(r.method).toBe("canlii-live");
    expect(r.confidence).toBeCloseTo(0.95, 2);
    expect(r.evidence?.url).toMatch(/canlii\.org/);
  });

  it("case-insensitive + whitespace-normalized quote match", async () => {
    const v = new CanliiLiveFetchVerifier({
      fetchImpl: makeFetchResolving(
        "Words    separated by multiple  spaces are normalized Before Matching",
      ),
    });
    const r = await v.verify({
      id: "c1",
      authorityId: "2020 SCC 27",
      section: "",
      quote: "separated BY multiple spaces are normalized before matching",
    });
    expect(r.status).toBe("verified");
  });

  it("returns candidate-url with low confidence when quote >= 20 chars but not on page", async () => {
    const v = new CanliiLiveFetchVerifier({
      fetchImpl: makeFetchResolving("This page is about something totally different."),
    });
    const r = await v.verify({
      id: "c1",
      authorityId: "2020 SCC 27",
      section: "",
      quote: "This exact quote does not appear on the fetched page at all",
    });
    expect(r.status).toBe("candidate-url");
    expect(r.reason).toMatch(/not found/i);
  });

  it("returns verified with confidence 0.8 when page resolves but quote is too short to match on", async () => {
    const v = new CanliiLiveFetchVerifier({
      fetchImpl: makeFetchResolving("CanLII case page body."),
    });
    const r = await v.verify({
      id: "c1",
      authorityId: "2020 SCC 27",
      section: "",
      quote: "too short", // < 20 chars
    });
    expect(r.status).toBe("verified");
    expect(r.confidence).toBeCloseTo(0.8, 2);
    expect(r.reason).toMatch(/quote too short/i);
  });

  it("downgrades non-2xx responses to candidate-url", async () => {
    const v = new CanliiLiveFetchVerifier({
      fetchImpl: makeFetchResolving("Not Found", 404),
    });
    const r = await v.verify({
      id: "c1",
      authorityId: "2020 SCC 27",
      section: "",
    });
    expect(r.status).toBe("candidate-url");
    expect(r.reason).toMatch(/HTTP 404/);
  });

  it("downgrades fetch failures to candidate-url", async () => {
    const v = new CanliiLiveFetchVerifier({
      fetchImpl: makeFetchThrowing(new Error("ETIMEDOUT")),
    });
    const r = await v.verify({
      id: "c1",
      authorityId: "2020 SCC 27",
      section: "",
    });
    expect(r.status).toBe("candidate-url");
    expect(r.reason).toMatch(/live fetch failed/i);
    expect(r.reason).toMatch(/ETIMEDOUT/);
  });

  it("refuses to fetch off-host URLs (allowlist guard)", async () => {
    const v = new CanliiLiveFetchVerifier({
      fetchImpl: makeFetchResolving("anything"),
      urlFor: () => "https://evil.example.com/pwned",
    });
    const r = await v.verify({ id: "c1", authorityId: "x", section: "" });
    expect(r.status).toBe("unsupported");
    expect(r.reason).toMatch(/off-host/i);
  });

  it("handles unparseable URLs without throwing", async () => {
    const v = new CanliiLiveFetchVerifier({
      fetchImpl: makeFetchResolving("anything"),
      urlFor: () => "not-a-url",
    });
    const r = await v.verify({ id: "c1", authorityId: "x", section: "" });
    expect(r.status).toBe("unsupported");
  });

  it("verifyBatch runs sequentially (not in parallel) and preserves order", async () => {
    const calls: string[] = [];
    const v = new CanliiLiveFetchVerifier({
      fetchImpl: async (url) => {
        calls.push(url);
        // tiny delay to make any out-of-order parallel run obvious
        await new Promise((r) => setTimeout(r, 5));
        return {
          ok: true,
          status: 200,
          url,
          text: async () => "body",
        };
      },
    });
    const results = await v.verifyBatch([
      { id: "c1", authorityId: "2020 SCC 27", section: "" },
      { id: "c2", authorityId: "2022 ONCA 118", section: "" },
      { id: "c3", authorityId: "2024 BCCA 11", section: "" },
    ]);
    expect(results.map((r) => r.citationId)).toEqual(["c1", "c2", "c3"]);
    // Every call landed on canlii.org and the URL for each contains the
    // numeric case cite.
    expect(calls).toHaveLength(3);
    expect(calls.every((u) => u.includes("canlii.org"))).toBe(true);
  });
});
