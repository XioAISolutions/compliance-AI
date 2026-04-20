import { describe, it, expect, beforeEach } from "vitest";
import { POST as exportRedlinePost } from "../../app/api/matters/[id]/export-redline/route";
import { InMemoryMatterStore, setMatterStore } from "../matter-store";
import { setApprovalStore } from "../approvals-store";
import { InMemoryApprovalStore } from "@compliance-ai/approvals";
import { sha256 } from "../audit-store";

describe("POST /api/matters/[id]/export-redline", () => {
  let matterStore: InMemoryMatterStore;
  let approvalStore: InMemoryApprovalStore;

  beforeEach(() => {
    matterStore = new InMemoryMatterStore();
    approvalStore = new InMemoryApprovalStore();
    setMatterStore(matterStore);
    setApprovalStore(approvalStore);
  });

  async function callRedline(
    matterId: string,
    body: unknown,
    headers: Record<string, string> = {},
  ) {
    const req = new Request(`http://localhost/api/matters/${matterId}/export-redline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    return exportRedlinePost(
      req as unknown as Parameters<typeof exportRedlinePost>[0],
      { params: Promise.resolve({ id: matterId }) },
    );
  }

  async function makeMatter() {
    return matterStore.create({
      title: "Redline Test",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "contract-redline",
    });
  }

  it("404s when the matter doesn't exist", async () => {
    const res = await callRedline("missing-matter-id", { output: "hello" });
    expect(res.status).toBe(404);
  });

  it("400s on missing body", async () => {
    const matter = await makeMatter();
    const res = await callRedline(matter.id, {});
    expect(res.status).toBe(400);
  });

  it("blocks 403 approval-required when no approval exists", async () => {
    const matter = await makeMatter();
    const res = await callRedline(matter.id, {
      output: "Notice within [-ten-]{+thirty+} days.",
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("approval-required");
  });

  it("allows export with X-Approval-Override (audited)", async () => {
    const matter = await makeMatter();
    const res = await callRedline(
      matter.id,
      { output: "Notice within [-ten-]{+thirty+} days. <<NOTE: market norm>>" },
      { "X-Approval-Override": "urgent - COO signed off verbally" },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/officedocument/);
  });

  it("allows export when an approved approval binds to the output hash", async () => {
    const matter = await makeMatter();
    const output = "Deleted clause [-goes here-] replaced with {+new clause+}.";
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
    const res = await callRedline(matter.id, { output });
    expect(res.status).toBe(200);
    // The render surfaces counts in headers so the client can show a
    // "3 insertions · 1 deletion · 0 notes" preview without parsing.
    expect(res.headers.get("X-Redline-Insertions")).toBe("1");
    expect(res.headers.get("X-Redline-Deletions")).toBe("1");
  });
});
