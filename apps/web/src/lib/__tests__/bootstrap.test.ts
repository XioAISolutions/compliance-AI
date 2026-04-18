import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryCognitionStore, setDefaultCognitionStore } from "@compliance-ai/cognition";
import { ensureTenant, resetBootstrapState } from "../bootstrap";

describe("ensureTenant", () => {
  beforeEach(() => {
    // Fresh cognition store per test; resets the preview tenant's seeded state
    setDefaultCognitionStore(new InMemoryCognitionStore());
    resetBootstrapState();
  });

  it("seeds the preview tenant authorities on first call", async () => {
    await ensureTenant("preview");
    const store = await import("@compliance-ai/cognition").then((m) =>
      m.getDefaultCognitionStore(),
    );
    const size = await store.size();
    expect(size).toBeGreaterThan(0);
  });

  it("seeds the Canadian authority corpus for the securities surface (no US)", async () => {
    await ensureTenant("preview");
    const store = await import("@compliance-ai/cognition").then((m) =>
      m.getDefaultCognitionStore(),
    );
    const all = await store.getAll();
    const caItems = all.filter((i) => i.jurisdiction === "ontario");
    const usItems = all.filter((i) => i.jurisdiction === "US");
    // Canadian NI 45-106 corpus is >100 items
    expect(caItems.length).toBeGreaterThan(50);
    // US authorities are no longer seeded by default — they're loaded
    // on-demand by /api/ask when doing cross-jurisdiction comparisons.
    expect(usItems.length).toBe(0);
  });

  it("is idempotent on repeated calls", async () => {
    await ensureTenant("preview");
    const store = await import("@compliance-ai/cognition").then((m) =>
      m.getDefaultCognitionStore(),
    );
    const sizeAfterFirst = await store.size();

    await ensureTenant("preview");
    await ensureTenant("preview");
    const sizeAfterMany = await store.size();

    expect(sizeAfterMany).toBe(sizeAfterFirst);
  });

  it("tags seeded items with the provided tenant id", async () => {
    await ensureTenant("test-tenant-xyz");
    const store = await import("@compliance-ai/cognition").then((m) =>
      m.getDefaultCognitionStore(),
    );
    const all = await store.getAll();
    for (const item of all) {
      expect(item.organizationId).toBe("test-tenant-xyz");
    }
  });

  it("additively seeds missing authorities on a partially populated store", async () => {
    // The bootstrap used to skip seeding entirely when the store was
    // non-empty. That meant a tenant seeded with last release's corpus
    // never picked up newly-authored items on redeploy. The current
    // bootstrap filters the target corpus against existing ids and only
    // adds the missing entries — so an unrelated pre-existing item does
    // NOT block the seed, but a duplicate id is skipped.
    const cog = await import("@compliance-ai/cognition").then((m) => m.getDefaultCognitionStore());
    await cog.add({
      id: "existing-item",
      organizationId: "preview",
      title: "Pre-existing",
      content: "Already here",
    });
    const sizeBefore = await cog.size();

    await ensureTenant("preview");

    const sizeAfter = await cog.size();
    expect(sizeAfter).toBeGreaterThan(sizeBefore);
    // Original item still present, not duplicated
    const existing = await cog.get("existing-item");
    expect(existing).toBeTruthy();
  });

  it("skips items already present by id on a redeploy-style reseed", async () => {
    // Simulate a "previous deploy" that seeded half the corpus. The next
    // bootstrap should leave the existing items alone and only add the
    // ones that weren't there before — no duplicates.
    await ensureTenant("preview");
    const store = await import("@compliance-ai/cognition").then((m) =>
      m.getDefaultCognitionStore(),
    );
    const firstPassSize = await store.size();

    // Simulate a new request on the same tenant, across a process that
    // has forgotten it already seeded (clears the _seeded short-circuit).
    resetBootstrapState();
    await ensureTenant("preview");
    const secondPassSize = await store.size();

    // Size must not grow — every item is already in the store under the
    // same id and filtered out of the additive seed.
    expect(secondPassSize).toBe(firstPassSize);
  });
});
