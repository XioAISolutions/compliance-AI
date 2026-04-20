import { describe, it, expect } from "vitest";
import {
  KYC_REVIEWER_RETRIEVAL_PLAN,
  MARKETING_REVIEWER_RETRIEVAL_PLAN,
  OM_REVIEWER_RETRIEVAL_PLAN,
  RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN,
} from "@compliance-ai/agents";
import { InMemoryCognitionStore, ONTARIO_EMD_AUTHORITIES } from "@compliance-ai/cognition";

/**
 * End-to-end regression guard on the OM reviewer's retrieval plan.
 *
 * Proves that running the plan (one query per authority cluster) against the
 * real Ontario EMD corpus surfaces materially more distinct authorities than
 * a single BM25 pass over an OM-like document. This is the exact failure
 * mode that drove the "corpus is incomplete — re-run after you supply the
 * missing source extracts" refusal in production: single-pass retrieval
 * biases toward issuer-specific vocabulary and misses rule-text items.
 */
describe("OM retrieval plan — integration against Ontario EMD corpus", () => {
  async function seededStore() {
    const store = new InMemoryCognitionStore();
    await store.addBatch(ONTARIO_EMD_AUTHORITIES);
    return store;
  }

  it("surfaces enough distinct authorities to cover the reviewer's checklist", async () => {
    const store = await seededStore();
    const merged = new Map<string, number>();
    for (const q of OM_REVIEWER_RETRIEVAL_PLAN) {
      const hits = await store.retrieve({
        query: q,
        topK: 4,
        jurisdiction: "ontario",
        registrationCategory: "emd",
      });
      for (const h of hits) {
        const id = h.item.id ?? "";
        if (!id) continue;
        const prior = merged.get(id) ?? 0;
        if (h.score > prior) merged.set(id, h.score);
      }
    }
    // The reviewer's output structure cites across ~15-20 distinct
    // authorities. 20 is the floor at which every checklist row, gap-memo
    // paragraph, risk flag, and post-filing item can resolve.
    expect(merged.size).toBeGreaterThanOrEqual(20);
  });

  it("beats single-pass retrieval over OM-like issuer vocabulary", async () => {
    const store = await seededStore();
    const omLike =
      "Northstar Growth Fund II invests in mid-market private companies. " +
      "The issuer seeks to raise up to $50,000,000 from accredited investors. " +
      "Our business is commercial real estate finance in Ontario. " +
      "We anticipate returns in the 12-15% range based on market comparables.";
    const singlePass = await store.retrieve({
      query: omLike,
      topK: 8,
      jurisdiction: "ontario",
      registrationCategory: "emd",
    });
    const singleIds = new Set(singlePass.map((r) => r.item.id ?? ""));

    const planIds = new Set<string>();
    for (const q of OM_REVIEWER_RETRIEVAL_PLAN) {
      const hits = await store.retrieve({
        query: q,
        topK: 4,
        jurisdiction: "ontario",
        registrationCategory: "emd",
      });
      for (const h of hits) {
        const id = h.item.id ?? "";
        if (id) planIds.add(id);
      }
    }

    // The plan must recover strictly more distinct ids, and must surface
    // items single-pass misses.
    expect(planIds.size).toBeGreaterThan(singleIds.size);
    const planOnly = [...planIds].filter((id) => !singleIds.has(id));
    expect(planOnly.length).toBeGreaterThan(0);
  });

  it("includes the landmark rule-text items a production review must cite", async () => {
    // Spot-check items that historically went missing from single-pass:
    // Form 45-106F4, Securities Act s. 130.1, OSC Rule 45-501 s. 5.2,
    // NI 31-103 Part 13, NI 81-102 Part 15.
    const store = await seededStore();
    const planIds = new Set<string>();
    for (const q of OM_REVIEWER_RETRIEVAL_PLAN) {
      const hits = await store.retrieve({
        query: q,
        topK: 4,
        jurisdiction: "ontario",
        registrationCategory: "emd",
      });
      for (const h of hits) {
        const id = h.item.id ?? "";
        if (id) planIds.add(id);
      }
    }

    // Each of these ids is seeded in authorities.ts / NI 45-106 corpus —
    // the plan must reach them or a review relying on the plan will skip
    // the corresponding checklist row.
    const mustReach = [
      "auth-securities-act-130.1",
      "auth-osc-rule-45-501-5.2",
      "auth-ni-31-103-part-13",
      "auth-ni-81-102-part-15",
    ];
    for (const id of mustReach) {
      expect(planIds.has(id)).toBe(true);
    }
  });
});

/**
 * Same regression guards for the KYC, marketing, and response-memo plans.
 * The shared invariant: every plan must reach the persona-specific landmark
 * authorities or the persona will hit a NEEDS-VERIFICATION wall on its
 * core checklist rows.
 */
async function runPlan(
  plan: readonly string[],
  registrationCategory: "emd" | "pm" | "iiroc" = "emd",
): Promise<Set<string>> {
  const store = new InMemoryCognitionStore();
  await store.addBatch(ONTARIO_EMD_AUTHORITIES);
  const ids = new Set<string>();
  for (const q of plan) {
    const hits = await store.retrieve({
      query: q,
      topK: 4,
      jurisdiction: "ontario",
      registrationCategory,
    });
    for (const h of hits) {
      const id = h.item.id ?? "";
      if (id) ids.add(id);
    }
  }
  return ids;
}

describe("KYC retrieval plan — integration against Ontario EMD corpus", () => {
  it("reaches the KYC landmark authorities the persona's checklist cites", async () => {
    const ids = await runPlan(KYC_REVIEWER_RETRIEVAL_PLAN);
    for (const id of [
      "auth-pcmltfa-6.2",
      "auth-fintrac-guideline-6",
      "auth-ni-31-103-13.3-suitability",
      "auth-ni-31-103-part-13",
      "auth-osc-sn-33-316-suitability",
      "auth-fintrac-deficiency-kyc",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});

describe("Marketing retrieval plan — integration against Ontario EMD corpus", () => {
  it("reaches the marketing landmark authorities the persona's flagged-claims table cites", async () => {
    const ids = await runPlan(MARKETING_REVIEWER_RETRIEVAL_PLAN);
    for (const id of [
      "auth-ni-81-102-15.2",
      "auth-ni-81-102-15.3",
      "auth-ni-81-102-part-15",
      "auth-ni-31-103-13.18",
      "auth-osc-sn-33-316-suitability",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});

describe("Response-memo retrieval plan — integration against Ontario EMD corpus", () => {
  it("reaches the EMD-applicable deficiency-pattern landmarks (OSC + FINTRAC)", async () => {
    // CIRO/IIROC findings are tagged registrationCategories: ["iiroc"], so
    // the registration filter correctly excludes them from an EMD matter.
    // EMD matters get OSC + FINTRAC patterns; the iiroc-scoped test below
    // covers the CIRO landmark separately.
    const ids = await runPlan(RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN, "emd");
    for (const id of ["auth-osc-deficiency-pattern-suitability", "auth-fintrac-deficiency-kyc"]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("reaches the CIRO/IIROC trade-surveillance landmark for IIROC matters", async () => {
    const ids = await runPlan(RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN, "iiroc");
    expect(ids.has("auth-ciro-finding-trade-surveillance")).toBe(true);
  });

  it("reaches the underlying-rule landmarks the response will need to argue against", async () => {
    const ids = await runPlan(RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN, "emd");
    for (const id of ["auth-ni-31-103-13.3-suitability", "auth-ni-31-103-part-13"]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
