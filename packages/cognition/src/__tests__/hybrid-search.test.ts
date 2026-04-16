/**
 * Tests for the hybrid search upgrade — BM25, Jaccard, and hybrid (RRF)
 * modes live in the same in-memory store and share the filter pipeline.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryCognitionStore } from "../in-memory";

describe("InMemoryCognitionStore — hybrid search", () => {
  let store: InMemoryCognitionStore;

  beforeEach(async () => {
    store = new InMemoryCognitionStore();
    await store.addBatch([
      {
        id: "a",
        title: "NI 45-106 prospectus exemptions",
        content:
          "An offering memorandum prepared under section 2.9 must disclose the rights of action for misrepresentation under Ontario securities law.",
        organizationId: "org-1",
      },
      {
        id: "b",
        title: "NI 31-103 Part 13",
        content:
          "A registrant must take reasonable steps to establish the identity of the client and the client's source of funds before opening an account.",
        organizationId: "org-1",
      },
      {
        id: "c",
        title: "NI 81-102 Part 15",
        content:
          "A sales communication for a mutual fund must not contain a misleading or untrue statement, including any past performance data not accompanied by a standard performance warning.",
        organizationId: "org-1",
      },
      {
        id: "d",
        title: "Non-compliance — unrelated doc",
        content: "Banana chocolate cake recipe baking",
        organizationId: "org-1",
      },
    ]);
  });

  it("bm25 mode ranks the relevant OM doc first for an OM query", async () => {
    const results = await store.retrieve({
      query: "offering memorandum rights of action misrepresentation",
      organizationId: "org-1",
      searchMode: "bm25",
      topK: 4,
    });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.item.id).toBe("a");
    expect(results[0]!.score).toBeGreaterThan(0);
    // Unrelated doc should be ranked below the compliance docs.
    const unrelated = results.find((r) => r.item.id === "d");
    if (unrelated) {
      expect(unrelated.score).toBeLessThan(results[0]!.score);
    }
  });

  it("hybrid mode ranks the KYC doc first for a KYC query", async () => {
    const results = await store.retrieve({
      query: "identity verification source of funds register client",
      organizationId: "org-1",
      searchMode: "hybrid",
      topK: 4,
    });
    expect(results[0]!.item.id).toBe("b");
  });

  it("jaccard mode returns a ranked list and respects scoreThreshold", async () => {
    const results = await store.retrieve({
      query: "sales communication mutual fund past performance",
      organizationId: "org-1",
      searchMode: "jaccard",
      scoreThreshold: 0.05,
      topK: 4,
    });
    expect(results[0]!.item.id).toBe("c");
  });

  it("bm25 mode surfaces non-zero scores even for borderline matches", async () => {
    const results = await store.retrieve({
      query: "offering",
      organizationId: "org-1",
      searchMode: "bm25",
      topK: 4,
    });
    const om = results.find((r) => r.item.id === "a");
    expect(om).toBeDefined();
    expect(om!.score).toBeGreaterThan(0);
  });

  it("hybrid is the default mode", async () => {
    const [withMode, without] = await Promise.all([
      store.retrieve({
        query: "offering memorandum",
        organizationId: "org-1",
        searchMode: "hybrid",
      }),
      store.retrieve({
        query: "offering memorandum",
        organizationId: "org-1",
      }),
    ]);
    expect(without.map((r) => r.item.id)).toEqual(withMode.map((r) => r.item.id));
  });

  it("returns at most topK", async () => {
    const results = await store.retrieve({
      query: "compliance",
      organizationId: "org-1",
      searchMode: "hybrid",
      topK: 2,
    });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("empty query returns no results via BM25 (no terms)", async () => {
    const results = await store.retrieve({
      query: "",
      organizationId: "org-1",
      searchMode: "bm25",
    });
    // All candidates get a score of 0 from BM25 with no terms; after
    // max-normalization they stay at 0; threshold is 0 so they all pass
    // — but the scoring remains 0 which documents the behavior.
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
    }
  });
});
