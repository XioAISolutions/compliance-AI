import { describe, it, expect } from "vitest";
import { GET as sourcePacksGet } from "../../app/api/source-packs/route";

describe("GET /api/source-packs", () => {
  async function call(query = ""): Promise<{ packs: Array<Record<string, unknown>> }> {
    const req = new Request(`http://localhost/api/source-packs${query}`);
    const res = await sourcePacksGet(req as unknown as Parameters<typeof sourcePacksGet>[0]);
    expect(res.status).toBe(200);
    return (await res.json()) as { packs: Array<Record<string, unknown>> };
  }

  it("returns every pack when called without filters", async () => {
    const body = await call();
    const ids = body.packs.map((p) => p.id).sort();
    expect(ids).toEqual(
      [
        "ca-consumer-protection",
        "ca-court-ai",
        "ca-federal-aml",
        "ca-privacy",
        "ca-securities-ontario",
      ].sort(),
    );
  });

  it("narrows to privacy when taskType=pipeda-check", async () => {
    const body = await call("?taskType=pipeda-check");
    expect(body.packs.map((p) => p.id)).toEqual(["ca-privacy"]);
  });

  it("narrows to court-ai when taskType=court-ai-disclosure", async () => {
    const body = await call("?taskType=court-ai-disclosure");
    expect(body.packs.map((p) => p.id)).toEqual(["ca-court-ai"]);
  });

  it("returns securities + AML for om-review + emd", async () => {
    const body = await call("?taskType=om-review&registrationCategory=emd");
    const ids = body.packs.map((p) => p.id);
    expect(ids).toContain("ca-securities-ontario");
    expect(ids).toContain("ca-federal-aml");
  });

  it("returns the cross-cutting set for missing-authority-scan", async () => {
    const body = await call("?taskType=missing-authority-scan");
    expect(body.packs.length).toBe(5);
  });

  it("honors ?lane= when taskType is not provided", async () => {
    const body = await call("?lane=privacy");
    expect(body.packs.map((p) => p.id)).toEqual(["ca-privacy"]);
  });

  it("ignores invalid lane values and returns all packs", async () => {
    const body = await call("?lane=not-a-real-lane");
    expect(body.packs.length).toBe(5);
  });

  it("summaries include itemCount but not items", async () => {
    const body = await call("?taskType=pipeda-check");
    const pack = body.packs[0]!;
    expect(typeof pack.itemCount).toBe("number");
    expect(pack).not.toHaveProperty("items");
  });
});
