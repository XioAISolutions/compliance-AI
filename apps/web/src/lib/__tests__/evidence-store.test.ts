import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  InMemoryEvidenceStore,
  setEvidenceStore,
  extractEvidenceRequests,
  type EvidenceStore,
} from "../evidence-store";

describe("InMemoryEvidenceStore", () => {
  let store: EvidenceStore;

  beforeEach(() => {
    store = new InMemoryEvidenceStore();
    setEvidenceStore(store);
  });

  afterEach(() => setEvidenceStore(null));

  it("creates an evidence item with defaults", async () => {
    const item = await store.create({
      matterId: "m-1",
      title: "Audited financials",
      description: "Need the 2024 audited financial statements from the CFO",
    });

    expect(item.id).toBeTruthy();
    expect(item.matterId).toBe("m-1");
    expect(item.title).toBe("Audited financials");
    expect(item.status).toBe("missing");
    expect(item.organizationId).toBe("preview");
  });

  it("honors an explicit status on create", async () => {
    const item = await store.create({
      matterId: "m-1",
      title: "Already requested",
      description: "desc",
      status: "requested",
      requestedFrom: "CFO",
    });
    expect(item.status).toBe("requested");
    expect(item.requestedFrom).toBe("CFO");
  });

  it("lists evidence items scoped to the matter", async () => {
    await store.create({ matterId: "m-1", title: "A", description: "a" });
    await store.create({ matterId: "m-2", title: "B", description: "b" });
    await store.create({ matterId: "m-1", title: "C", description: "c" });

    const m1Items = await store.list("m-1");
    expect(m1Items).toHaveLength(2);
    expect(m1Items.map((i) => i.title).sort()).toEqual(["A", "C"]);
  });

  it("advances status through the lifecycle", async () => {
    const item = await store.create({
      matterId: "m-1",
      title: "Track record",
      description: "desc",
    });

    const requested = await store.updateStatus(item.id, "requested");
    expect(requested!.status).toBe("requested");

    const present = await store.updateStatus(item.id, "present", {
      fileUri: "s3://bucket/file.pdf",
      sha256: "a".repeat(64),
    });
    expect(present!.status).toBe("present");
    expect(present!.fileUri).toBe("s3://bucket/file.pdf");
    expect(present!.collectedAt).toBeInstanceOf(Date);

    const approved = await store.updateStatus(item.id, "approved", {
      reviewedBy: "user-cco",
    });
    expect(approved!.status).toBe("approved");
    expect(approved!.reviewedAt).toBeInstanceOf(Date);
    expect(approved!.reviewedBy).toBe("user-cco");
  });

  it("returns null for status update on unknown id", async () => {
    expect(await store.updateStatus("nope", "present")).toBeNull();
  });

  it("deletes items", async () => {
    const item = await store.create({
      matterId: "m-1",
      title: "Delete me",
      description: "desc",
    });
    expect(await store.delete(item.id)).toBe(true);
    expect(await store.get(item.id)).toBeNull();
  });

  it("counts items by matter", async () => {
    await store.create({ matterId: "m-1", title: "1", description: "d" });
    await store.create({ matterId: "m-1", title: "2", description: "d" });
    await store.create({ matterId: "m-2", title: "3", description: "d" });

    expect(await store.size("m-1")).toBe(2);
    expect(await store.size("m-2")).toBe(1);
    expect(await store.size()).toBe(3);
  });
});

