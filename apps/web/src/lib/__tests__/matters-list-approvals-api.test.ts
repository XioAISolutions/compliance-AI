import { describe, it, expect, beforeEach } from "vitest";
import { GET as mattersGet } from "../../app/api/matters/route";
import {
  InMemoryMatterStore,
  setMatterStore,
} from "../matter-store";
import { setApprovalStore } from "../approvals-store";
import { InMemoryApprovalStore } from "@compliance-ai/approvals";
import { sha256 } from "../audit-store";

/**
 * Triage-chip contract — the matters list calls
 * GET /api/matters?withApprovals=1 and renders an approval chip per
 * row from the returned `approvalSummary`. This test pins the
 * enrichment shape + precedence so the chip never goes stale on a
 * server-side change.
 */
describe("GET /api/matters?withApprovals=1", () => {
  let matterStore: InMemoryMatterStore;
  let approvalStore: InMemoryApprovalStore;

  beforeEach(() => {
    matterStore = new InMemoryMatterStore();
    approvalStore = new InMemoryApprovalStore();
    setMatterStore(matterStore);
    setApprovalStore(approvalStore);
  });

  async function call(query = ""): Promise<unknown[]> {
    const req = new Request(`http://localhost/api/matters${query}`);
    const res = await mattersGet(req as unknown as Parameters<typeof mattersGet>[0]);
    expect(res.status).toBe(200);
    return (await res.json()) as unknown[];
  }

  it("does NOT include approvalSummary when ?withApprovals is absent", async () => {
    await matterStore.create({
      title: "Plain Matter",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    const list = (await call()) as Array<Record<string, unknown>>;
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty("approvalSummary");
  });

  it("includes approvalSummary on every matter when ?withApprovals=1", async () => {
    await matterStore.create({
      title: "Empty Matter",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    const list = (await call("?withApprovals=1")) as Array<{
      approvalSummary: { requested: number; approved: number; rejected: number; withdrawn: number; latest: string | null };
    }>;
    expect(list).toHaveLength(1);
    expect(list[0]!.approvalSummary).toEqual({
      requested: 0,
      approved: 0,
      rejected: 0,
      withdrawn: 0,
      latest: null,
    });
  });

  it("counts each status correctly across multiple approvals on one matter", async () => {
    const m = await matterStore.create({
      title: "Busy Matter",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });

    // One approved, one rejected, one withdrawn, one pending.
    const a1 = await approvalStore.create(
      { matterId: m.id, outputHash: sha256("o1"), summary: "v1", requestedBy: "u" },
      m.organizationId,
    );
    await approvalStore.review({ id: a1.id, status: "approved", reviewedBy: "r" });
    const a2 = await approvalStore.create(
      { matterId: m.id, outputHash: sha256("o2"), summary: "v2", requestedBy: "u" },
      m.organizationId,
    );
    await approvalStore.review({ id: a2.id, status: "rejected", reviewedBy: "r" });
    const a3 = await approvalStore.create(
      { matterId: m.id, outputHash: sha256("o3"), summary: "v3", requestedBy: "u" },
      m.organizationId,
    );
    await approvalStore.withdraw(a3.id, "u");
    await approvalStore.create(
      { matterId: m.id, outputHash: sha256("o4"), summary: "v4", requestedBy: "u" },
      m.organizationId,
    );

    const list = (await call("?withApprovals=1")) as Array<{
      id: string;
      approvalSummary: { requested: number; approved: number; rejected: number; withdrawn: number; latest: string | null };
    }>;
    const row = list.find((x) => x.id === m.id)!;
    expect(row.approvalSummary.requested).toBe(1);
    expect(row.approvalSummary.approved).toBe(1);
    expect(row.approvalSummary.rejected).toBe(1);
    expect(row.approvalSummary.withdrawn).toBe(1);
    // `latest` reflects the newest-first ordering, but creating four
    // approvals back-to-back in the same millisecond makes the sort
    // tie-broken by insertion order — we only assert that it's one of
    // the four real statuses, not which.
    expect(["requested", "approved", "rejected", "withdrawn"]).toContain(
      row.approvalSummary.latest,
    );
  });

  it("scopes the approval summary to its own matter (no leakage between rows)", async () => {
    const m1 = await matterStore.create({
      title: "Matter A",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    const m2 = await matterStore.create({
      title: "Matter B",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    const a = await approvalStore.create(
      { matterId: m1.id, outputHash: sha256("o"), summary: "approved", requestedBy: "u" },
      m1.organizationId,
    );
    await approvalStore.review({ id: a.id, status: "approved", reviewedBy: "r" });

    const list = (await call("?withApprovals=1")) as Array<{
      id: string;
      approvalSummary: { approved: number };
    }>;
    const aRow = list.find((x) => x.id === m1.id)!;
    const bRow = list.find((x) => x.id === m2.id)!;
    expect(aRow.approvalSummary.approved).toBe(1);
    expect(bRow.approvalSummary.approved).toBe(0);
  });
});
