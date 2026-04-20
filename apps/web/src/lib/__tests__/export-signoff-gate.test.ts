import { describe, it, expect, beforeEach } from "vitest";
import { POST as exportPost } from "../../app/api/matters/[id]/export/route";
import { InMemoryMatterStore, setMatterStore } from "../matter-store";
import { setApprovalStore } from "../approvals-store";
import { InMemoryApprovalStore } from "@compliance-ai/approvals";
import { sha256 } from "../audit-store";

/**
 * Hard human signoff gate — POST /api/matters/[id]/export must block
 * unless an approved approval is bound to the exact output hash. Admin
 * override via X-Approval-Override header (audited).
 *
 * These are integration tests against the real route handler using the
 * in-memory stores the route already picks up via its factories.
 */
describe("Hard human signoff gate on /api/matters/[id]/export", () => {
  let matterStore: InMemoryMatterStore;
  let approvalStore: InMemoryApprovalStore;

  beforeEach(async () => {
    matterStore = new InMemoryMatterStore();
    approvalStore = new InMemoryApprovalStore();
    setMatterStore(matterStore);
    setApprovalStore(approvalStore);
  });

  async function makeMatter() {
    return matterStore.create({
      title: "Test Matter",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
  }

  async function callExport(matterId: string, body: unknown, headers: Record<string, string> = {}) {
    const req = new Request(`http://localhost/api/matters/${matterId}/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    // Next.js route handlers receive an object with `params` as a Promise.
    // The handler typing matches a plain fetch Request for our purposes.
    return exportPost(req as unknown as Parameters<typeof exportPost>[0], {
      params: Promise.resolve({ id: matterId }),
    });
  }

  it("blocks export with 403 approval-required when no approval exists", async () => {
    const matter = await makeMatter();
    const res = await callExport(matter.id, {
      format: "docx",
      output: "# Review\n\nSome output [c1].",
      citations: [],
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("approval-required");
    expect(typeof body.message).toBe("string");
    expect(typeof body.outputHash).toBe("string");
  });

  it("blocks export when an approval exists but binds to a different output hash", async () => {
    const matter = await makeMatter();
    await approvalStore.create(
      {
        matterId: matter.id,
        outputHash: sha256("# Different text"),
        summary: "approved earlier version",
        requestedBy: "user",
      },
      matter.organizationId,
    );
    const pending = await approvalStore.listByMatter(matter.id);
    expect(pending).toHaveLength(1);
    // Approve it.
    await approvalStore.review({
      id: pending[0]!.id,
      status: "approved",
      reviewedBy: "reviewer",
    });

    const res = await callExport(matter.id, {
      format: "docx",
      output: "# Review\n\nDifferent output — should not match.",
      citations: [],
    });
    expect(res.status).toBe(403);
  });

  it("blocks export when the approval is still pending (not yet approved)", async () => {
    const matter = await makeMatter();
    const output = "# Review\n\nPending approval.";
    await approvalStore.create(
      {
        matterId: matter.id,
        outputHash: sha256(output),
        summary: "awaiting review",
        requestedBy: "user",
      },
      matter.organizationId,
    );
    const res = await callExport(matter.id, {
      format: "docx",
      output,
      citations: [],
    });
    expect(res.status).toBe(403);
  });

  it("allows export when an approved approval binds to the exact output hash", async () => {
    const matter = await makeMatter();
    const output = "# Review\n\nFull output that a human has signed off on.";
    const approval = await approvalStore.create(
      {
        matterId: matter.id,
        outputHash: sha256(output),
        summary: "reviewer approved",
        requestedBy: "user",
      },
      matter.organizationId,
    );
    await approvalStore.review({
      id: approval.id,
      status: "approved",
      reviewedBy: "reviewer-jane",
    });

    const res = await callExport(matter.id, {
      format: "docx",
      output,
      citations: [],
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/officedocument/);
  });

  it("allows export with X-Approval-Override header (audited)", async () => {
    const matter = await makeMatter();
    const res = await callExport(
      matter.id,
      {
        format: "docx",
        output: "# Urgent override export",
        citations: [],
      },
      { "X-Approval-Override": "urgent - COO signed off verbally" },
    );
    expect(res.status).toBe(200);
  });

  it("blocks export when X-Approval-Override is present but empty", async () => {
    const matter = await makeMatter();
    const res = await callExport(
      matter.id,
      {
        format: "docx",
        output: "# No real reason",
        citations: [],
      },
      { "X-Approval-Override": "  " },
    );
    expect(res.status).toBe(403);
  });

  it("rejects when a rejected approval matches the output hash", async () => {
    const matter = await makeMatter();
    const output = "# Rejected output";
    const approval = await approvalStore.create(
      {
        matterId: matter.id,
        outputHash: sha256(output),
        summary: "reviewer rejecting",
        requestedBy: "user",
      },
      matter.organizationId,
    );
    await approvalStore.review({
      id: approval.id,
      status: "rejected",
      reviewedBy: "reviewer",
      rationale: "missing citations",
    });

    const res = await callExport(matter.id, {
      format: "docx",
      output,
      citations: [],
    });
    expect(res.status).toBe(403);
  });
});
