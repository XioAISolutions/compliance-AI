import { describe, it, expect, beforeEach } from "vitest";
import { POST as verifyPost } from "../../app/api/citations/verify/route";
import {
  InMemoryCognitionStore,
  setDefaultCognitionStore,
} from "@compliance-ai/cognition";

/**
 * Contract test — the matter-page VerifyBadge component renders from
 * four fields of each result: status, reason (as a tooltip),
 * evidence.url (as the anchor href), and evidence.matchedTitle (as a
 * readable fallback). This test pins those fields so a future API
 * refactor that drops one of them fails here instead of rendering a
 * broken badge.
 */
describe("POST /api/citations/verify — UI contract", () => {
  beforeEach(async () => {
    const store = new InMemoryCognitionStore();
    await store.add({
      id: "auth-ni-45-106-2.9",
      organizationId: "preview",
      title: "NI 45-106 s. 2.9",
      content: "OM exemption.",
      jurisdiction: "multi-provincial",
    });
    setDefaultCognitionStore(store, "securities");
  });

  async function call(citations: unknown): Promise<Response> {
    const req = new Request("http://localhost/api/citations/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ citations }),
    });
    return verifyPost(req as unknown as Parameters<typeof verifyPost>[0]);
  }

  it("every verified result carries status, reason, confidence, evidence.matchedTitle", async () => {
    const res = await call([
      { id: "c1", authorityId: "auth-ni-45-106-2.9", section: "2.9" },
    ]);
    const body = (await res.json()) as { results: Array<Record<string, unknown>> };
    const r = body.results[0]!;
    expect(r.status).toBe("verified");
    expect(typeof r.reason).toBe("string");
    expect(typeof r.confidence).toBe("number");
    expect(typeof (r.evidence as Record<string, unknown>)?.matchedTitle).toBe("string");
  });

  it("every candidate-url result carries a valid http(s) URL the UI can render as an anchor href", async () => {
    const res = await call([
      { id: "c1", authorityId: "2020 SCC 27", section: "" },
      { id: "c2", authorityId: "made-up-junk", section: "" },
    ]);
    const body = (await res.json()) as {
      results: Array<{ status: string; evidence?: { url?: string } }>;
    };
    for (const r of body.results) {
      expect(r.status).toBe("candidate-url");
      expect(r.evidence?.url).toMatch(/^https?:\/\//);
    }
  });

  it("summary breakdown fields exist with the names the UI's useMemo uses", async () => {
    const res = await call([
      { id: "c1", authorityId: "auth-ni-45-106-2.9", section: "2.9" },
      { id: "c2", authorityId: "2020 SCC 27", section: "" },
    ]);
    const body = (await res.json()) as {
      summary: Record<string, unknown>;
    };
    for (const key of ["total", "verified", "candidateUrl", "unsupported", "notFound", "error"]) {
      expect(body.summary).toHaveProperty(key);
      expect(typeof body.summary[key]).toBe("number");
    }
  });

  it("citationId round-trips — UI keys the badge map by citation id", async () => {
    const res = await call([
      { id: "c-alpha", authorityId: "auth-ni-45-106-2.9", section: "2.9" },
      { id: "c-beta", authorityId: "2020 SCC 27", section: "" },
    ]);
    const body = (await res.json()) as { results: Array<{ citationId: string }> };
    const ids = body.results.map((r) => r.citationId);
    expect(ids).toContain("c-alpha");
    expect(ids).toContain("c-beta");
  });
});
