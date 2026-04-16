import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  InMemoryMatterStore,
  setMatterStore,
  getDefaultMatterStore,
  type MatterStore,
} from "../matter-store";

describe("MatterStore (in-memory)", () => {
  let store: MatterStore;

  beforeEach(() => {
    store = new InMemoryMatterStore();
    setMatterStore(store);
  });

  afterEach(() => {
    setMatterStore(null);
  });

  it("creates a matter with all required fields", async () => {
    const matter = await store.create({
      title: "Test OM Review",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });

    expect(matter.id).toBeTruthy();
    expect(matter.title).toBe("Test OM Review");
    expect(matter.jurisdiction).toBe("ontario");
    expect(matter.registrationCategory).toBe("emd");
    expect(matter.taskType).toBe("om-review");
    expect(matter.status).toBe("open");
    expect(matter.organizationId).toBe("preview");
    expect(matter.createdAt).toBeInstanceOf(Date);
  });

  it("retrieves a matter by ID", async () => {
    const created = await store.create({
      title: "Retrievable",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });

    const found = await store.get(created.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Retrievable");
  });

  it("returns null for non-existent matter", async () => {
    const found = await store.get("non-existent-id");
    expect(found).toBeNull();
  });

  it("lists matters sorted by creation time (newest first)", async () => {
    const first = await store.create({
      title: "First",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    await new Promise((r) => setTimeout(r, 5));
    const second = await store.create({
      title: "Second",
      jurisdiction: "quebec",
      registrationCategory: "pm",
      taskType: "kyc-gap-check",
    });
    expect(second.createdAt.getTime()).toBeGreaterThanOrEqual(first.createdAt.getTime());

    const list = await store.list();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0]!.title).toBe("Second"); // Newest first
    expect(list[1]!.title).toBe("First");
  });

  it("updates matter status", async () => {
    const matter = await store.create({
      title: "Status Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });

    const updated = await store.updateStatus(matter.id, "in-review");
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("in-review");
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(matter.createdAt.getTime());
  });

  it("adds documents to a matter", async () => {
    const matter = await store.create({
      title: "Doc Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });

    const doc = await store.addDocument(matter.id, "test-om.pdf", "offering-memo");
    expect(doc.id).toBeTruthy();
    expect(doc.filename).toBe("test-om.pdf");
    expect(doc.documentType).toBe("offering-memo");
    expect(doc.matterId).toBe(matter.id);

    const docs = await store.getDocuments(matter.id);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.filename).toBe("test-om.pdf");
  });

  it("returns empty documents for a matter with none", async () => {
    const matter = await store.create({
      title: "No Docs",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });

    const docs = await store.getDocuments(matter.id);
    expect(docs).toHaveLength(0);
  });

  it("tracks store size", async () => {
    const initial = await store.size();
    await store.create({
      title: "Size Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    expect(await store.size()).toBe(initial + 1);
  });
});

describe("getDefaultMatterStore", () => {
  it("returns in-memory backend when DATABASE_URL is unset", () => {
    const prev = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    setMatterStore(null); // force re-init
    try {
      const store = getDefaultMatterStore();
      expect(store).toBeInstanceOf(InMemoryMatterStore);
    } finally {
      if (prev !== undefined) process.env.DATABASE_URL = prev;
      setMatterStore(null);
    }
  });

  it("uses the override when one is set", () => {
    const custom = new InMemoryMatterStore();
    setMatterStore(custom);
    try {
      expect(getDefaultMatterStore()).toBe(custom);
    } finally {
      setMatterStore(null);
    }
  });
});
