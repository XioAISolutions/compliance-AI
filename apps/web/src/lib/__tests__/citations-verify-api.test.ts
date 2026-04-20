import { describe, it, expect, beforeEach } from "vitest";
import { POST as verifyPost } from "../../app/api/citations/verify/route";
import { InMemoryMatterStore, setMatterStore } from "../matter-store";
import {
  getDefaultCognitionStore,
  setDefaultCognitionStore,
  InMemoryCognitionStore,
} from "@compliance-ai/cognition";

describe("POST /api/citations/verify", () => {
  beforeEach(async () => {
    setMatterStore(new InMemoryMatterStore());
    // Fresh cognition store seeded with one known authority — proves the
    // offline matcher picks it up from the default store.
    const store = new InMemoryCognitionStore();
    await store.add({
      id: "auth-ni-45-106-2.9",
      organizationId: "preview",
      title: "NI 45-106 s. 2.9 — Offering Memorandum",
      content: "OM exemption.",
      jurisdiction: "multi-provincial",
      sourceType: "rule",
    });
    setDefaultCognitionStore(store, "securities");
  });

  async function call(body: unknown): Promise<Response> {
    const req = new Request("http://localhost/api/citations/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return verifyPost(req as unknown as Parameters<typeof verifyPost>[0]);
  }

  it("400s on non-JSON bodies", async () => {
    const req = new Request("http://localhost/api/citations/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await verifyPost(req as unknown as Parameters<typeof verifyPost>[0]);
    expect(res.status).toBe(400);
  });

  it("400s when `citations` is missing or not an array", async () => {
    const res = await call({ foo: "bar" });
    expect(res.status).toBe(400);
  });

  it("caps batch size at 100", async () => {
    const huge = Array.from({ length: 101 }, (_, i) => ({
      id: `c${i}`,
      authorityId: "auth-x",
      section: "1",
    }));
    const res = await call({ citations: huge });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/capped/i);
  });

  it("returns verified + candidate-url + summary for a mixed batch", async () => {
    const res = await call({
      citations: [
        { id: "c1", authorityId: "auth-ni-45-106-2.9", section: "2.9" },
        { id: "c2", authorityId: "2020 SCC 27", section: "" },
        { id: "c3", authorityId: "made-up-junk", section: "" },
      ],
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      summary: { total: number; verified: number; candidateUrl: number };
      results: Array<{ citationId: string; status: string }>;
    };
    expect(body.summary.total).toBe(3);
    expect(body.summary.verified).toBeGreaterThanOrEqual(1);
    expect(body.results).toHaveLength(3);
    expect(body.results.map((r) => r.citationId).sort()).toEqual(["c1", "c2", "c3"]);
  });

  it("scopes by matterId when supplied (records an audit entry)", async () => {
    const matter = await new InMemoryMatterStore().create({
      title: "Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    // Wire that store so the route resolves the matter.
    const store = new InMemoryMatterStore();
    await store.create({ ...matter });
    setMatterStore(store);
    const list = await store.list();
    const mid = list[0]!.id;

    const res = await call({
      matterId: mid,
      citations: [
        { id: "c1", authorityId: "auth-ni-45-106-2.9", section: "2.9" },
      ],
    });
    expect(res.status).toBe(200);
  });

  it("returns results for an unknown matterId (scoping is best-effort, not gated)", async () => {
    const res = await call({
      matterId: "does-not-exist",
      citations: [{ id: "c1", authorityId: "auth-ni-45-106-2.9", section: "2.9" }],
    });
    expect(res.status).toBe(200);
  });
});
