import { describe, it, expect } from "vitest";
import { COURT_AI_DISCLOSURE_DRAFTER_RETRIEVAL_PLAN } from "@compliance-ai/agents";
import { COURT_AI_USE_AUTHORITIES, InMemoryCognitionStore } from "@compliance-ai/cognition";

/**
 * Integration guard — the court-AI-disclosure drafter's plan must reach
 * the practice directions the persona's Court-Specific Requirements
 * Checklist cites. Failure modes we're regression-guarding:
 *
 *  1. Plan query vocabulary drifts from the seeded authority text.
 *  2. Seed corpus loses an authority.
 *  3. Jurisdiction filter silently drops items (practice directions are
 *     tagged per-court jurisdiction; the retrieval filter must treat
 *     "federal" items as universally applicable for non-federal matters).
 */
describe("Court AI-disclosure plan — integration against the seeded practice-direction corpus", () => {
  async function runPlan(
    jurisdiction: string,
    registrationCategory: "counsel" | "none" | "litigation" = "counsel",
  ): Promise<Set<string>> {
    const store = new InMemoryCognitionStore();
    await store.addBatch(COURT_AI_USE_AUTHORITIES);
    const ids = new Set<string>();
    for (const q of COURT_AI_DISCLOSURE_DRAFTER_RETRIEVAL_PLAN) {
      const hits = await store.retrieve({
        query: q,
        topK: 4,
        jurisdiction,
        registrationCategory,
      });
      for (const h of hits) {
        const id = h.item.id ?? "";
        if (id) ids.add(id);
      }
    }
    return ids;
  }

  it("reaches the Federal Court + LSO + CBA landmarks from an Ontario matter", async () => {
    const ids = await runPlan("ontario");
    // Ontario matter should see ONSC + Ontario law society + any federal
    // or multi-jurisdictional items (federal is universally applicable).
    for (const id of [
      "auth-onsc-ai-practice-direction",
      "auth-fc-consolidated-ai-notice",
      "auth-lso-ai-practice-guidance",
      "auth-cba-ai-guidance",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("reaches the Federal Court landmark from a federal matter", async () => {
    const ids = await runPlan("federal");
    expect(ids.has("auth-fc-consolidated-ai-notice")).toBe(true);
    expect(ids.has("auth-cba-ai-guidance")).toBe(true);
  });

  it("reaches the Alberta KB landmark from an Alberta matter", async () => {
    const ids = await runPlan("alberta");
    expect(ids.has("auth-abkb-ai-notice")).toBe(true);
    // Federal + CBA are universally applicable.
    expect(ids.has("auth-fc-consolidated-ai-notice")).toBe(true);
  });

  it("reaches the BCSC landmark from a BC matter", async () => {
    const ids = await runPlan("british-columbia");
    expect(ids.has("auth-bcsc-ai-practice-direction")).toBe(true);
  });

  it("reaches the duty-of-candour reference summary", async () => {
    const ids = await runPlan("ontario");
    expect(ids.has("auth-counsel-duty-of-candour-ai")).toBe(true);
  });
});

describe("Court AI-use seed corpus integrity", () => {
  it("every seed item has source-locker metadata a reviewer can use", () => {
    for (const item of COURT_AI_USE_AUTHORITIES) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.content.length).toBeGreaterThan(200);
      expect(item.sourceType).toBeDefined();
      expect(item.authorityDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.jurisdiction).toBeTruthy();
    }
  });

  it("all ids are unique", () => {
    const ids = COURT_AI_USE_AUTHORITIES.map((i) => i.id ?? "");
    expect(new Set(ids).size).toBe(ids.length);
  });
});
