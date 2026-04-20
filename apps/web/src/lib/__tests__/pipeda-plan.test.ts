import { describe, it, expect } from "vitest";
import { PIPEDA_REVIEWER_RETRIEVAL_PLAN } from "@compliance-ai/agents";
import { InMemoryCognitionStore, PIPEDA_AUTHORITIES } from "@compliance-ai/cognition";

/**
 * Integration guard — the PIPEDA reviewer's plan must reach every
 * landmark PIPEDA / OPC / provincial authority the persona's ten-principle
 * checklist + breach-notification + cross-border + provincial
 * substantially-similar sections cite.
 */
describe("PIPEDA plan — integration against the seeded privacy corpus", () => {
  async function runPlan(
    jurisdiction: string,
    registrationCategory: "privacy" | "counsel" | "none" = "counsel",
  ): Promise<Set<string>> {
    const store = new InMemoryCognitionStore();
    await store.addBatch(PIPEDA_AUTHORITIES);
    const ids = new Set<string>();
    for (const q of PIPEDA_REVIEWER_RETRIEVAL_PLAN) {
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

  it("reaches Schedule 1 principles + s.10.1 + breach regs from a federal matter", async () => {
    const ids = await runPlan("federal");
    for (const id of [
      "auth-pipeda-schedule-1-principles",
      "auth-pipeda-10.1-breach-notification",
      "auth-pipeda-breach-regulations",
      "auth-opc-guidelines-consent",
      "auth-opc-cross-border-transfers",
      "auth-opc-privacy-management-program",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it("reaches Quebec Law 25 from a Quebec matter (federal items remain universally applicable)", async () => {
    const ids = await runPlan("quebec");
    expect(ids.has("auth-quebec-law-25")).toBe(true);
    expect(ids.has("auth-pipeda-schedule-1-principles")).toBe(true);
  });

  it("reaches Alberta PIPA from an Alberta matter", async () => {
    const ids = await runPlan("alberta");
    expect(ids.has("auth-alberta-pipa")).toBe(true);
    expect(ids.has("auth-pipeda-schedule-1-principles")).toBe(true);
  });

  it("reaches BC PIPA from a BC matter", async () => {
    const ids = await runPlan("british-columbia");
    expect(ids.has("auth-bc-pipa")).toBe(true);
  });
});

describe("PIPEDA seed corpus integrity", () => {
  it("every seed item has source-locker metadata", () => {
    for (const item of PIPEDA_AUTHORITIES) {
      expect(item.id).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.content.length).toBeGreaterThan(200);
      expect(item.sourceType).toBeDefined();
      expect(item.authorityDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.jurisdiction).toBeTruthy();
    }
  });

  it("all ids are unique", () => {
    const ids = PIPEDA_AUTHORITIES.map((i) => i.id ?? "");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers the primary statute, the breach regs, OPC guidance, and the provincial trio", () => {
    const ids = new Set(PIPEDA_AUTHORITIES.map((i) => i.id));
    expect(ids.has("auth-pipeda-schedule-1-principles")).toBe(true);
    expect(ids.has("auth-pipeda-10.1-breach-notification")).toBe(true);
    expect(ids.has("auth-pipeda-breach-regulations")).toBe(true);
    expect(ids.has("auth-opc-guidelines-consent")).toBe(true);
    expect(ids.has("auth-quebec-law-25")).toBe(true);
    expect(ids.has("auth-alberta-pipa")).toBe(true);
    expect(ids.has("auth-bc-pipa")).toBe(true);
  });
});
