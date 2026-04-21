import { describe, it, expect, beforeEach } from "vitest";
import {
  InMemoryConflictStore,
  findConflictHits,
  type MatterLite,
} from "../conflict-store";

describe("InMemoryConflictStore", () => {
  let store: InMemoryConflictStore;

  beforeEach(() => {
    store = new InMemoryConflictStore();
  });

  it("auto-clears no-hit checks on create (the search itself is the audit)", async () => {
    const c = await store.create({
      clientName: "Acme Corp",
      searchedBy: "intake-clerk",
      hitMatterIds: [],
    });
    expect(c.decision).toBe("cleared");
    expect(c.decidedBy).toBe("intake-clerk");
    expect(c.decidedAt).toBeInstanceOf(Date);
    expect(await store.isCleared(c.id)).toBe(true);
  });

  it("creates with-hits checks in pending state requiring partner decision", async () => {
    const c = await store.create({
      clientName: "Acme Corp",
      opposingParty: "Beta Ltd",
      searchedBy: "intake-clerk",
      hitMatterIds: ["mid-1", "mid-2"],
    });
    expect(c.decision).toBe("pending");
    expect(c.decidedAt).toBeUndefined();
    expect(await store.isCleared(c.id)).toBe(false);
  });

  it("decide() transitions pending → cleared and records who/when/why", async () => {
    const c = await store.create({
      clientName: "Acme",
      searchedBy: "x",
      hitMatterIds: ["mid-1"],
    });
    const decided = await store.decide({
      id: c.id,
      decision: "cleared",
      decidedBy: "partner-jane",
      rationale: "Wall-screen confirmed; prior matter closed in 2022 with no overlapping work product.",
    });
    expect(decided?.decision).toBe("cleared");
    expect(decided?.decidedBy).toBe("partner-jane");
    expect(decided?.rationale).toMatch(/wall-screen/i);
    expect(await store.isCleared(c.id)).toBe(true);
  });

  it("decide() to declined records the refusal as the firm's audit", async () => {
    const c = await store.create({
      clientName: "Adverse",
      opposingParty: "Existing client",
      searchedBy: "x",
      hitMatterIds: ["mid-active"],
    });
    const decided = await store.decide({
      id: c.id,
      decision: "declined",
      decidedBy: "partner-jane",
      rationale: "Active engagement against this party; cannot represent.",
    });
    expect(decided?.decision).toBe("declined");
    expect(await store.isCleared(c.id)).toBe(false);
  });

  it("decide() is a no-op on already-terminal checks (idempotent)", async () => {
    const c = await store.create({
      clientName: "x",
      searchedBy: "x",
      hitMatterIds: [],
    }); // auto-cleared
    const second = await store.decide({
      id: c.id,
      decision: "declined",
      decidedBy: "y",
      rationale: "trying to flip",
    });
    expect(second?.decision).toBe("cleared"); // unchanged
  });

  it("returns null on get() / decide() for unknown ids", async () => {
    expect(await store.get("nope")).toBeNull();
    expect(
      await store.decide({
        id: "nope",
        decision: "cleared",
        decidedBy: "x",
        rationale: "x",
      }),
    ).toBeNull();
    expect(await store.isCleared("nope")).toBe(false);
  });

  it("listRecent() returns newest-first within an org and limits", async () => {
    for (let i = 0; i < 5; i += 1) {
      await store.create({
        clientName: `Client-${i}`,
        searchedBy: "x",
        hitMatterIds: [],
      });
    }
    const list = await store.listRecent("preview", 3);
    expect(list).toHaveLength(3);
    expect(list[0]!.searchedAt.getTime()).toBeGreaterThanOrEqual(list[2]!.searchedAt.getTime());
  });
});

describe("findConflictHits", () => {
  const candidates: MatterLite[] = [
    {
      id: "m1",
      organizationId: "org-A",
      status: "open",
      clientName: "Acme Corp",
      opposingParty: "Beta Ltd",
    },
    {
      id: "m2",
      organizationId: "org-A",
      status: "complete",
      clientName: "Gamma Inc",
      opposingParty: "Acme Corp", // we were ADVERSE to Acme before
    },
    {
      id: "m3",
      organizationId: "org-A",
      status: "archived", // archived → ignored
      clientName: "Acme Corp",
      opposingParty: "Delta",
    },
    {
      id: "m4",
      organizationId: "org-B", // different org → ignored
      status: "open",
      clientName: "Acme Corp",
      opposingParty: "Beta Ltd",
    },
  ];

  it("flags direct same-side client matches", () => {
    const hits = findConflictHits(candidates, {
      clientName: "Acme Corp",
      organizationId: "org-A",
    });
    expect(hits).toContain("m1"); // we already represent Acme
    expect(hits).toContain("m2"); // and we were adverse to them — both flag
  });

  it("flags swap-side hits — adverse to a prior client OR client of a prior counterparty", () => {
    // New client = Beta Ltd; we are already adverse to Beta in m1.
    const hits = findConflictHits(candidates, {
      clientName: "Beta Ltd",
      organizationId: "org-A",
    });
    expect(hits).toContain("m1");
  });

  it("ignores archived matters", () => {
    const hits = findConflictHits(candidates, {
      clientName: "Delta",
      organizationId: "org-A",
    });
    expect(hits).not.toContain("m3");
  });

  it("scopes by organizationId — never crosses tenants", () => {
    const hits = findConflictHits(candidates, {
      clientName: "Acme Corp",
      organizationId: "org-A",
    });
    expect(hits).not.toContain("m4");
  });

  it("case-insensitive, whitespace-tolerant matching", () => {
    const hits = findConflictHits(candidates, {
      clientName: "  acme   corp ",
      organizationId: "org-A",
    });
    expect(hits).toContain("m1");
  });

  it("substring match catches partial / abbreviated names", () => {
    const hits = findConflictHits(candidates, {
      clientName: "Acme",
      organizationId: "org-A",
    });
    expect(hits).toContain("m1");
  });

  it("returns empty array when there are no matches", () => {
    const hits = findConflictHits(candidates, {
      clientName: "Totally Unrelated Name",
      organizationId: "org-A",
    });
    expect(hits).toEqual([]);
  });
});
