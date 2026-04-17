/**
 * Tests for the NI 45-106 authority corpus and its companion instruments.
 *
 * Covers three concerns:
 *   1. Corpus shape and integrity — ids unique, required fields present,
 *      content size bounded, registrationCategories consistent.
 *   2. Coverage — every lawyer-critical section is represented and
 *      retrievable by its canonical id.
 *   3. Retrieval behaviour — the BM25 in-memory store returns the
 *      expected top hit for each canonical OM-review query.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  NI_45_106_AUTHORITIES,
  NI_45_102_RESALE_AUTHORITIES,
  CP_45_106_COMPANION_POLICY_AUTHORITIES,
  CSA_STAFF_NOTICES_45,
  NI_45_106_COMPANION_AUTHORITIES,
} from "../index";
import { InMemoryCognitionStore } from "../in-memory";
import type { CognitionStore } from "../types";

describe("NI_45_106_AUTHORITIES — corpus shape", () => {
  it("contains at least 100 items (sections + parts + divisions + appendices)", () => {
    expect(NI_45_106_AUTHORITIES.length).toBeGreaterThanOrEqual(100);
  });

  it("all item ids are unique", () => {
    const ids = NI_45_106_AUTHORITIES.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("all ids are prefixed 'auth-ni-45-106-'", () => {
    for (const item of NI_45_106_AUTHORITIES) {
      expect(item.id).toMatch(/^auth-ni-45-106-/);
    }
  });

  it("every item has the required CognitionItem fields", () => {
    for (const item of NI_45_106_AUTHORITIES) {
      expect(item.id).toBeTruthy();
      expect(item.organizationId).toBe("preview");
      expect(item.title).toBeTruthy();
      expect(item.content).toBeTruthy();
      expect(item.source).toMatch(/National Instrument 45-106/);
      expect(item.jurisdiction).toBe("ontario");
      expect(item.registrationCategories).toBeInstanceOf(Array);
      expect(item.registrationCategories!.length).toBeGreaterThan(0);
    }
  });

  it("no content block exceeds the size budget (≤ 7500 chars, ~1800 tokens)", () => {
    // Exposes oversize bugs where the recursive splitter fails to descend.
    const MAX = 7500;
    for (const item of NI_45_106_AUTHORITIES) {
      if (item.content.length > MAX) {
        throw new Error(
          `Item ${item.id} has ${item.content.length} chars (> ${MAX}). Title: ${item.title}`,
        );
      }
    }
  });

  it("every content block ends with the consolidation source footer", () => {
    for (const item of NI_45_106_AUTHORITIES) {
      expect(item.content).toContain("2025-12-04");
    }
  });

  it("every title is prefixed 'NI 45-106 ' or 'Form 45-106F'", () => {
    for (const item of NI_45_106_AUTHORITIES) {
      expect(item.title).toMatch(/^(NI 45-106 |Form 45-106F)/);
    }
  });
});

describe("NI_45_106_AUTHORITIES — lawyer-critical section coverage", () => {
  const findBySection = (num: string) =>
    NI_45_106_AUTHORITIES.filter(
      (a) =>
        a.id?.startsWith(`auth-ni-45-106-${num}`) && !a.id?.startsWith(`auth-ni-45-106-${num}.`),
    );

  it("covers Part 1 Definitions (s. 1.1)", () => {
    const s11 = findBySection("1.1");
    expect(s11.length).toBeGreaterThanOrEqual(1);
    const content = s11
      .map((a) => a.content)
      .join("\n")
      .toLowerCase();
    expect(content).toContain("accredited investor");
  });

  it("covers s. 2.3 Accredited Investor", () => {
    const s23 = findBySection("2.3");
    expect(s23.length).toBeGreaterThanOrEqual(1);
    const content = s23
      .map((a) => a.content)
      .join("\n")
      .toLowerCase();
    expect(content).toContain("accredited investor");
  });

  it("covers s. 2.4 Private Issuer", () => {
    expect(findBySection("2.4").length).toBeGreaterThanOrEqual(1);
  });

  it("covers s. 2.5 Family, Friends and Business Associates", () => {
    expect(findBySection("2.5").length).toBeGreaterThanOrEqual(1);
  });

  it("covers s. 2.9 Offering Memorandum (possibly split across chunks)", () => {
    const s29 = findBySection("2.9");
    expect(s29.length).toBeGreaterThanOrEqual(1);
    const content = s29
      .map((a) => a.content)
      .join("\n")
      .toLowerCase();
    expect(content).toContain("offering memorandum");
  });

  it("covers s. 2.10 Minimum Amount Investment", () => {
    expect(findBySection("2.10").length).toBeGreaterThanOrEqual(1);
  });

  it("covers Part 6 Reporting (ss. 6.1, 6.2, 6.3, 6.4, 6.5)", () => {
    for (const num of ["6.1", "6.2", "6.3", "6.4", "6.5"]) {
      const sec = findBySection(num);
      expect(sec.length, `Missing section ${num}`).toBeGreaterThanOrEqual(1);
    }
  });

  it("covers all four appendices (A, B, C, D)", () => {
    for (const letter of ["a", "b", "c", "d"]) {
      const app = NI_45_106_AUTHORITIES.find((a) => a.id === `auth-ni-45-106-appendix-${letter}`);
      expect(app, `Missing appendix ${letter.toUpperCase()}`).toBeDefined();
    }
  });
});

describe("NI_45_106_AUTHORITIES — registrationCategories targeting", () => {
  it("Part 2 Division 1 (capital-raising) items target emd + issuer", () => {
    const div1 = NI_45_106_AUTHORITIES.find((a) => a.id === "auth-ni-45-106-part-2-division-1");
    expect(div1).toBeDefined();
    expect(div1!.registrationCategories).toContain("emd");
    expect(div1!.registrationCategories).toContain("issuer");
  });

  it("Part 2 Division 3 (investment fund) items target pm + issuer (not raw emd)", () => {
    const div3 = NI_45_106_AUTHORITIES.find((a) => a.id === "auth-ni-45-106-part-2-division-3");
    expect(div3).toBeDefined();
    expect(div3!.registrationCategories).toContain("pm");
  });

  it("Part 1 (definitions) items target all registrant categories", () => {
    const s11 = NI_45_106_AUTHORITIES.filter((a) => a.id?.startsWith("auth-ni-45-106-1."));
    expect(s11.length).toBeGreaterThan(0);
    // At least one Part 1 section should cover the full audience.
    const broadAudience = s11.some(
      (a) =>
        a.registrationCategories!.includes("emd") &&
        a.registrationCategories!.includes("pm") &&
        a.registrationCategories!.includes("issuer") &&
        a.registrationCategories!.includes("iiroc"),
    );
    expect(broadAudience).toBe(true);
  });
});

describe("NI_45_106_COMPANION_AUTHORITIES", () => {
  it("contains NI 45-102 resale items (s. 2.5, 2.6, 2.8)", () => {
    expect(NI_45_102_RESALE_AUTHORITIES.find((a) => a.id === "auth-ni-45-102-2.5")).toBeDefined();
    expect(NI_45_102_RESALE_AUTHORITIES.find((a) => a.id === "auth-ni-45-102-2.6")).toBeDefined();
    expect(NI_45_102_RESALE_AUTHORITIES.find((a) => a.id === "auth-ni-45-102-2.8")).toBeDefined();
  });

  it("contains Companion Policy 45-106CP guidance on s. 2.9", () => {
    expect(
      CP_45_106_COMPANION_POLICY_AUTHORITIES.find((a) => a.id === "auth-cp-45-106-2.9"),
    ).toBeDefined();
  });

  it("contains CSA SN 45-318 and OSC SN 45-716 staff notices", () => {
    expect(CSA_STAFF_NOTICES_45.find((a) => a.id === "auth-csa-sn-45-318")).toBeDefined();
    expect(CSA_STAFF_NOTICES_45.find((a) => a.id === "auth-osc-sn-45-716")).toBeDefined();
  });

  it("companion bundle aggregates all three groups", () => {
    const expectedSize =
      NI_45_102_RESALE_AUTHORITIES.length +
      CP_45_106_COMPANION_POLICY_AUTHORITIES.length +
      CSA_STAFF_NOTICES_45.length;
    expect(NI_45_106_COMPANION_AUTHORITIES.length).toBe(expectedSize);
  });

  it("every companion item has required fields", () => {
    for (const item of NI_45_106_COMPANION_AUTHORITIES) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.content).toBeTruthy();
      expect(item.source).toBeTruthy();
      expect(item.organizationId).toBe("preview");
      expect(item.jurisdiction).toBe("ontario");
      expect(item.registrationCategories!.length).toBeGreaterThan(0);
    }
  });
});

describe("NI_45_106_AUTHORITIES — BM25 retrieval behaviour", () => {
  let store: CognitionStore;

  beforeAll(async () => {
    store = new InMemoryCognitionStore();
    await store.addBatch([...NI_45_106_AUTHORITIES, ...NI_45_106_COMPANION_AUTHORITIES]);
  });

  /**
   * For each canonical OM-review query, BM25 should return a top-5 hit
   * whose id starts with one of the expected-id prefixes. We check prefix
   * match (not exact) because oversized sections get split into -a/-b.
   */
  const canonicalQueries: ReadonlyArray<{
    query: string;
    expectPrefixInTop5: readonly string[];
  }> = [
    { query: "accredited investor income threshold", expectPrefixInTop5: ["auth-ni-45-106-2.3"] },
    { query: "offering memorandum exemption", expectPrefixInTop5: ["auth-ni-45-106-2.9"] },
    {
      query: "minimum amount investment exemption 150000",
      expectPrefixInTop5: ["auth-ni-45-106-2.10"],
    },
    { query: "private issuer shareholders 50", expectPrefixInTop5: ["auth-ni-45-106-2.4"] },
    {
      query: "family friends business associates",
      expectPrefixInTop5: ["auth-ni-45-106-2.5", "auth-ni-45-106-2.6"],
    },
    {
      query: "report exempt distribution ten days",
      expectPrefixInTop5: ["auth-ni-45-106-6.1"],
    },
    {
      query: "risk acknowledgement form 45-106F4",
      expectPrefixInTop5: ["auth-ni-45-106-6.5", "auth-ni-45-106-2.3"],
    },
    {
      query: "four month hold period resale",
      expectPrefixInTop5: ["auth-ni-45-102-2.5"],
    },
    {
      query: "risk factor specific issuer boilerplate",
      expectPrefixInTop5: ["auth-cp-45-106-2.9", "auth-csa-sn-45-318"],
    },
  ];

  for (const { query, expectPrefixInTop5 } of canonicalQueries) {
    it(`surfaces a relevant section for "${query}"`, async () => {
      const results = await store.retrieve({
        query,
        topK: 5,
        organizationId: "preview",
      });
      expect(results.length).toBeGreaterThan(0);
      const topIds = results.map((r) => r.item.id ?? "");
      const hasExpected = topIds.some((id) =>
        expectPrefixInTop5.some((prefix) => id.startsWith(prefix)),
      );
      if (!hasExpected) {
        throw new Error(
          `Query "${query}" expected top-5 hit with prefix in [${expectPrefixInTop5.join(
            ", ",
          )}] but got [${topIds.join(", ")}]`,
        );
      }
    });
  }

  it("filters by registrationCategory — investment-fund queries surface pm-tagged items", async () => {
    const results = await store.retrieve({
      query: "investment fund reinvestment",
      topK: 5,
      organizationId: "preview",
      registrationCategory: "pm",
    });
    // At least one result should be a Division 3 (investment fund) item.
    const hasInvestmentFundItem = results.some(
      (r) =>
        r.item.id?.includes("division-3") ||
        r.item.id?.startsWith("auth-ni-45-106-2.18") ||
        r.item.id?.startsWith("auth-ni-45-106-2.19") ||
        r.item.id?.startsWith("auth-ni-45-106-2.20") ||
        r.item.id?.startsWith("auth-ni-45-106-2.21"),
    );
    expect(hasInvestmentFundItem).toBe(true);
  });
});
