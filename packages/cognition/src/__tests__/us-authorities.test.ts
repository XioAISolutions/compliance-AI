/**
 * Tests for the US securities authority corpus.
 *
 * Mirror the ni-45-106-authorities.test.ts shape so that the two corpora
 * are held to the same structural standard:
 *   1. Corpus shape and integrity — ids unique, required fields present,
 *      jurisdiction tag consistent.
 *   2. Coverage — the Regulation D / Rule 144 / Securities Act sections
 *      named in the plan are all present.
 *   3. Retrieval behaviour — BM25 returns the expected top hit for each
 *      canonical US-Q&A query.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { US_SECURITIES_AUTHORITIES } from "../us-securities-authorities";
import { InMemoryCognitionStore } from "../in-memory";
import type { CognitionStore } from "../types";

describe("US_SECURITIES_AUTHORITIES — corpus shape", () => {
  it("contains at least 15 items covering Reg D, Rule 144, Securities Act §§ 4(a)(2) and 5", () => {
    expect(US_SECURITIES_AUTHORITIES.length).toBeGreaterThanOrEqual(15);
  });

  it("all item ids are unique", () => {
    const ids = US_SECURITIES_AUTHORITIES.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every item has required CognitionItem fields", () => {
    for (const item of US_SECURITIES_AUTHORITIES) {
      expect(item.id).toBeTruthy();
      expect(item.id).toMatch(/^auth-us-/);
      expect(item.organizationId).toBe("preview");
      expect(item.title).toBeTruthy();
      expect(item.content).toBeTruthy();
      expect(item.content.length).toBeGreaterThan(50);
      expect(item.source).toBeTruthy();
      expect(item.jurisdiction).toBe("US");
    }
  });

  it("no content block exceeds the size budget (≤ 7500 chars)", () => {
    const MAX = 7500;
    for (const item of US_SECURITIES_AUTHORITIES) {
      if (item.content.length > MAX) {
        throw new Error(
          `Item ${item.id} has ${item.content.length} chars (> ${MAX}). Title: ${item.title}`,
        );
      }
    }
  });
});

describe("US_SECURITIES_AUTHORITIES — coverage", () => {
  const byId = (id: string) => US_SECURITIES_AUTHORITIES.find((a) => a.id === id);

  it("covers Securities Act § 5 (registration requirement)", () => {
    expect(byId("auth-us-secact-5")).toBeDefined();
  });

  it("covers Securities Act § 4(a)(2) (private placement exemption)", () => {
    const item = byId("auth-us-secact-4-a-2");
    expect(item).toBeDefined();
    expect(item!.content).toContain("public offering");
  });

  it("covers Rule 501(a) accredited investor definition", () => {
    const item = byId("auth-us-regd-501-accredited-investor");
    expect(item).toBeDefined();
    // Key dollar thresholds must appear verbatim for Q&A to cite them.
    expect(item!.content).toContain("$1,000,000");
    expect(item!.content).toContain("$200,000");
    expect(item!.content).toContain("$300,000");
  });

  it("covers Rule 502(c) general solicitation limitation", () => {
    expect(byId("auth-us-regd-502-c-general-solicitation")).toBeDefined();
  });

  it("covers Rule 502(a) integration framework", () => {
    expect(byId("auth-us-regd-502-a-integration")).toBeDefined();
  });

  it("covers Rule 503 Form D filing requirement", () => {
    const item = byId("auth-us-regd-503-form-d-filing");
    expect(item).toBeDefined();
    expect(item!.content).toContain("15 calendar days");
  });

  it("covers Rule 504 limited offering exemption", () => {
    expect(byId("auth-us-regd-504")).toBeDefined();
  });

  it("covers Rule 506(b) private placement without general solicitation", () => {
    const item = byId("auth-us-regd-506-b");
    expect(item).toBeDefined();
    expect(item!.content).toContain("35 purchasers");
  });

  it("covers Rule 506(c) general solicitation with accredited verification", () => {
    const item = byId("auth-us-regd-506-c");
    expect(item).toBeDefined();
    expect(item!.content.toLowerCase()).toContain("verify");
  });

  it("covers Rule 144 resale holding period", () => {
    const item = byId("auth-us-rule-144-holding-period");
    expect(item).toBeDefined();
    expect(item!.content).toContain("6 months");
    expect(item!.content).toContain("1 year");
  });

  it("covers Rule 144A QIB resales", () => {
    expect(byId("auth-us-rule-144a")).toBeDefined();
  });

  it("covers Form D notice itself", () => {
    expect(byId("auth-us-form-d")).toBeDefined();
  });
});

describe("US_SECURITIES_AUTHORITIES — BM25 retrieval behaviour", () => {
  let store: CognitionStore;

  beforeAll(async () => {
    store = new InMemoryCognitionStore();
    await store.addBatch(US_SECURITIES_AUTHORITIES);
  });

  const canonicalQueries: ReadonlyArray<{
    query: string;
    expectIdInTop5: readonly string[];
  }> = [
    {
      query: "Who qualifies as an accredited investor?",
      expectIdInTop5: ["auth-us-regd-501-accredited-investor"],
    },
    {
      query: "general solicitation verification rule 506",
      expectIdInTop5: ["auth-us-regd-506-c", "auth-us-regd-502-c-general-solicitation"],
    },
    {
      query: "35 purchaser limit private placement",
      expectIdInTop5: ["auth-us-regd-506-b"],
    },
    {
      query: "Form D filing 15 days first sale",
      expectIdInTop5: ["auth-us-regd-503-form-d-filing", "auth-us-form-d"],
    },
    {
      query: "holding period restricted securities resale",
      expectIdInTop5: ["auth-us-rule-144-holding-period"],
    },
    {
      query: "qualified institutional buyer QIB",
      expectIdInTop5: ["auth-us-rule-144a"],
    },
  ];

  for (const { query, expectIdInTop5 } of canonicalQueries) {
    it(`surfaces a relevant section for "${query}"`, async () => {
      const results = await store.retrieve({
        query,
        topK: 5,
        organizationId: "preview",
        jurisdiction: "US",
      });
      expect(results.length).toBeGreaterThan(0);
      const topIds = results.map((r) => r.item.id ?? "");
      const hasExpected = topIds.some((id) => expectIdInTop5.includes(id));
      if (!hasExpected) {
        throw new Error(
          `Query "${query}" expected top-5 hit in [${expectIdInTop5.join(", ")}] but got [${topIds.join(", ")}]`,
        );
      }
    });
  }

  it("jurisdiction filter restricts to US items (no Canadian overlap with Canada-seeded cross-test)", async () => {
    // All items in this store are US-tagged; the filter should not accidentally
    // exclude them. Guards against a regression where jurisdiction-match logic
    // inverts or becomes case-sensitive.
    const results = await store.retrieve({
      query: "securities",
      topK: 5,
      jurisdiction: "US",
    });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.item.jurisdiction).toBe("US");
    }
  });
});
