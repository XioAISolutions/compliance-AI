/**
 * Tests for the pan-Canadian consumer-protection corpus.
 *
 * Holds the 15-jurisdiction corpus to the same structural standard as
 * the NI 45-106 and US securities corpora:
 *   1. Shape — ids unique, required fields populated, jurisdiction set
 *      to the expected value per file.
 *   2. Coverage — every province, territory, federal, and multi-
 *      provincial bucket is present, each with at least one item.
 *   3. Retrieval — canonical queries surface the expected authority
 *      within a top-5 BM25 result set.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  CANADA_CONSUMER_PROTECTION_AUTHORITIES,
  FEDERAL_CONSUMER_PROTECTION_AUTHORITIES,
  ONTARIO_CONSUMER_PROTECTION_AUTHORITIES,
  QUEBEC_CONSUMER_PROTECTION_AUTHORITIES,
  BC_BPCPA_AUTHORITIES,
  ALBERTA_CPA_AUTHORITIES,
  SASKATCHEWAN_CPBPA_AUTHORITIES,
  MANITOBA_CONSUMER_PROTECTION_AUTHORITIES,
  NOVA_SCOTIA_CPA_AUTHORITIES,
  NEW_BRUNSWICK_CPA_AUTHORITIES,
  NEWFOUNDLAND_CPBPA_AUTHORITIES,
  PEI_CPA_AUTHORITIES,
  YUKON_CPA_AUTHORITIES,
  NWT_CPA_AUTHORITIES,
  NUNAVUT_CPA_AUTHORITIES,
  MULTI_PROVINCIAL_CONSUMER_PROTECTION_AUTHORITIES,
} from "../index";
import { InMemoryCognitionStore } from "../in-memory";
import type { CognitionItem, CognitionStore } from "../types";

const EXPECTED_JURISDICTIONS = [
  "federal",
  "ontario",
  "quebec",
  "british-columbia",
  "alberta",
  "saskatchewan",
  "manitoba",
  "nova-scotia",
  "new-brunswick",
  "newfoundland",
  "pei",
  "yukon",
  "northwest-territories",
  "nunavut",
  "multi-provincial",
] as const;

describe("CANADA_CONSUMER_PROTECTION_AUTHORITIES — corpus shape", () => {
  it("aggregates at least one item per jurisdiction", () => {
    const present = new Set(CANADA_CONSUMER_PROTECTION_AUTHORITIES.map((a) => a.jurisdiction));
    for (const j of EXPECTED_JURISDICTIONS) {
      expect(present.has(j)).toBe(true);
    }
  });

  it("all item ids are unique across the aggregate", () => {
    const ids = CANADA_CONSUMER_PROTECTION_AUTHORITIES.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every item has required CognitionItem fields", () => {
    for (const item of CANADA_CONSUMER_PROTECTION_AUTHORITIES) {
      expect(item.id).toBeTruthy();
      expect(item.organizationId).toBe("preview");
      expect(item.title).toBeTruthy();
      expect(item.content).toBeTruthy();
      expect(item.content.length).toBeGreaterThan(100);
      expect(item.source).toBeTruthy();
      expect(item.jurisdiction).toBeTruthy();
      expect(item.registrationCategories).toBeDefined();
      expect(item.registrationCategories!.length).toBeGreaterThan(0);
      expect(item.registrationCategories!).toContain("consumer-protection");
    }
  });

  it("no content block exceeds the size budget (≤ 7500 chars)", () => {
    const MAX = 7500;
    for (const item of CANADA_CONSUMER_PROTECTION_AUTHORITIES) {
      if (item.content.length > MAX) {
        throw new Error(
          `Item ${item.id} has ${item.content.length} chars (> ${MAX}). Title: ${item.title}`,
        );
      }
    }
  });

  it("aggregator size equals the sum of its parts", () => {
    const parts =
      FEDERAL_CONSUMER_PROTECTION_AUTHORITIES.length +
      ONTARIO_CONSUMER_PROTECTION_AUTHORITIES.length +
      QUEBEC_CONSUMER_PROTECTION_AUTHORITIES.length +
      BC_BPCPA_AUTHORITIES.length +
      ALBERTA_CPA_AUTHORITIES.length +
      SASKATCHEWAN_CPBPA_AUTHORITIES.length +
      MANITOBA_CONSUMER_PROTECTION_AUTHORITIES.length +
      NOVA_SCOTIA_CPA_AUTHORITIES.length +
      NEW_BRUNSWICK_CPA_AUTHORITIES.length +
      NEWFOUNDLAND_CPBPA_AUTHORITIES.length +
      PEI_CPA_AUTHORITIES.length +
      YUKON_CPA_AUTHORITIES.length +
      NWT_CPA_AUTHORITIES.length +
      NUNAVUT_CPA_AUTHORITIES.length +
      MULTI_PROVINCIAL_CONSUMER_PROTECTION_AUTHORITIES.length;
    expect(CANADA_CONSUMER_PROTECTION_AUTHORITIES.length).toBe(parts);
  });
});

describe("Per-jurisdiction corpus — jurisdiction tag consistency", () => {
  const jurisdictionCases: ReadonlyArray<{
    name: string;
    items: CognitionItem[];
    expectedJurisdiction: string;
  }> = [
    {
      name: "federal",
      items: FEDERAL_CONSUMER_PROTECTION_AUTHORITIES,
      expectedJurisdiction: "federal",
    },
    {
      name: "ontario",
      items: ONTARIO_CONSUMER_PROTECTION_AUTHORITIES,
      expectedJurisdiction: "ontario",
    },
    {
      name: "quebec",
      items: QUEBEC_CONSUMER_PROTECTION_AUTHORITIES,
      expectedJurisdiction: "quebec",
    },
    {
      name: "british-columbia",
      items: BC_BPCPA_AUTHORITIES,
      expectedJurisdiction: "british-columbia",
    },
    {
      name: "alberta",
      items: ALBERTA_CPA_AUTHORITIES,
      expectedJurisdiction: "alberta",
    },
    {
      name: "saskatchewan",
      items: SASKATCHEWAN_CPBPA_AUTHORITIES,
      expectedJurisdiction: "saskatchewan",
    },
    {
      name: "manitoba",
      items: MANITOBA_CONSUMER_PROTECTION_AUTHORITIES,
      expectedJurisdiction: "manitoba",
    },
    {
      name: "nova-scotia",
      items: NOVA_SCOTIA_CPA_AUTHORITIES,
      expectedJurisdiction: "nova-scotia",
    },
    {
      name: "new-brunswick",
      items: NEW_BRUNSWICK_CPA_AUTHORITIES,
      expectedJurisdiction: "new-brunswick",
    },
    {
      name: "newfoundland",
      items: NEWFOUNDLAND_CPBPA_AUTHORITIES,
      expectedJurisdiction: "newfoundland",
    },
    {
      name: "pei",
      items: PEI_CPA_AUTHORITIES,
      expectedJurisdiction: "pei",
    },
    {
      name: "yukon",
      items: YUKON_CPA_AUTHORITIES,
      expectedJurisdiction: "yukon",
    },
    {
      name: "northwest-territories",
      items: NWT_CPA_AUTHORITIES,
      expectedJurisdiction: "northwest-territories",
    },
    {
      name: "nunavut",
      items: NUNAVUT_CPA_AUTHORITIES,
      expectedJurisdiction: "nunavut",
    },
    {
      name: "multi-provincial",
      items: MULTI_PROVINCIAL_CONSUMER_PROTECTION_AUTHORITIES,
      expectedJurisdiction: "multi-provincial",
    },
  ];

  for (const { name, items, expectedJurisdiction } of jurisdictionCases) {
    it(`${name} — at least one item and jurisdiction tag is "${expectedJurisdiction}"`, () => {
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.jurisdiction).toBe(expectedJurisdiction);
      }
    });
  }
});

describe("Coverage — key statutes present", () => {
  const byId = (id: string) =>
    CANADA_CONSUMER_PROTECTION_AUTHORITIES.find((a) => a.id === id);

  it("covers federal Competition Act s. 52, s. 74.01, s. 74.011 (drip pricing)", () => {
    expect(byId("auth-ca-competition-act-52")).toBeDefined();
    expect(byId("auth-ca-competition-act-74.01")).toBeDefined();
    expect(byId("auth-ca-competition-act-74.011")).toBeDefined();
  });

  it("covers PIPEDA consent and breach reporting", () => {
    expect(byId("auth-ca-pipeda-principle-3")).toBeDefined();
    expect(byId("auth-ca-pipeda-breach-reporting")).toBeDefined();
  });

  it("covers CASL s. 6 commercial electronic messages", () => {
    const casl = byId("auth-ca-casl-6");
    expect(casl).toBeDefined();
    expect(casl!.content).toContain("unsubscribe");
  });

  it("covers Ontario CPA 2002 s. 14 unfair practices", () => {
    expect(byId("auth-on-cpa-2002-14")).toBeDefined();
  });

  it("covers Ontario CPA 2002 internet agreement rules (ss. 37-40)", () => {
    expect(byId("auth-on-cpa-2002-distance")).toBeDefined();
  });

  it("covers Quebec CPA art. 11.1 class action waiver prohibition", () => {
    const qc = byId("auth-qc-cpa-11");
    expect(qc).toBeDefined();
    expect(qc!.content).toContain("11.1");
  });

  it("covers Quebec CPA art. 272 remedies (Richard v. Time)", () => {
    const qc = byId("auth-qc-cpa-272");
    expect(qc).toBeDefined();
    expect(qc!.content.toLowerCase()).toContain("richard");
  });

  it("covers BC BPCPA s. 4 deceptive acts and s. 8 unconscionable acts", () => {
    expect(byId("auth-bc-bpcpa-4")).toBeDefined();
    expect(byId("auth-bc-bpcpa-8")).toBeDefined();
  });

  it("covers Alberta direct-sales framework and payday loans regime", () => {
    expect(byId("auth-ab-cpa-direct-sales")).toBeDefined();
    expect(byId("auth-ab-cpa-payday-loans")).toBeDefined();
  });

  it("covers Saskatchewan CPBPA unfair practices and direct sales", () => {
    expect(byId("auth-sk-cpbpa-6")).toBeDefined();
    expect(byId("auth-sk-cpbpa-direct-sales")).toBeDefined();
  });

  it("covers Manitoba BPA unfair practices and CPA prepaid purchase cards", () => {
    expect(byId("auth-mb-bpa-2")).toBeDefined();
    expect(byId("auth-mb-cpa-prepaid-purchase-cards")).toBeDefined();
  });

  it("covers all four Atlantic provinces' core unfair-practice statutes", () => {
    expect(byId("auth-ns-cpa-26")).toBeDefined();
    expect(byId("auth-nb-cpwla-warranties")).toBeDefined();
    expect(byId("auth-nl-cpbpa-7")).toBeDefined();
    expect(byId("auth-pei-bpa-2")).toBeDefined();
  });

  it("covers all three territories", () => {
    expect(byId("auth-yt-cpa-58")).toBeDefined();
    expect(byId("auth-nt-cpa-direct-sales")).toBeDefined();
    expect(byId("auth-nu-cpa-adopted-from-nwt")).toBeDefined();
  });

  it("covers Internet Sales Contract Harmonization Template", () => {
    const ischt = byId("auth-mp-ischt-2001");
    expect(ischt).toBeDefined();
    expect(ischt!.content).toContain("15 days");
  });

  it("covers the Competition Bureau Deceptive Marketing Practices Digest", () => {
    expect(byId("auth-mp-competition-bureau-digest")).toBeDefined();
  });
});

describe("BM25 retrieval — canonical consumer-protection queries", () => {
  let store: CognitionStore;

  beforeAll(async () => {
    store = new InMemoryCognitionStore();
    await store.addBatch(CANADA_CONSUMER_PROTECTION_AUTHORITIES);
  });

  const queries: ReadonlyArray<{
    query: string;
    jurisdiction?: string;
    expectIdInTop5: readonly string[];
  }> = [
    {
      query: "drip pricing mandatory fees obligatory charges",
      jurisdiction: "federal",
      expectIdInTop5: ["auth-ca-competition-act-74.011"],
    },
    {
      query: "door-to-door sale cooling off period direct seller",
      expectIdInTop5: [
        "auth-on-cpa-2002-direct",
        "auth-bc-bpcpa-part4-direct-sales",
        "auth-ab-cpa-direct-sales",
        "auth-sk-cpbpa-direct-sales",
        "auth-mb-cpa-direct-sales",
      ],
    },
    {
      query: "class action waiver arbitration clause consumer",
      jurisdiction: "quebec",
      expectIdInTop5: ["auth-qc-cpa-11"],
    },
    {
      query: "abusive clause standard form consumer contract",
      jurisdiction: "quebec",
      expectIdInTop5: ["auth-qc-ccq-1435", "auth-qc-cpa-11"],
    },
    {
      query: "internet sales contract 15 days copy cancellation",
      jurisdiction: "multi-provincial",
      expectIdInTop5: ["auth-mp-ischt-2001"],
    },
    {
      query: "unconscionable acts grossly excessive price",
      jurisdiction: "british-columbia",
      expectIdInTop5: ["auth-bc-bpcpa-8"],
    },
    {
      query: "payday loan maximum cost of borrowing",
      jurisdiction: "alberta",
      expectIdInTop5: ["auth-ab-cpa-payday-loans"],
    },
    {
      query: "gift card expiry prepaid purchase card",
      jurisdiction: "manitoba",
      expectIdInTop5: ["auth-mb-cpa-prepaid-purchase-cards"],
    },
    {
      query: "CASL commercial electronic message unsubscribe consent",
      jurisdiction: "federal",
      expectIdInTop5: ["auth-ca-casl-6"],
    },
    {
      query: "implied warranty merchantable quality fitness for purpose",
      expectIdInTop5: [
        "auth-nb-cpwla-warranties",
        "auth-mb-cpa-retail-sales",
        "auth-yt-cpa-warranties",
        "auth-nt-cpa-warranties",
      ],
    },
  ];

  for (const { query, jurisdiction, expectIdInTop5 } of queries) {
    const label = jurisdiction ? `${query} [${jurisdiction}]` : query;
    it(`surfaces a relevant section for "${label}"`, async () => {
      const results = await store.retrieve({
        query,
        topK: 5,
        organizationId: "preview",
        ...(jurisdiction ? { jurisdiction } : {}),
      });
      expect(results.length).toBeGreaterThan(0);
      const topIds = results.map((r) => r.item.id ?? "");
      const hasExpected = topIds.some((id) => expectIdInTop5.includes(id));
      if (!hasExpected) {
        throw new Error(
          `Query "${label}" expected top-5 hit in [${expectIdInTop5.join(", ")}] but got [${topIds.join(", ")}]`,
        );
      }
    });
  }

  it("jurisdiction filter restricts results to the requested jurisdiction plus pan-Canadian items", async () => {
    // The retrieval filter treats "multi-provincial" and "federal" items as
    // universally applicable (NI / CSA rules, federal statutes like the
    // Competition Act). An Ontario query should never surface Quebec, BC,
    // or any other province's provincial law.
    const results = await store.retrieve({
      query: "unfair practice misleading representation",
      topK: 10,
      jurisdiction: "ontario",
    });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      const j = r.item.jurisdiction ?? "";
      expect(["ontario", "multi-provincial", "federal", ""]).toContain(j);
    }
  });
});
