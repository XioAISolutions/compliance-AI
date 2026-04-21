import { describe, it, expect, beforeEach } from "vitest";
import { POST as searchPost } from "../../app/api/conflicts/search/route";
import { POST as decidePost } from "../../app/api/conflicts/decide/route";
import { POST as mattersPost } from "../../app/api/matters/route";
import { InMemoryMatterStore, setMatterStore } from "../matter-store";
import { InMemoryConflictStore, setConflictStore } from "../conflict-store";

describe("Conflict API + matter-creation gate", () => {
  let matterStore: InMemoryMatterStore;
  let conflictStore: InMemoryConflictStore;

  beforeEach(() => {
    matterStore = new InMemoryMatterStore();
    conflictStore = new InMemoryConflictStore();
    setMatterStore(matterStore);
    setConflictStore(conflictStore);
  });

  async function callSearch(body: unknown): Promise<Response> {
    const req = new Request("http://localhost/api/conflicts/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return searchPost(req as unknown as Parameters<typeof searchPost>[0]);
  }
  async function callDecide(body: unknown): Promise<Response> {
    const req = new Request("http://localhost/api/conflicts/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return decidePost(req as unknown as Parameters<typeof decidePost>[0]);
  }
  async function callMatterCreate(body: unknown): Promise<Response> {
    const req = new Request("http://localhost/api/matters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return mattersPost(req as unknown as Parameters<typeof mattersPost>[0]);
  }

  describe("POST /api/conflicts/search", () => {
    it("400s on missing clientName", async () => {
      const res = await callSearch({ searchedBy: "x" });
      expect(res.status).toBe(400);
    });

    it("returns an auto-cleared check + empty hits when no prior matters match", async () => {
      const res = await callSearch({
        clientName: "Brand New Client",
        searchedBy: "intake",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        check: { decision: string; id: string };
        hits: unknown[];
      };
      expect(body.check.decision).toBe("cleared");
      expect(body.hits).toEqual([]);
    });

    it("returns a pending check with hydrated hits when matches exist", async () => {
      // Seed a prior matter we'll be adverse to in the new search.
      await matterStore.create({
        title: "Acme v. Existing Adversary",
        jurisdiction: "ontario",
        registrationCategory: "none",
        taskType: "om-review",
        clientName: "Acme Corp",
        opposingParty: "Existing Adversary",
        conflictBypassReason: "test seed",
      } as never);

      const res = await callSearch({
        clientName: "Existing Adversary", // we are now being asked to represent the prior opposing party
        searchedBy: "intake",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        check: { decision: string };
        hits: Array<{ id: string; title: string; clientName: string | null }>;
      };
      expect(body.check.decision).toBe("pending");
      expect(body.hits).toHaveLength(1);
      expect(body.hits[0]!.title).toContain("Acme");
    });
  });

  describe("POST /api/conflicts/decide", () => {
    it("400s on missing/short rationale", async () => {
      const created = await conflictStore.create({
        clientName: "x",
        searchedBy: "x",
        hitMatterIds: ["m1"],
      });
      const res = await callDecide({
        id: created.id,
        decision: "cleared",
        decidedBy: "partner",
        rationale: "no",
      });
      expect(res.status).toBe(400);
    });

    it("400s on invalid decision value", async () => {
      const created = await conflictStore.create({
        clientName: "x",
        searchedBy: "x",
        hitMatterIds: ["m1"],
      });
      const res = await callDecide({
        id: created.id,
        decision: "maybe",
        decidedBy: "partner",
        rationale: "this is long enough",
      });
      expect(res.status).toBe(400);
    });

    it("404s on unknown id", async () => {
      const res = await callDecide({
        id: "no-such-id",
        decision: "cleared",
        decidedBy: "p",
        rationale: "rationale text long enough",
      });
      expect(res.status).toBe(404);
    });

    it("clears a pending check + records rationale", async () => {
      const created = await conflictStore.create({
        clientName: "x",
        searchedBy: "x",
        hitMatterIds: ["m1"],
      });
      const res = await callDecide({
        id: created.id,
        decision: "cleared",
        decidedBy: "partner-jane",
        rationale: "Wall-screen confirmed; no overlapping work product.",
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { decision: string; rationale: string };
      expect(body.decision).toBe("cleared");
      expect(body.rationale).toContain("Wall-screen");
    });

    it("409s when trying to flip a terminal-state check", async () => {
      const created = await conflictStore.create({
        clientName: "x",
        searchedBy: "x",
        hitMatterIds: [],
      }); // auto-cleared
      const res = await callDecide({
        id: created.id,
        decision: "declined",
        decidedBy: "partner",
        rationale: "trying to flip after the fact",
      });
      expect(res.status).toBe(409);
    });
  });

  describe("Matter-creation gate (POST /api/matters)", () => {
    it("returns 409 conflict-check-required when no clearance + no bypass", async () => {
      const res = await callMatterCreate({
        title: "Test Matter",
        jurisdiction: "ontario",
        registrationCategory: "none",
        taskType: "om-review",
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("conflict-check-required");
    });

    it("returns 409 conflict-check-not-cleared when clearance id is unknown or pending", async () => {
      const pending = await conflictStore.create({
        clientName: "x",
        searchedBy: "x",
        hitMatterIds: ["m1"],
      });
      const res = await callMatterCreate({
        title: "Test Matter",
        jurisdiction: "ontario",
        registrationCategory: "none",
        taskType: "om-review",
        conflictClearanceId: pending.id,
      });
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("conflict-check-not-cleared");
    });

    it("creates the matter when a cleared clearance is supplied", async () => {
      const cleared = await conflictStore.create({
        clientName: "x",
        searchedBy: "x",
        hitMatterIds: [],
      }); // auto-cleared
      const res = await callMatterCreate({
        title: "Cleared Matter",
        jurisdiction: "ontario",
        registrationCategory: "none",
        taskType: "om-review",
        conflictClearanceId: cleared.id,
      });
      expect(res.status).toBe(201);
    });

    it("creates the matter when an operator bypass reason is supplied", async () => {
      const res = await callMatterCreate({
        title: "Bypass Matter",
        jurisdiction: "ontario",
        registrationCategory: "none",
        taskType: "om-review",
        conflictBypassReason: "Migrated from legacy system; conflict review on file separately",
      });
      expect(res.status).toBe(201);
    });

    it("rejects whitespace-only bypass reasons", async () => {
      const res = await callMatterCreate({
        title: "Sneaky bypass",
        jurisdiction: "ontario",
        registrationCategory: "none",
        taskType: "om-review",
        conflictBypassReason: "    ",
      });
      expect(res.status).toBe(409);
    });
  });
});
