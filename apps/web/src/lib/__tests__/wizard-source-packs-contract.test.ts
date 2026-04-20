import { describe, it, expect } from "vitest";
import { GET as sourcePacksGet } from "../../app/api/source-packs/route";

/**
 * Wizard-refresh contract test. The matter wizard's SourcePackChips
 * component calls GET /api/source-packs?taskType=...&registrationCategory=...
 * and renders the returned summaries. This test pins the contract that
 * the wizard depends on:
 *   - Every one of the 7 task types returns a non-empty pack list.
 *   - Every returned pack summary has the fields the chip uses
 *     (id, label, description, itemCount).
 */
describe("Wizard ↔ /api/source-packs contract", () => {
  async function call(taskType: string, registrationCategory?: string): Promise<
    Array<{ id: string; label: string; description: string; itemCount: number }>
  > {
    const params = new URLSearchParams();
    params.set("taskType", taskType);
    if (registrationCategory) params.set("registrationCategory", registrationCategory);
    const req = new Request(`http://localhost/api/source-packs?${params.toString()}`);
    const res = await sourcePacksGet(req as unknown as Parameters<typeof sourcePacksGet>[0]);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      packs: Array<{ id: string; label: string; description: string; itemCount: number }>;
    };
    return body.packs;
  }

  const TASK_TYPES = [
    "om-review",
    "kyc-gap-check",
    "marketing-signoff",
    "response-memo",
    "court-ai-disclosure",
    "pipeda-check",
    "missing-authority-scan",
    "contract-redline",
  ];

  for (const taskType of TASK_TYPES) {
    it(`returns a non-empty pack list for ${taskType}`, async () => {
      const packs = await call(taskType, taskType.startsWith("om") ? "emd" : undefined);
      expect(packs.length).toBeGreaterThan(0);
      for (const p of packs) {
        expect(typeof p.id).toBe("string");
        expect(typeof p.label).toBe("string");
        expect(typeof p.description).toBe("string");
        expect(typeof p.itemCount).toBe("number");
        expect(p.itemCount).toBeGreaterThan(0);
      }
    });
  }

  it("missing-authority-scan returns all five packs (cross-cutting)", async () => {
    const packs = await call("missing-authority-scan");
    expect(packs.length).toBe(5);
  });
});
