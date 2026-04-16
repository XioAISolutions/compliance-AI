import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { InMemoryAuditStore, setAuditStore, sha256 } from "../audit-store";
import { InMemoryEvidenceStore, setEvidenceStore } from "../evidence-store";
import { InMemoryMatterStore, setMatterStore } from "../matter-store";
import {
  buildEvidenceGraph,
  buildMatterContextBundle,
  buildTranscriptEvents,
  renderCrumbHandoff,
} from "../matter-context";

describe("matter-context", () => {
  let matters: InMemoryMatterStore;
  let audit: InMemoryAuditStore;
  let evidence: InMemoryEvidenceStore;

  beforeEach(() => {
    matters = new InMemoryMatterStore();
    audit = new InMemoryAuditStore();
    evidence = new InMemoryEvidenceStore();
    setMatterStore(matters);
    setAuditStore(audit);
    setEvidenceStore(evidence);
  });

  afterEach(() => {
    setMatterStore(null);
    setAuditStore(null);
    setEvidenceStore(null);
  });

  it("builds transcript, graph, and CRUMB handoff from matter state", async () => {
    const matter = await matters.create({
      title: "North Fund OM",
      jurisdiction: "ontario",
      registrationCategory: "emd",
      taskType: "om-review",
    });
    const doc = await matters.addDocument(matter.id, "north-fund.txt", "offering-memo");
    await matters.addChunks(matter.id, doc.id, [
      {
        id: "chunk-1",
        docId: doc.id,
        ordinal: 0,
        content: "Offering memorandum disclosure.",
        charStart: 0,
        charEnd: 32,
        tokenCount: 4,
      },
    ]);
    await evidence.create({
      matterId: matter.id,
      title: "Rights of action disclosure",
      description: "Confirm disclosure is present.",
      status: "missing",
    });
    await audit.append(matter.id, {
      matterId: matter.id,
      organizationId: matter.organizationId,
      actor: "om-reviewer",
      action: "generation",
      inputHash: sha256("input"),
      authoritiesUsed: ["ni-45-106"],
      outputHash: sha256("output"),
      judgeVerdict: "ITERATE",
      inputContent: "Review",
      outputContent: "Draft output with citation [c1]",
    });

    const transcript = await buildTranscriptEvents(matter.id);
    expect(transcript).toHaveLength(1);
    expect(transcript[0]!.type).toBe("agent");

    const graph = await buildEvidenceGraph(matter.id);
    expect(graph.nodes.some((node) => node.type === "authority")).toBe(true);
    expect(graph.edges.some((edge) => edge.label === "cites")).toBe(true);

    const bundle = await buildMatterContextBundle(matter.id);
    expect(bundle?.version).toBe("demo-case-pack/v1");
    expect(renderCrumbHandoff(bundle!)).toContain("[handoff]");
  });
});
