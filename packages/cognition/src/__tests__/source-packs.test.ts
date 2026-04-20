import { describe, it, expect } from "vitest";
import {
  CA_CONSUMER_PROTECTION_PACK,
  CA_COURT_AI_PACK,
  CA_FEDERAL_AML_PACK,
  CA_PRIVACY_PACK,
  CA_SECURITIES_ONTARIO_PACK,
  flattenPacks,
  selectPacksForLane,
  selectPacksForTaskType,
  SOURCE_PACKS,
  summarizePack,
} from "../source-packs";

describe("SOURCE_PACKS registry", () => {
  it("registers the five canonical Canadian packs", () => {
    const ids = SOURCE_PACKS.map((p) => p.id).sort();
    expect(ids).toEqual(
      [
        "ca-consumer-protection",
        "ca-court-ai",
        "ca-federal-aml",
        "ca-privacy",
        "ca-securities-ontario",
      ].sort(),
    );
  });

  it("every pack has the required shape", () => {
    for (const pack of SOURCE_PACKS) {
      expect(pack.id).toMatch(/^ca-/);
      expect(pack.label.length).toBeGreaterThan(5);
      expect(pack.description.length).toBeGreaterThan(30);
      expect(pack.jurisdictions.length).toBeGreaterThan(0);
      expect(pack.practiceAreas.length).toBeGreaterThan(0);
      expect(pack.items.length).toBeGreaterThan(0);
    }
  });

  it("pack ids are unique", () => {
    const ids = SOURCE_PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("selectPacksForLane", () => {
  it("routes securities lanes to securities + AML", () => {
    for (const lane of ["securities-emd", "securities-pm", "securities-iiroc", "securities-issuer"] as const) {
      const ids = selectPacksForLane(lane).map((p) => p.id);
      expect(ids).toContain("ca-securities-ontario");
      expect(ids).toContain("ca-federal-aml");
    }
  });

  it("routes consumer-protection to the pan-Canadian pack", () => {
    const ids = selectPacksForLane("consumer-protection").map((p) => p.id);
    expect(ids).toEqual(["ca-consumer-protection"]);
  });

  it("routes privacy to the privacy pack", () => {
    const ids = selectPacksForLane("privacy").map((p) => p.id);
    expect(ids).toEqual(["ca-privacy"]);
  });

  it("routes court-ai-disclosure to the court-AI pack", () => {
    const ids = selectPacksForLane("court-ai-disclosure").map((p) => p.id);
    expect(ids).toEqual(["ca-court-ai"]);
  });

  it("routes cross-cutting to every pack", () => {
    const ids = selectPacksForLane("cross-cutting").map((p) => p.id).sort();
    expect(ids).toEqual(SOURCE_PACKS.map((p) => p.id).sort());
  });
});

describe("selectPacksForTaskType", () => {
  it("routes om-review with emd to securities + AML", () => {
    const ids = selectPacksForTaskType("om-review", "emd").map((p) => p.id);
    expect(ids).toContain("ca-securities-ontario");
    expect(ids).toContain("ca-federal-aml");
  });

  it("routes pipeda-check to privacy", () => {
    expect(selectPacksForTaskType("pipeda-check").map((p) => p.id)).toEqual(["ca-privacy"]);
  });

  it("routes court-ai-disclosure to the court-AI pack", () => {
    expect(selectPacksForTaskType("court-ai-disclosure").map((p) => p.id)).toEqual(["ca-court-ai"]);
  });

  it("routes missing-authority-scan to all packs (cross-cutting)", () => {
    const ids = selectPacksForTaskType("missing-authority-scan").map((p) => p.id).sort();
    expect(ids).toEqual(SOURCE_PACKS.map((p) => p.id).sort());
  });

  it("defaults unknown task types to the securities lane", () => {
    const ids = selectPacksForTaskType("not-a-task-type").map((p) => p.id);
    expect(ids).toContain("ca-securities-ontario");
  });
});

describe("flattenPacks", () => {
  it("unions items across packs", () => {
    const flat = flattenPacks([CA_SECURITIES_ONTARIO_PACK, CA_PRIVACY_PACK]);
    expect(flat.length).toBeGreaterThanOrEqual(
      CA_SECURITIES_ONTARIO_PACK.items.length + CA_PRIVACY_PACK.items.length - 50,
      // Allow for overlap; the exact number depends on seed dedup.
    );
  });

  it("dedupes by id when packs overlap", () => {
    // AML items appear in both the securities and the AML pack.
    const flat = flattenPacks([CA_SECURITIES_ONTARIO_PACK, CA_FEDERAL_AML_PACK]);
    const ids = flat.map((i) => i.id ?? "");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("first pack wins on id collisions", () => {
    const fakeItem = { ...CA_FEDERAL_AML_PACK.items[0]!, content: "TAGGED-A" };
    const fakeItem2 = { ...CA_FEDERAL_AML_PACK.items[0]!, content: "TAGGED-B" };
    const packA = { ...CA_FEDERAL_AML_PACK, items: [fakeItem] };
    const packB = { ...CA_FEDERAL_AML_PACK, items: [fakeItem2] };
    const flat = flattenPacks([packA, packB]);
    expect(flat.find((i) => i.id === fakeItem.id)?.content).toBe("TAGGED-A");
  });

  it("produces a flat list for every pack", () => {
    const flat = flattenPacks(SOURCE_PACKS);
    expect(flat.length).toBeGreaterThan(100);
    const ids = flat.map((i) => i.id ?? "");
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("summarizePack", () => {
  it("produces a UI-safe summary with itemCount", () => {
    const s = summarizePack(CA_COURT_AI_PACK);
    expect(s.id).toBe("ca-court-ai");
    expect(s.itemCount).toBe(CA_COURT_AI_PACK.items.length);
    // No items in summary.
    expect(s).not.toHaveProperty("items");
  });
});

describe("pack ↔ corpus wiring", () => {
  it("consumer-protection pack is the pan-Canadian bundle", () => {
    // Should cover every province + federal + multi-provincial.
    expect(CA_CONSUMER_PROTECTION_PACK.jurisdictions.length).toBeGreaterThanOrEqual(12);
  });

  it("privacy pack covers PIPEDA + the three substantially-similar provinces", () => {
    const jurs = new Set(CA_PRIVACY_PACK.jurisdictions);
    expect(jurs.has("federal")).toBe(true);
    expect(jurs.has("quebec")).toBe(true);
    expect(jurs.has("alberta")).toBe(true);
    expect(jurs.has("british-columbia")).toBe(true);
  });
});
