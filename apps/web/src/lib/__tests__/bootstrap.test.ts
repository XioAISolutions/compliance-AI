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

  it("seeds BOTH the Canadian (Ontario) and US corpora for the securities surface", async () => {
    await ensureTenant("preview");
    const store = await import("@compliance-ai/cognition").then((m) =>
      m.getDefaultCognitionStore(),
    );
    const all = await store.getAll();
    const caItems = all.filter((i) => i.jurisdiction === "ontario");
    const usItems = all.filter((i) => i.jurisdiction === "US");
    // Canadian NI 45-106 corpus is >100 items; US Reg D corpus is ~20.
    expect(caItems.length).toBeGreaterThan(50);
    expect(usItems.length).toBeGreaterThan(15);
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
