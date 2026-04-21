import { describe, it, expect, beforeEach } from "vitest";
import { GET as auditExportGet } from "../../app/api/matters/[id]/audit-export/route";
import {
  InMemoryMatterStore,
  setMatterStore,
} from "../matter-store";
import { getDefaultAuditStore, sha256 } from "../audit-store";
import { setApprovalStore } from "../approvals-store";
import { InMemoryApprovalStore } from "@compliance-ai/approvals";

describe("GET /api/matters/[id]/audit-export", () => {
  let matterStore: InMemoryMatterStore;
  let approvalStore: InMemoryApprovalStore;

  beforeEach(() => {
    matterStore = new InMemoryMatterStore();
    approvalStore = new InMemoryApprovalStore();
    setMatterStore(matterStore);
    setApprovalStore(approvalStore);
  });

  async function call(matterId: string, query = "") {
    const req = new Request(`http://localhost/api/matters/${matterId}/audit-export${query}`);
    return auditExportGet(
      req as unknown as Parameters<typeof auditExportGet>[0],
      { params: Promise.resolve({ id: matterId }) },
    );
  }

  async function makeMatter() {
    return matterStore.create({
      title: "Audit Export Test Matter",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
  }

  it("404s when the matter doesn't exist", async () => {
    const res = await call("missing-matter-id");
    expect(res.status).toBe(404);
  });

  it("returns a JSON bundle with matter meta + empty audit trail for a brand-new matter", async () => {
    const matter = await makeMatter();
    const res = await call(matter.id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/application\/json/);
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment/);
    const body = (await res.json()) as {
      matter: { id: string; title: string };
      auditTrail: unknown[];
      approvals: unknown[];
      hashChainValid: boolean;
      generatedAt: string;
    };
    expect(body.matter.id).toBe(matter.id);
    expect(body.matter.title).toBe("Audit Export Test Matter");
    expect(body.auditTrail).toEqual([]);
    expect(body.approvals).toEqual([]);
    expect(body.hashChainValid).toBe(true);
    expect(typeof body.generatedAt).toBe("string");
  });

  it("includes every audit entry in chronological order + the binding approval", async () => {
    const matter = await makeMatter();
    const audit = getDefaultAuditStore();
    await audit.append(matter.id, {
      matterId: matter.id,
      organizationId: matter.organizationId,
      actor: "om-reviewer",
      action: "query",
      inputHash: sha256("query-1"),
      authoritiesUsed: [],
      outputHash: null,
      judgeVerdict: null,
      inputContent: "first",
      outputContent: null,
    });
    await audit.append(matter.id, {
      matterId: matter.id,
      organizationId: matter.organizationId,
      actor: "om-reviewer",
      action: "generation",
      inputHash: sha256("gen-1"),
      authoritiesUsed: ["auth-x"],
      outputHash: sha256("out-1"),
      judgeVerdict: null,
      inputContent: null,
      outputContent: "output body",
    });
    const approval = await approvalStore.create(
      {
        matterId: matter.id,
        outputHash: sha256("out-1"),
        summary: "reviewer approved",
        requestedBy: "user",
      },
      matter.organizationId,
    );
    await approvalStore.review({
      id: approval.id,
      status: "approved",
      reviewedBy: "reviewer-jane",
      rationale: "looks good",
    });

    const res = await call(matter.id);
    const body = (await res.json()) as {
      auditTrail: Array<{ action: string; actor: string }>;
      approvals: Array<{ status: string; rationale?: string }>;
      hashChainValid: boolean;
    };
    expect(body.auditTrail).toHaveLength(2);
    // Chronological (oldest first) — the query entry comes before the
    // generation entry.
    expect(body.auditTrail[0]!.action).toBe("query");
    expect(body.auditTrail[1]!.action).toBe("generation");
    expect(body.hashChainValid).toBe(true);
    expect(body.approvals).toHaveLength(1);
    expect(body.approvals[0]!.status).toBe("approved");
    expect(body.approvals[0]!.rationale).toBe("looks good");
  });

  it("returns a DOCX when format=docx is requested", async () => {
    const matter = await makeMatter();
    const audit = getDefaultAuditStore();
    await audit.append(matter.id, {
      matterId: matter.id,
      organizationId: matter.organizationId,
      actor: "system",
      action: "retrieval",
      inputHash: sha256("ret-1"),
      authoritiesUsed: ["auth-a", "auth-b"],
      outputHash: null,
      judgeVerdict: null,
      inputContent: "retrieved 2 authorities",
      outputContent: null,
    });
    const res = await call(matter.id, "?format=docx");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toMatch(/officedocument/);
    expect(res.headers.get("Content-Disposition")).toMatch(/\.docx/);
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(2000);
  });

  it("content-disposition filename is derived from the matter title (slug-safe)", async () => {
    const matter = await matterStore.create({
      title: "Doe v. Acme Corp. — 2026 OM Review (urgent)",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    const res = await call(matter.id);
    const disp = res.headers.get("Content-Disposition") ?? "";
    // No spaces, no unsafe chars, prefixed with "audit-"
    expect(disp).toMatch(/filename="audit-[A-Za-z0-9-]+\.json"/);
  });
});
