import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  InMemoryMatterStore,
  setMatterStore,
  type MatterStore,
} from "../matter-store";

describe("MatterStore chunk storage", () => {
  let store: MatterStore;

  beforeEach(() => {
    store = new InMemoryMatterStore();
    setMatterStore(store);
  });

  afterEach(() => {
    setMatterStore(null);
  });

  it("stores chunks and updates document chunkCount", async () => {
    const matter = await store.create({
      title: "Chunk Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    const doc = await store.addDocument(matter.id, "om.pdf", "offering-memo", {
      sha256: "a".repeat(64),
      pageCount: 3,
    });
    expect(doc.chunkCount).toBe(0);
    expect(doc.sha256).toBe("a".repeat(64));
    expect(doc.pageCount).toBe(3);

    const chunks = [
      {
        id: "ch-1",
        docId: doc.id,
        ordinal: 0,
        content: "First chunk.",
        charStart: 0,
        charEnd: 12,
        tokenCount: 3,
      },
      {
        id: "ch-2",
        docId: doc.id,
        ordinal: 1,
        content: "Second chunk.",
        charStart: 12,
        charEnd: 25,
        tokenCount: 3,
      },
    ];

    const stored = await store.addChunks(matter.id, doc.id, chunks);
    expect(stored).toHaveLength(2);
    expect(stored[0]!.matterId).toBe(matter.id);

    const docs = await store.getDocuments(matter.id);
    const updatedDoc = docs.find((d) => d.id === doc.id);
    expect(updatedDoc!.chunkCount).toBe(2);
  });

  it("retrieves chunks by doc id in insertion order", async () => {
    const matter = await store.create({
      title: "Chunk Order Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    const doc = await store.addDocument(matter.id, "test.pdf", "offering-memo");

    const chunks = Array.from({ length: 5 }, (_, i) => ({
      id: `ch-${i}`,
      docId: doc.id,
      ordinal: i,
      content: `Chunk ${i}.`,
      charStart: i * 10,
      charEnd: (i + 1) * 10,
      tokenCount: 2,
    }));

    await store.addChunks(matter.id, doc.id, chunks);

    const retrieved = await store.getChunksByDoc(doc.id);
    expect(retrieved).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(retrieved[i]!.ordinal).toBe(i);
    }
  });

  it("retrieves chunks across all documents in a matter", async () => {
    const matter = await store.create({
      title: "Multi-doc Matter",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    const doc1 = await store.addDocument(matter.id, "doc1.pdf", "offering-memo");
    const doc2 = await store.addDocument(matter.id, "doc2.pdf", "kyc-aml-file");

    await store.addChunks(matter.id, doc1.id, [
      {
        id: "ch-a",
        docId: doc1.id,
        ordinal: 0,
        content: "A",
        charStart: 0,
        charEnd: 1,
        tokenCount: 1,
      },
    ]);
    await store.addChunks(matter.id, doc2.id, [
      {
        id: "ch-b",
        docId: doc2.id,
        ordinal: 0,
        content: "B",
        charStart: 0,
        charEnd: 1,
        tokenCount: 1,
      },
      {
        id: "ch-c",
        docId: doc2.id,
        ordinal: 1,
        content: "C",
        charStart: 1,
        charEnd: 2,
        tokenCount: 1,
      },
    ]);

    const all = await store.getChunksByMatter(matter.id);
    expect(all).toHaveLength(3);
    expect(all.map((c) => c.id).sort()).toEqual(["ch-a", "ch-b", "ch-c"]);
  });

  it("returns empty array when no chunks exist for a doc", async () => {
    expect(await store.getChunksByDoc("nonexistent")).toEqual([]);
    expect(await store.getChunksByMatter("nonexistent")).toEqual([]);
  });

  it("carries page number through to stored chunk", async () => {
    const matter = await store.create({
      title: "Page Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    const doc = await store.addDocument(matter.id, "paged.pdf", "offering-memo");

    await store.addChunks(matter.id, doc.id, [
      {
        id: "ch-p1",
        docId: doc.id,
        ordinal: 0,
        content: "Page 1",
        charStart: 0,
        charEnd: 6,
        page: 1,
        tokenCount: 2,
      },
      {
        id: "ch-p5",
        docId: doc.id,
        ordinal: 1,
        content: "Page 5",
        charStart: 10,
        charEnd: 16,
        page: 5,
        tokenCount: 2,
      },
    ]);

    const retrieved = await store.getChunksByDoc(doc.id);
    expect(retrieved[0]!.page).toBe(1);
    expect(retrieved[1]!.page).toBe(5);
  });
});
