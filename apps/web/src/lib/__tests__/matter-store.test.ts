import { describe, it, expect, beforeEach } from "vitest";

// Direct import from the module since we're testing the class, not the singleton
// We'll re-implement a minimal store instance for testing
describe("MatterStore", () => {
  // Since the store is a class inside a module with a singleton getter,
  // we import the getter and test through it. In a real test we'd mock
  // the module boundary; here we just test the logic end-to-end.

  let store: ReturnType<typeof import("../matter-store").getDefaultMatterStore>;

  beforeEach(async () => {
    // Re-import to get a fresh module — vitest handles this via vi.resetModules
    // For simplicity, we'll just test the exported functions directly
    const mod = await import("../matter-store");
    store = mod.getDefaultMatterStore();
  });

  it("creates a matter with all required fields", () => {
    const matter = store.create({
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

  it("retrieves a matter by ID", () => {
    const created = store.create({
      title: "Retrievable",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });

    const found = store.get(created.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe("Retrievable");
  });

  it("returns null for non-existent matter", () => {
    const found = store.get("non-existent-id");
    expect(found).toBeNull();
  });

  it("lists matters sorted by creation time (newest first)", async () => {
    const first = store.create({ title: "First", jurisdiction: "ontario", registrationCategory: "emd", taskType: "om-review" });
    // Ensure different timestamps
    await new Promise((r) => setTimeout(r, 5));
    const second = store.create({ title: "Second", jurisdiction: "quebec", registrationCategory: "pm", taskType: "kyc-gap-check" });
    expect(second.createdAt.getTime()).toBeGreaterThanOrEqual(first.createdAt.getTime());

    const list = store.list();
    expect(list.length).toBeGreaterThanOrEqual(2);
    // Find only our two matters (store is a singleton, may have others)
    const ourMatters = list.filter((m) => m.title === "First" || m.title === "Second");
    expect(ourMatters[0]!.title).toBe("Second"); // Newest first
    expect(ourMatters[1]!.title).toBe("First");
  });

  it("updates matter status", () => {
    const matter = store.create({
      title: "Status Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });

    const updated = store.updateStatus(matter.id, "in-review");
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("in-review");
    expect(updated!.updatedAt.getTime()).toBeGreaterThanOrEqual(matter.createdAt.getTime());
  });

  it("adds documents to a matter", () => {
    const matter = store.create({
      title: "Doc Test",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });

    const doc = store.addDocument(matter.id, "test-om.pdf", "offering-memo");
    expect(doc.id).toBeTruthy();
    expect(doc.filename).toBe("test-om.pdf");
    expect(doc.documentType).toBe("offering-memo");
    expect(doc.matterId).toBe(matter.id);

    const docs = store.getDocuments(matter.id);
    expect(docs).toHaveLength(1);
    expect(docs[0]!.filename).toBe("test-om.pdf");
  });

  it("returns empty documents for a matter with none", () => {
    const matter = store.create({
      title: "No Docs",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });

    const docs = store.getDocuments(matter.id);
    expect(docs).toHaveLength(0);
  });

  it("tracks store size", () => {
    const initial = store.size();
    store.create({ title: "Size Test", jurisdiction: "ontario", registrationCategory: "emd", taskType: "om-review" });
    expect(store.size()).toBe(initial + 1);
  });
});
