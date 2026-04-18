import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryMatterStore } from "../matter-store";

describe("Consumer-law matter fields", () => {
  let store: InMemoryMatterStore;

  beforeEach(() => {
    store = new InMemoryMatterStore();
  });

  it("creates a consumer-law matter with all fields", async () => {
    const matter = await store.create({
      title: "Doe v. Acme Corp (defective product)",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      clientName: "Jane Doe",
      opposingParty: "Acme Corp",
      courtLevel: "superior",
      legalRegime: ["cpa-ontario"],
      claimType: "defective-product",
      classActionFlag: true,
      estimatedClassSize: "5,000–10,000",
      harmDescription: "Physical injury from defective appliance",
      proceduralPosture: "investigation",
      limitationDate: new Date("2027-06-15"),
      nextDeadline: new Date("2026-09-01"),
      nextDeadlineLabel: "File statement of claim",
    });

    expect(matter.clientName).toBe("Jane Doe");
    expect(matter.opposingParty).toBe("Acme Corp");
    expect(matter.courtLevel).toBe("superior");
    expect(matter.legalRegime).toEqual(["cpa-ontario"]);
    expect(matter.claimType).toBe("defective-product");
    expect(matter.classActionFlag).toBe(true);
    expect(matter.estimatedClassSize).toBe("5,000–10,000");
    expect(matter.proceduralPosture).toBe("investigation");
    expect(matter.limitationDate).toEqual(new Date("2027-06-15"));
    expect(matter.nextDeadlineLabel).toBe("File statement of claim");
  });

  it("creates a securities matter without consumer fields (back-compat)", async () => {
    const matter = await store.create({
      title: "ABC Fund OM Review",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });

    expect(matter.clientName).toBeUndefined();
    expect(matter.claimType).toBeUndefined();
    expect(matter.classActionFlag).toBeUndefined();
    expect(matter.proceduralPosture).toBeUndefined();
    expect(matter.title).toBe("ABC Fund OM Review");
  });

  it("round-trips consumer fields through get()", async () => {
    const created = await store.create({
      title: "Test",
      jurisdiction: "quebec",
      registrationCategory: "none",
      taskType: "om-review",
      claimType: "hidden-fees",
      classActionFlag: false,
      proceduralPosture: "pre-litigation",
    });

    const retrieved = await store.get(created.id);
    expect(retrieved?.claimType).toBe("hidden-fees");
    expect(retrieved?.classActionFlag).toBe(false);
    expect(retrieved?.proceduralPosture).toBe("pre-litigation");
  });

  it("filters by claimType", async () => {
    await store.create({
      title: "A",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      claimType: "defective-product",
    });
    await store.create({
      title: "B",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      claimType: "data-breach",
    });

    const filtered = await store.list("preview", { claimType: "data-breach" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.title).toBe("B");
  });

  it("filters by proceduralPosture", async () => {
    await store.create({
      title: "Investigation matter",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      proceduralPosture: "investigation",
    });
    await store.create({
      title: "Certification matter",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      proceduralPosture: "certification",
    });

    const filtered = await store.list("preview", { proceduralPosture: "certification" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.title).toBe("Certification matter");
  });

  it("filters by classActionOnly", async () => {
    await store.create({
      title: "Class",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      classActionFlag: true,
    });
    await store.create({
      title: "Single",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      classActionFlag: false,
    });

    const filtered = await store.list("preview", { classActionOnly: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.title).toBe("Class");
  });

  it("searches across title, clientName, and opposingParty", async () => {
    await store.create({
      title: "Smith v. BigCo",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      clientName: "John Smith",
      opposingParty: "BigCo Inc.",
    });
    await store.create({
      title: "Other matter",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
    });

    expect(await store.list("preview", { search: "smith" })).toHaveLength(1);
    expect(await store.list("preview", { search: "BigCo" })).toHaveLength(1);
    expect(await store.list("preview", { search: "xyz" })).toHaveLength(0);
  });

  it("updates consumer-law fields via update()", async () => {
    const matter = await store.create({
      title: "Test",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      proceduralPosture: "investigation",
    });

    const updated = await store.update(matter.id, {
      proceduralPosture: "certification",
      clientName: "Updated Client",
    });

    expect(updated?.proceduralPosture).toBe("certification");
    expect(updated?.clientName).toBe("Updated Client");
    expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(matter.updatedAt.getTime());
  });

  it("filters by hasOverdueDeadline", async () => {
    const pastDate = new Date("2020-01-01");
    const futureDate = new Date("2030-01-01");

    await store.create({
      title: "Overdue",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      nextDeadline: pastDate,
    });
    await store.create({
      title: "Not overdue",
      jurisdiction: "ontario",
      registrationCategory: "none",
      taskType: "om-review",
      nextDeadline: futureDate,
    });

    const filtered = await store.list("preview", { hasOverdueDeadline: true });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.title).toBe("Overdue");
  });
});
