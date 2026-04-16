import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryCognitionStore } from "../in-memory";
import type { CognitionItem } from "../types";

describe("InMemoryCognitionStore", () => {
  let store: InMemoryCognitionStore;

  beforeEach(async () => {
    store = new InMemoryCognitionStore();
  });

  it("adds and retrieves items", async () => {
    await store.add({
      id: "test-1",
      title: "Test item",
      content: "This is a test compliance document about securities regulation.",
      organizationId: "org-1",
    });

    expect(await store.size()).toBe(1);

    const item = await store.get("test-1");
    expect(item).not.toBeNull();
    expect(item!.title).toBe("Test item");
  });

  it("retrieves items matching a query", async () => {
    await store.addBatch([
      {
        id: "sec-1",
        title: "Securities regulation",
        content: "Offering memorandum requirements under NI 45-106.",
        organizationId: "org-1",
      },
      {
        id: "gdpr-1",
        title: "GDPR Article 5",
        content: "Data processing principles and lawful basis requirements.",
        organizationId: "org-1",
      },
    ]);

    const results = await store.retrieve({
      query: "offering memorandum securities",
      organizationId: "org-1",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.item.id).toBe("sec-1");
    expect(results[0]!.score).toBeGreaterThan(0);
  });

  it("filters by organizationId", async () => {
    await store.addBatch([
      { id: "a", title: "Org 1 doc", content: "Securities regulation", organizationId: "org-1" },
      { id: "b", title: "Org 2 doc", content: "Securities regulation", organizationId: "org-2" },
    ]);

    const results = await store.retrieve({
      query: "securities",
      organizationId: "org-1",
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.item.id).toBe("a");
  });

  it("filters by jurisdiction", async () => {
    await store.addBatch([
      {
        id: "on",
        title: "Ontario rule",
        content: "Securities offering memorandum Ontario",
        organizationId: "org-1",
        jurisdiction: "ontario",
      },
      {
        id: "qc",
        title: "Quebec rule",
        content: "Securities offering memorandum Quebec",
        organizationId: "org-1",
        jurisdiction: "quebec",
      },
    ]);

    const results = await store.retrieve({
      query: "offering memorandum securities",
      organizationId: "org-1",
      jurisdiction: "ontario",
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.item.id).toBe("on");
  });

  it("filters by registration category", async () => {
    await store.addBatch([
      {
        id: "emd",
        title: "EMD obligations",
        content: "Exempt market dealer know your client obligations",
        organizationId: "org-1",
        registrationCategories: ["emd"],
      },
      {
        id: "iiroc",
        title: "IIROC rules",
        content: "Dealer member know your client obligations",
        organizationId: "org-1",
        registrationCategories: ["iiroc"],
      },
    ]);

    const results = await store.retrieve({
      query: "know your client",
      organizationId: "org-1",
      registrationCategory: "emd",
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.item.id).toBe("emd");
  });

  it("returns items without jurisdiction/registration when those filters are set", async () => {
    // Items without jurisdiction/registrationCategories should pass through
    // (they're not restricted to any scope)
    await store.add({
      id: "general",
      title: "General securities rule",
      content: "Securities offering memorandum general rule",
      organizationId: "org-1",
      // no jurisdiction, no registrationCategories
    });

    const results = await store.retrieve({
      query: "securities offering",
      organizationId: "org-1",
      jurisdiction: "ontario",
      registrationCategory: "emd",
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.item.id).toBe("general");
  });

  it("respects scoreThreshold in jaccard mode", async () => {
    await store.add({
      id: "low",
      title: "Completely unrelated",
      content: "Banana chocolate cake recipe baking",
      organizationId: "org-1",
    });

    const results = await store.retrieve({
      query: "securities regulation offering memorandum",
      organizationId: "org-1",
      scoreThreshold: 0.1,
      searchMode: "jaccard",
    });

    // The unrelated doc should score below 0.1 on Jaccard
    expect(results).toHaveLength(0);
  });

  it("respects topK", async () => {
    for (let i = 0; i < 10; i++) {
      await store.add({
        id: `item-${i}`,
        title: `Securities rule ${i}`,
        content: `Offering memorandum requirement section ${i} securities regulation.`,
        organizationId: "org-1",
      });
    }

    const results = await store.retrieve({
      query: "offering memorandum securities",
      organizationId: "org-1",
      topK: 3,
    });

    expect(results.length).toBeLessThanOrEqual(3);
  });

  it("removes items", async () => {
    await store.add({ id: "rm-me", title: "Removable", content: "Content", organizationId: "org-1" });
    expect(await store.size()).toBe(1);

    const removed = await store.remove("rm-me");
    expect(removed).toBe(true);
    expect(await store.size()).toBe(0);
  });

  it("resets the store", async () => {
    await store.addBatch([
      { id: "a", title: "A", content: "A", organizationId: "org-1" },
      { id: "b", title: "B", content: "B", organizationId: "org-1" },
    ]);
    expect(await store.size()).toBe(2);

    await store.reset();
    expect(await store.size()).toBe(0);
  });
});
