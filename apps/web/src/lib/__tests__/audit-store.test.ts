import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  InMemoryAuditStore,
  setAuditStore,
  getDefaultAuditStore,
  sha256,
  type AuditStore,
} from "../audit-store";

describe("AuditStore (in-memory)", () => {
  let store: AuditStore;

  beforeEach(() => {
    store = new InMemoryAuditStore();
    setAuditStore(store);
  });

  afterEach(() => {
    setAuditStore(null);
  });

  it("sha256 produces consistent hashes", () => {
    const hash1 = sha256("hello world");
    const hash2 = sha256("hello world");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64);
  });

  it("sha256 produces different hashes for different inputs", () => {
    const hash1 = sha256("hello");
    const hash2 = sha256("world");
    expect(hash1).not.toBe(hash2);
  });

  it("appends audit entries with hash chaining", async () => {
    const matterId = "test-matter-1";

    const entry1 = await store.append(matterId, {
      matterId,
      organizationId: "preview",
      actor: "system",
      action: "query",
      inputHash: sha256("input 1"),
      authoritiesUsed: ["auth-1"],
      outputHash: null,
      judgeVerdict: null,
      inputContent: "input 1",
      outputContent: null,
    });

    expect(entry1.id).toBeTruthy();
    expect(entry1.prevRowHash).toBeNull();
    expect(entry1.timestamp).toBeInstanceOf(Date);

    const entry2 = await store.append(matterId, {
      matterId,
      organizationId: "preview",
      actor: "om-reviewer",
      action: "generation",
      inputHash: sha256("input 2"),
      authoritiesUsed: ["auth-1", "auth-2"],
      outputHash: sha256("output 2"),
      judgeVerdict: "READY_TO_SUBMIT",
      inputContent: "input 2",
      outputContent: "output 2",
    });

    expect(entry2.prevRowHash).not.toBeNull();
    expect(entry2.prevRowHash).toBeTruthy();
  });

  it("retrieves entries by matter in reverse chronological order", async () => {
    const matterId = "test-matter-2";

    await store.append(matterId, {
      matterId,
      organizationId: "preview",
      actor: "system",
      action: "query",
      inputHash: sha256("first"),
      authoritiesUsed: [],
      outputHash: null,
      judgeVerdict: null,
      inputContent: "first",
      outputContent: null,
    });

    await store.append(matterId, {
      matterId,
      organizationId: "preview",
      actor: "system",
      action: "generation",
      inputHash: sha256("second"),
      authoritiesUsed: [],
      outputHash: sha256("output"),
      judgeVerdict: null,
      inputContent: "second",
      outputContent: "output",
    });

    const entries = await store.getByMatter(matterId);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.action).toBe("generation");
    expect(entries[1]!.action).toBe("query");
  });

  it("verifies a valid hash chain", async () => {
    const matterId = "test-verify-valid";

    await store.append(matterId, {
      matterId,
      organizationId: "preview",
      actor: "a",
      action: "query",
      inputHash: sha256("x"),
      authoritiesUsed: [],
      outputHash: null,
      judgeVerdict: null,
      inputContent: null,
      outputContent: null,
    });

    await store.append(matterId, {
      matterId,
      organizationId: "preview",
      actor: "b",
      action: "generation",
      inputHash: sha256("y"),
      authoritiesUsed: [],
      outputHash: sha256("z"),
      judgeVerdict: null,
      inputContent: null,
      outputContent: null,
    });

    expect(await store.verify(matterId)).toBe(true);
  });

  it("returns true for empty matter (vacuously valid)", async () => {
    expect(await store.verify("empty-matter")).toBe(true);
  });

  it("reports size correctly", async () => {
    const matterId = "test-size";
    expect(await store.size(matterId)).toBe(0);

    await store.append(matterId, {
      matterId,
      organizationId: "preview",
      actor: "a",
      action: "query",
      inputHash: sha256("x"),
      authoritiesUsed: [],
      outputHash: null,
      judgeVerdict: null,
      inputContent: null,
      outputContent: null,
    });

    expect(await store.size(matterId)).toBe(1);
    expect(await store.size()).toBeGreaterThanOrEqual(1);
  });
});

describe("getDefaultAuditStore", () => {
  afterEach(() => setAuditStore(null));

  it("returns in-memory backend when DATABASE_URL is unset", () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    setAuditStore(null);
    try {
      const store = getDefaultAuditStore();
      expect(store).toBeInstanceOf(InMemoryAuditStore);
    } finally {
      if (prev !== undefined) process.env.DATABASE_URL = prev;
      setAuditStore(null);
    }
  });

  it("uses the override when one is set", () => {
    const custom = new InMemoryAuditStore();
    setAuditStore(custom);
    expect(getDefaultAuditStore()).toBe(custom);
  });
});
