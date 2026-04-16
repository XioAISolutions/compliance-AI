import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryApprovalStore } from "../index";

describe("InMemoryApprovalStore", () => {
  let store: InMemoryApprovalStore;

  beforeEach(() => {
    store = new InMemoryApprovalStore();
  });

  it("creates an approval request with defaults", async () => {
    const r = await store.create({
      matterId: "m-1",
      outputHash: "abc123",
      summary: "OM review for Acme Capital",
      requestedBy: "u-1",
    });

    expect(r.id).toBeTruthy();
    expect(r.status).toBe("requested");
    expect(r.organizationId).toBe("preview");
    expect(r.outputHash).toBe("abc123");
    expect(r.requestedBy).toBe("u-1");
    expect(r.requestedAt).toBeInstanceOf(Date);
  });

  it("lists pending approvals filtered by org", async () => {
    await store.create({ matterId: "m-1", outputHash: "h1", summary: "A", requestedBy: "u" }, "org-1");
    await store.create({ matterId: "m-2", outputHash: "h2", summary: "B", requestedBy: "u" }, "org-2");
    await store.create({ matterId: "m-3", outputHash: "h3", summary: "C", requestedBy: "u" }, "org-1");

    const org1 = await store.listPending("org-1");
    expect(org1).toHaveLength(2);
    const org2 = await store.listPending("org-2");
    expect(org2).toHaveLength(1);
  });

  it("lists approvals by matter in reverse chronological order", async () => {
    await store.create({ matterId: "m-1", outputHash: "h1", summary: "Old", requestedBy: "u" });
    await new Promise((r) => setTimeout(r, 5));
    await store.create({ matterId: "m-1", outputHash: "h2", summary: "New", requestedBy: "u" });

    const items = await store.listByMatter("m-1");
    expect(items).toHaveLength(2);
    expect(items[0]!.summary).toBe("New");
  });

  it("reviews an approval request (approved)", async () => {
    const r = await store.create({
      matterId: "m-1",
      outputHash: "h",
      summary: "S",
      requestedBy: "requester",
    });

    const reviewed = await store.review({
      id: r.id,
      status: "approved",
      reviewedBy: "cco",
      rationale: "Checks out.",
    });

    expect(reviewed!.status).toBe("approved");
    expect(reviewed!.reviewedBy).toBe("cco");
    expect(reviewed!.rationale).toBe("Checks out.");
    expect(reviewed!.reviewedAt).toBeInstanceOf(Date);
  });

  it("reviews an approval request (rejected)", async () => {
    const r = await store.create({
      matterId: "m-1",
      outputHash: "h",
      summary: "S",
      requestedBy: "u",
    });

    const reviewed = await store.review({
      id: r.id,
      status: "rejected",
      reviewedBy: "cco",
      rationale: "Needs more work on risk factors.",
    });

    expect(reviewed!.status).toBe("rejected");
  });

  it("does not allow reviewing an already-terminal request", async () => {
    const r = await store.create({
      matterId: "m-1",
      outputHash: "h",
      summary: "S",
      requestedBy: "u",
    });
    await store.review({ id: r.id, status: "approved", reviewedBy: "cco" });

    const second = await store.review({ id: r.id, status: "rejected", reviewedBy: "cco" });
    // Should remain approved
    expect(second!.status).toBe("approved");
  });

  it("withdraws a requested approval", async () => {
    const r = await store.create({
      matterId: "m-1",
      outputHash: "h",
      summary: "S",
      requestedBy: "u",
    });
    const withdrawn = await store.withdraw(r.id, "u");
    expect(withdrawn!.status).toBe("withdrawn");
  });

  it("returns null for unknown ids", async () => {
    expect(await store.review({ id: "nope", status: "approved", reviewedBy: "x" })).toBeNull();
    expect(await store.withdraw("nope", "u")).toBeNull();
    expect(await store.get("nope")).toBeNull();
  });

  it("tracks store size", async () => {
    expect(await store.size()).toBe(0);
    await store.create({ matterId: "m", outputHash: "h", summary: "S", requestedBy: "u" });
    expect(await store.size()).toBe(1);
  });
});
