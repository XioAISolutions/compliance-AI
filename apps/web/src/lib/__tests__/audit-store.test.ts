import { describe, it, expect, beforeEach } from "vitest";

describe("AuditStore", () => {
  let store: ReturnType<typeof import("../audit-store").getDefaultAuditStore>;
  let sha256: typeof import("../audit-store").sha256;

  beforeEach(async () => {
    const mod = await import("../audit-store");
    store = mod.getDefaultAuditStore();
    sha256 = mod.sha256;
  });

  it("sha256 produces consistent hashes", () => {
    const hash1 = sha256("hello world");
    const hash2 = sha256("hello world");
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });

  it("sha256 produces different hashes for different inputs", () => {
    const hash1 = sha256("hello");
    const hash2 = sha256("world");
    expect(hash1).not.toBe(hash2);
  });

  it("appends audit entries with hash chaining", () => {
    const matterId = "test-matter-1";

    const entry1 = store.append(matterId, {
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
    expect(entry1.prevRowHash).toBeNull(); // First entry has no prev hash
    expect(entry1.timestamp).toBeInstanceOf(Date);

    const entry2 = store.append(matterId, {
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

    expect(entry2.prevRowHash).not.toBeNull(); // Chained to entry1
    expect(entry2.prevRowHash).toBeTruthy();
  });

  it("retrieves entries by matter in reverse chronological order", () => {
    const matterId = "test-matter-2";

    store.append(matterId, {
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

    store.append(matterId, {
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

    const entries = store.getByMatter(matterId);
    expect(entries).toHaveLength(2);
    // Reverse chronological — most recent first
    expect(entries[0]!.action).toBe("generation");
    expect(entries[1]!.action).toBe("query");
  });

  it("verifies a valid hash chain", () => {
    const matterId = "test-verify-valid";

    store.append(matterId, {
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

    store.append(matterId, {
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

    expect(store.verify(matterId)).toBe(true);
  });

  it("returns true for empty matter (vacuously valid)", () => {
    expect(store.verify("empty-matter")).toBe(true);
  });

  it("reports size correctly", () => {
    const matterId = "test-size";
    expect(store.size(matterId)).toBe(0);

    store.append(matterId, {
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

    expect(store.size(matterId)).toBe(1);
    expect(store.size()).toBeGreaterThanOrEqual(1);
  });
});
