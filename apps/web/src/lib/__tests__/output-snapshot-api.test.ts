import { describe, it, expect, beforeEach } from "vitest";
import { GET as outputsGet } from "../../app/api/matters/[id]/outputs/route";
import { InMemoryMatterStore, setMatterStore } from "../matter-store";
import {
  InMemoryOutputSnapshotStore,
  setOutputSnapshotStore,
} from "../output-snapshot-store";

describe("GET /api/matters/[id]/outputs", () => {
  let matterStore: InMemoryMatterStore;
  let snapStore: InMemoryOutputSnapshotStore;

  beforeEach(() => {
    matterStore = new InMemoryMatterStore();
    snapStore = new InMemoryOutputSnapshotStore();
    setMatterStore(matterStore);
    setOutputSnapshotStore(snapStore);
  });

  async function makeMatter() {
    return matterStore.create({
      title: "Compare Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
  }

  async function call(matterId: string, query = ""): Promise<Response> {
    const req = new Request(`http://localhost/api/matters/${matterId}/outputs${query}`);
    return outputsGet(req as unknown as Parameters<typeof outputsGet>[0], {
      params: Promise.resolve({ id: matterId }),
    });
  }

  it("404s on missing matter", async () => {
    const res = await call("nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns empty version list for a fresh matter", async () => {
    const m = await makeMatter();
    const res = await call(m.id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      latest: number | null;
      versions: unknown[];
    };
    expect(body.count).toBe(0);
    expect(body.latest).toBeNull();
    expect(body.versions).toEqual([]);
  });

  it("lists snapshots newest-last with sequential version numbers", async () => {
    const m = await makeMatter();
    await snapStore.append({ matterId: m.id, content: "v1 body", citations: [{ id: "c1" }] });
    await snapStore.append({ matterId: m.id, content: "v2 body" });
    await snapStore.append({ matterId: m.id, content: "v3 body" });

    const res = await call(m.id);
    const body = (await res.json()) as {
      count: number;
      latest: number;
      versions: Array<{ versionNo: number; citationCount: number }>;
    };
    expect(body.count).toBe(3);
    expect(body.latest).toBe(3);
    expect(body.versions.map((v) => v.versionNo)).toEqual([1, 2, 3]);
    expect(body.versions[0]!.citationCount).toBe(1);
    expect(body.versions[1]!.citationCount).toBe(0);
  });

  it("?compare=N diffs version N vs the latest by default", async () => {
    const m = await makeMatter();
    await snapStore.append({ matterId: m.id, content: "Within ten days." });
    await snapStore.append({ matterId: m.id, content: "Within thirty days." });
    const res = await call(m.id, "?compare=1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      from: { versionNo: number };
      to: { versionNo: number };
      markup: string;
      stats: { inserted: number; deleted: number };
    };
    expect(body.from.versionNo).toBe(1);
    expect(body.to.versionNo).toBe(2);
    expect(body.markup).toContain("[-ten-]");
    expect(body.markup).toContain("{+thirty+}");
    expect(body.stats.inserted).toBe(1);
    expect(body.stats.deleted).toBe(1);
  });

  it("?compare=N&to=M compares two explicit versions", async () => {
    const m = await makeMatter();
    await snapStore.append({ matterId: m.id, content: "v1" });
    await snapStore.append({ matterId: m.id, content: "v2" });
    await snapStore.append({ matterId: m.id, content: "v3" });
    const res = await call(m.id, "?compare=1&to=2");
    const body = (await res.json()) as { from: { versionNo: number }; to: { versionNo: number } };
    expect(body.from.versionNo).toBe(1);
    expect(body.to.versionNo).toBe(2);
  });

  it("404s when the compare or to version is missing", async () => {
    const m = await makeMatter();
    await snapStore.append({ matterId: m.id, content: "only" });
    const res = await call(m.id, "?compare=5");
    expect(res.status).toBe(404);
  });

  it("400s on malformed version numbers", async () => {
    const m = await makeMatter();
    await snapStore.append({ matterId: m.id, content: "v1" });
    const res = await call(m.id, "?compare=abc");
    expect(res.status).toBe(400);
  });
});
