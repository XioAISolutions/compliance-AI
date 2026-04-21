import { describe, it, expect, beforeEach } from "vitest";
import { GET as auditGet } from "../../app/api/matters/[id]/audit-export/route";
import { POST as exportPost } from "../../app/api/matters/[id]/export/route";
import { InMemoryMatterStore, setMatterStore } from "../matter-store";
import { getDefaultAuditStore, sha256 } from "../audit-store";
import { setApprovalStore } from "../approvals-store";
import { InMemoryApprovalStore } from "@compliance-ai/approvals";

/**
 * End-to-end privilege redaction via the two endpoints that actually
 * run it: /audit-export (external-audience default redact) and /export
 * (internal-audience default show). Proves:
 *
 *   - audit-export REDACTS privileged entries by default
 *   - audit-export ?show=privilege surfaces them intact
 *   - /export SHOWS privileged citations by default (internal path)
 *   - /export ?redact=privilege strips privileged citations
 *   - non-privileged entries/citations pass through unchanged either way
 *   - the X-Privilege-* response headers carry the policy decision
 */
describe("Privilege redaction — /audit-export", () => {
  let matterStore: InMemoryMatterStore;

  beforeEach(async () => {
    matterStore = new InMemoryMatterStore();
    setMatterStore(matterStore);
    setApprovalStore(new InMemoryApprovalStore());
  });

  async function makeMatter() {
    return matterStore.create({
      title: "Priv Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
  }

  async function seed(matterId: string) {
    const audit = getDefaultAuditStore();
    // Public action — stays intact regardless of redaction policy.
    await audit.append(matterId, {
      matterId,
      organizationId: "preview",
      actor: "system",
      action: "retrieval",
      inputHash: sha256("q1"),
      authoritiesUsed: ["auth-public"],
      outputHash: null,
      judgeVerdict: null,
      inputContent: "retrieved public authorities",
      outputContent: null,
    });
    // Privileged action — should be redacted on external default.
    await audit.append(matterId, {
      matterId,
      organizationId: "preview",
      actor: "om-reviewer",
      action: "generation",
      inputHash: sha256("priv-in"),
      authoritiesUsed: ["auth-x"],
      outputHash: sha256("priv-out"),
      judgeVerdict: null,
      inputContent: "client told us the backdated contract was intentional",
      outputContent: "memo on strategy + risk exposure",
      privilege: "solicitor-client",
    });
  }

  async function call(matterId: string, query: string): Promise<Response> {
    const req = new Request(`http://localhost/api/matters/${matterId}/audit-export${query}`);
    return auditGet(req as unknown as Parameters<typeof auditGet>[0], {
      params: Promise.resolve({ id: matterId }),
    });
  }

  it("default (external audience) redacts privileged entries", async () => {
    const m = await makeMatter();
    await seed(m.id);
    const res = await call(m.id, "");
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Privilege-Policy-Source")).toBe("default");
    const body = (await res.json()) as {
      privilege: { redactionApplied: boolean; privilegedEntryCount: number };
      auditTrail: Array<{ action: string; inputContent: string | null; outputContent: string | null }>;
    };
    expect(body.privilege.redactionApplied).toBe(true);
    expect(body.privilege.privilegedEntryCount).toBe(1);
    const pub = body.auditTrail.find((e) => e.action === "retrieval")!;
    const priv = body.auditTrail.find((e) => e.action === "generation")!;
    expect(pub.inputContent).toBe("retrieved public authorities");
    expect(priv.inputContent).toBe("[REDACTED — privileged]");
    expect(priv.outputContent).toBe("[REDACTED — privileged]");
  });

  it("?show=privilege surfaces privileged entries intact", async () => {
    const m = await makeMatter();
    await seed(m.id);
    const res = await call(m.id, "?show=privilege");
    expect(res.headers.get("X-Privilege-Policy-Source")).toBe("override-show");
    const body = (await res.json()) as {
      privilege: { redactionApplied: boolean };
      auditTrail: Array<{ action: string; inputContent: string | null }>;
    };
    expect(body.privilege.redactionApplied).toBe(false);
    const priv = body.auditTrail.find((e) => e.action === "generation")!;
    expect(priv.inputContent).toMatch(/backdated contract/);
  });

  it("emits X-Privilege-* headers on DOCX responses", async () => {
    const m = await makeMatter();
    await seed(m.id);
    const res = await call(m.id, "?format=docx");
    expect(res.headers.get("X-Privilege-Redacted")).toBe("true");
    expect(res.headers.get("X-Privilege-Count")).toBe("1");
    expect(res.headers.get("X-Privilege-Policy-Source")).toBe("default");
  });
});

describe("Privilege redaction — /export (internal audience)", () => {
  let matterStore: InMemoryMatterStore;
  let approvalStore: InMemoryApprovalStore;

  beforeEach(() => {
    matterStore = new InMemoryMatterStore();
    approvalStore = new InMemoryApprovalStore();
    setMatterStore(matterStore);
    setApprovalStore(approvalStore);
  });

  async function makeMatter() {
    return matterStore.create({
      title: "Priv Export Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
  }

  async function call(
    matterId: string,
    body: unknown,
    headers: Record<string, string> = {},
    query = "",
  ): Promise<Response> {
    const req = new Request(`http://localhost/api/matters/${matterId}/export${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    return exportPost(req as unknown as Parameters<typeof exportPost>[0], {
      params: Promise.resolve({ id: matterId }),
    });
  }

  it("default (internal audience) shows privileged citations intact", async () => {
    const m = await makeMatter();
    const res = await call(
      m.id,
      {
        output: "Mixed [c1] public [c2] private.",
        citations: [
          { id: "c1", authorityId: "public", section: "1", quote: "public quote", docId: "d", chunkId: "ch1" },
          {
            id: "c2",
            authorityId: "internal-memo",
            section: "1",
            quote: "privileged memo text",
            docId: "d",
            chunkId: "ch2",
            privilege: "solicitor-client",
          },
        ],
      },
      { "X-Approval-Override": "test" },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Privilege-Redacted")).toBe("false");
    expect(res.headers.get("X-Privilege-Count")).toBe("1");
    expect(res.headers.get("X-Privilege-Policy-Source")).toBe("default");
  });

  it("?redact=privilege flips /export to strip privileged citations", async () => {
    const m = await makeMatter();
    const res = await call(
      m.id,
      {
        output: "Mixed [c1] [c2].",
        citations: [
          { id: "c1", authorityId: "p", section: "1", quote: "public", docId: "d", chunkId: "ch1" },
          {
            id: "c2",
            authorityId: "p",
            section: "1",
            quote: "privileged memo text",
            docId: "d",
            chunkId: "ch2",
            privilege: "work-product",
          },
        ],
      },
      { "X-Approval-Override": "test" },
      "?redact=privilege",
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Privilege-Redacted")).toBe("true");
    expect(res.headers.get("X-Privilege-Policy-Source")).toBe("override-redact");
  });
});
