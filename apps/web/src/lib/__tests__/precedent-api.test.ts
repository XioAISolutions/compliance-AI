import { describe, it, expect, beforeEach } from "vitest";
import {
  POST as precedentPost,
  GET as precedentGet,
} from "../../app/api/precedent/route";
import {
  InMemoryCognitionStore,
  setDefaultCognitionStore,
} from "@compliance-ai/cognition";

describe("POST /api/precedent — firm precedent ingest", () => {
  let store: InMemoryCognitionStore;

  beforeEach(() => {
    store = new InMemoryCognitionStore();
    setDefaultCognitionStore(store, "securities");
  });

  async function call(body: unknown): Promise<Response> {
    const req = new Request("http://localhost/api/precedent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return precedentPost(req as unknown as Parameters<typeof precedentPost>[0]);
  }

  it("400s on missing title", async () => {
    const res = await call({ content: "x".repeat(100) });
    expect(res.status).toBe(400);
  });

  it("400s when content is under 50 chars (too thin to be a citable precedent)", async () => {
    const res = await call({ title: "t", content: "too short" });
    expect(res.status).toBe(400);
  });

  it("400s on bogus privilege values", async () => {
    const res = await call({
      title: "t",
      content: "x".repeat(100),
      privilege: "top-secret",
    });
    expect(res.status).toBe(400);
  });

  it("creates a firm-precedent cognition item with work-product privilege by default", async () => {
    const res = await call({
      title: "Glencairn OM response — 2024",
      content: "In Glencairn we argued that section 2.9 required ".repeat(4),
      jurisdiction: "ontario",
      registrationCategories: ["emd"],
      authorityDate: "2024-06-12",
      source: "Internal memo #1472",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      sourceType: string;
      privilege: string;
      jurisdiction: string;
    };
    expect(body.sourceType).toBe("firm-precedent");
    expect(body.privilege).toBe("work-product");
    expect(body.jurisdiction).toBe("ontario");
    // Round-trip: the cognition store sees the new item with the
    // tagged sourceType + privilege + jurisdiction.
    const stored = await store.get(body.id);
    expect(stored?.sourceType).toBe("firm-precedent");
    expect(stored?.privilege).toBe("work-product");
    expect(stored?.jurisdiction).toBe("ontario");
  });

  it("honors an explicit privilege override", async () => {
    const res = await call({
      title: "Public presentation notes",
      content: "Publicly disclosed client-facing talk; not privileged.".repeat(4),
      privilege: "none",
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { privilege: string };
    expect(body.privilege).toBe("none");
  });
});

describe("GET /api/precedent — firm precedent listing", () => {
  let store: InMemoryCognitionStore;

  beforeEach(async () => {
    store = new InMemoryCognitionStore();
    setDefaultCognitionStore(store, "securities");
    // Non-precedent seed item — must not appear in the listing.
    await store.add({
      organizationId: "preview",
      title: "NI 45-106 s. 2.9",
      content: "The offering memorandum exemption.",
      sourceType: "rule",
      jurisdiction: "multi-provincial",
    });
  });

  async function call(query = ""): Promise<Response> {
    const req = new Request(`http://localhost/api/precedent${query}`);
    return precedentGet(req as unknown as Parameters<typeof precedentGet>[0]);
  }

  it("returns 0 when no firm-precedent items are in the corpus", async () => {
    const res = await call();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number; items: unknown[] };
    expect(body.count).toBe(0);
    expect(body.items).toEqual([]);
  });

  it("lists only firm-precedent items scoped to the requested org", async () => {
    await store.add({
      organizationId: "preview",
      title: "Memo A",
      content: "a".repeat(80),
      sourceType: "firm-precedent",
      privilege: "work-product",
      jurisdiction: "ontario",
    });
    await store.add({
      organizationId: "preview",
      title: "Memo B",
      content: "b".repeat(80),
      sourceType: "firm-precedent",
      privilege: "solicitor-client",
      authorityDate: "2023-04-01",
    });
    await store.add({
      organizationId: "other-tenant",
      title: "Someone else's memo",
      content: "c".repeat(80),
      sourceType: "firm-precedent",
    });

    const res = await call("?organizationId=preview");
    const body = (await res.json()) as {
      count: number;
      items: Array<{ title: string; privilege: string; jurisdiction: string | null }>;
    };
    expect(body.count).toBe(2);
    const titles = body.items.map((i) => i.title).sort();
    expect(titles).toEqual(["Memo A", "Memo B"]);
  });
});

describe("Retrieval merge — firm precedent appears alongside statutes", () => {
  it("a firm-precedent item flows through to reviewer retrieval", async () => {
    const store = new InMemoryCognitionStore();
    setDefaultCognitionStore(store, "securities");

    await store.add({
      organizationId: "preview",
      title: "NI 45-106 s. 2.9",
      content: "Offering memorandum exemption requires prescribed disclosure.",
      sourceType: "rule",
      jurisdiction: "multi-provincial",
    });
    await store.add({
      organizationId: "preview",
      title: "Glencairn OM response 2024",
      content: "In the Glencairn matter we argued section 2.9 required specific risk-factor disclosure and the OSC agreed.",
      sourceType: "firm-precedent",
      privilege: "work-product",
      jurisdiction: "ontario",
    });

    const hits = await store.retrieve({
      query: "Glencairn section 2.9 disclosure",
      jurisdiction: "ontario",
      organizationId: "preview",
    });
    const precedentHit = hits.find((h) => h.item.sourceType === "firm-precedent");
    const ruleHit = hits.find((h) => h.item.sourceType === "rule");
    expect(precedentHit).toBeDefined();
    expect(ruleHit).toBeDefined();
    expect(precedentHit!.item.title).toContain("Glencairn");
    expect(precedentHit!.item.privilege).toBe("work-product");
  });
});