describe("extractEvidenceRequests", () => {
  it("extracts PARTIAL and MISSING rows from a markdown table", () => {
    const output = `
### 1. Checklist

| # | Requirement | Rule Reference | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Issuer description | NI 45-106 s. 2.9 | FOUND | Present in section 1 |
| 2 | Risk factors | NI 45-106 s. 2.9 | PARTIAL | Too generic, lacks specificity |
| 3 | Use of proceeds | NI 45-106 s. 2.9 | MISSING | Not disclosed |
| 4 | Rights of action | OSC 45-501 s. 5.2 | FOUND | Section 8 |
`;

    const requests = extractEvidenceRequests(output);
    expect(requests).toHaveLength(2);
    expect(requests.map((r) => r.title)).toEqual(["Risk factors", "Use of proceeds"]);
    expect(requests[0]!.status).toBe("requested"); // PARTIAL → requested
    expect(requests[1]!.status).toBe("missing"); // MISSING → missing
    expect(requests[0]!.source).toBe("NI 45-106 s. 2.9");
    expect(requests[1]!.description).toBe("Not disclosed");
  });

  it("returns empty array when no table rows have PARTIAL/MISSING", () => {
    const output = `
All checks passed:
| # | Requirement | Rule Reference | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Everything | All | FOUND | Good |
`;
    expect(extractEvidenceRequests(output)).toEqual([]);
  });

  it("returns empty array when no markdown table is present", () => {
    expect(extractEvidenceRequests("Just some prose with no tables.")).toEqual([]);
  });

  it("strips markdown formatting from extracted cells", () => {
    const output = `
| # | Requirement | Rule Reference | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | **Bold title** | *italic rule* | MISSING | \`code notes\` |
`;
    const requests = extractEvidenceRequests(output);
    expect(requests[0]!.title).toBe("Bold title");
    expect(requests[0]!.source).toBe("italic rule");
    expect(requests[0]!.description).toBe("code notes");
  });

  it("tolerates the BOLDED **MISSING** variant commonly produced by LLMs", () => {
    const output = `
| # | Requirement | Rule Reference | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Thing | Rule X | **MISSING** | Need this |
`;
    const requests = extractEvidenceRequests(output);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.title).toBe("Thing");
  });

  it("strips embedded [cN] citation markers from checklist cells", () => {
    // Real output from the om-reviewer persona embeds [c1], [c2], etc. in
    // each cell to resolve the prose-level citations to the right rule.
    // Those markers are noise inside an evidence-request title/description
    // and would confuse a reviewer scanning the queue.
    const output = `
| # | Requirement | Rule Reference | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Cover-page essentials [c1] | NI 45-106 Form F2 Item 1; CSA SN 45-318 [c2][c4] | MISSING | The OM gives only a placeholder statement [c1]. |
| 2 | Rights of action [c3] | OSC Rule 45-501 s. 5.2 [c7] | PARTIAL | Ontario rights language present but incomplete [c8]. |
`;
    const requests = extractEvidenceRequests(output);
    expect(requests).toHaveLength(2);
    // Titles: no [cN] residue, whitespace collapsed.
    expect(requests[0]!.title).toBe("Cover-page essentials");
    expect(requests[1]!.title).toBe("Rights of action");
    // Sources: no [cN] residue.
    expect(requests[0]!.source).toBe("NI 45-106 Form F2 Item 1; CSA SN 45-318");
    expect(requests[1]!.source).toBe("OSC Rule 45-501 s. 5.2");
    // Notes/descriptions: no [cN] residue.
    expect(requests[0]!.description).toBe("The OM gives only a placeholder statement.");
    expect(requests[1]!.description).toBe("Ontario rights language present but incomplete.");
  });

  it("skips N/A rows (not applicable given matter facts)", () => {
    // The om-reviewer persona emits N/A for rows that don't apply to the
    // specific matter (e.g. EMD-specific disclosure on a non-EMD deal).
    // Those aren't evidence gaps; they shouldn't create queue items.
    const output = `
| # | Requirement | Rule Reference | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | EMD RDI | NI 31-103 s. 13.13 | N/A | No EMD involved |
| 2 | Risk factors | NI 45-106 s. 2.9 | MISSING | Not disclosed |
`;
    const requests = extractEvidenceRequests(output);
    expect(requests).toHaveLength(1);
    expect(requests[0]!.title).toBe("Risk factors");
  });
});
