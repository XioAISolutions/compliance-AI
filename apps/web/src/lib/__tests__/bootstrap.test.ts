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

  it("does not re-seed a non-empty cognition store", async () => {
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
    expect(sizeAfter).toBe(sizeBefore);
  });
});
