import { describe, it, expect } from "vitest";
import { buildEvidenceGraph, context360 } from "../evidence-graph";
import type { TranscriptTurn } from "@compliance-ai/chat-structure";

function makeTurn(overrides: Partial<TranscriptTurn>): TranscriptTurn {
  return {
    id: "t1",
    matterId: "m1",
    seq: 1,
    createdAt: new Date().toISOString(),
    from: "om-reviewer",
    content: "draft",
    kind: "agent-draft",
    round: 1,
    ...overrides,
  };
}

describe("buildEvidenceGraph", () => {
  it("creates a matter node + contains edges for each document", () => {
    const graph = buildEvidenceGraph({
      matter: { id: "m1", title: "Ontario EMD OM review" },
      documents: [
        { id: "d1", filename: "om.pdf", documentType: "offering-memo" },
        { id: "d2", filename: "kyc.pdf", documentType: "kyc-aml-file" },
      ],
      authorities: [],
      transcript: [],
    });

    expect(graph.nodes.find((n) => n.id === "matter:m1")).toBeDefined();
    expect(graph.nodes.find((n) => n.id === "doc:d1")).toBeDefined();
    expect(graph.nodes.find((n) => n.id === "doc:d2")).toBeDefined();
    const containsEdges = graph.edges.filter((e) => e.kind === "contains");
    expect(containsEdges).toHaveLength(2);
  });

  it("creates authority nodes but no default edges to them", () => {
    const graph = buildEvidenceGraph({
      matter: { id: "m1", title: "T" },
      documents: [],
      authorities: [{ id: "ni-45-106", title: "NI 45-106" }],
      transcript: [],
    });
    expect(graph.nodes.find((n) => n.id === "auth:ni-45-106")).toBeDefined();
  });

  it("creates citation + grounds + cites edges from cite_authority tool calls", () => {
    const cite = {
      id: "tc1",
      tool: "cite_authority" as const,
      args: {
        id: "c1",
        authorityId: "ni-45-106",
        section: "2.9(2)(a)",
        quote: "…rights of action…",
        docId: "om.pdf",
        chunkId: "chunk-7",
      },
    };
    const graph = buildEvidenceGraph({
      matter: { id: "m1", title: "T" },
      documents: [],
      authorities: [{ id: "ni-45-106", title: "NI 45-106" }],
      transcript: [makeTurn({ id: "t1", toolCalls: [cite] })],
    });

    const citation = graph.nodes.find((n) => n.kind === "citation");
    expect(citation).toBeDefined();
    expect(citation!.label).toContain("ni-45-106");
    expect(citation!.label).toContain("2.9(2)(a)");

    expect(
      graph.edges.some((e) => e.kind === "grounds" && e.source === "turn:t1" && e.target === "cite:c1"),
    ).toBe(true);
    expect(
      graph.edges.some((e) => e.kind === "cites" && e.source === "cite:c1" && e.target === "auth:ni-45-106"),
    ).toBe(true);
  });

  it("creates gap nodes from flag_gap tool calls with flag edges", () => {
    const flag = {
      id: "tc2",
      tool: "flag_gap" as const,
      args: {
        severity: "high",
        title: "Missing rights of action",
        description: "…",
        authorityId: "ni-45-106",
      },
    };
    const graph = buildEvidenceGraph({
      matter: { id: "m1", title: "T" },
      documents: [],
      authorities: [{ id: "ni-45-106", title: "NI 45-106" }],
      transcript: [makeTurn({ id: "t1", toolCalls: [flag] })],
    });

    const gap = graph.nodes.find((n) => n.kind === "gap");
    expect(gap).toBeDefined();
    expect(gap!.label).toContain("Missing rights of action");

    expect(
      graph.edges.some((e) => e.kind === "flags" && e.source === "turn:t1"),
    ).toBe(true);
    expect(
      graph.edges.some((e) => e.kind === "flags" && e.target === "auth:ni-45-106"),
    ).toBe(true);
  });

  it("creates replies edges when a turn has a replyTo", () => {
    const graph = buildEvidenceGraph({
      matter: { id: "m1", title: "T" },
      documents: [],
      authorities: [],
      transcript: [
        makeTurn({ id: "t1", kind: "agent-draft" }),
        makeTurn({
          id: "t2",
          from: "judge",
          kind: "judge-verdict",
          replyTo: "t1",
          verdict: "ITERATE",
        }),
      ],
    });
    expect(
      graph.edges.some((e) => e.kind === "replies" && e.source === "turn:t1" && e.target === "turn:t2"),
    ).toBe(true);
  });

  it("skips user-message turns in the turn graph", () => {
    const graph = buildEvidenceGraph({
      matter: { id: "m1", title: "T" },
      documents: [],
      authorities: [],
      transcript: [
        makeTurn({ id: "u1", from: "user", kind: "user-message", content: "hi" }),
      ],
    });
    expect(graph.nodes.find((n) => n.id === "turn:u1")).toBeUndefined();
  });

  it("dedupes citation nodes when two turns cite the same chunk", () => {
    const mkCite = (turnId: string) => ({
      id: `tc-${turnId}`,
      tool: "cite_authority" as const,
      args: {
        id: "c1",
        authorityId: "ni-45-106",
        section: "2.9",
        quote: "q",
        docId: "d",
        chunkId: "chunk-7",
      },
    });
    const graph = buildEvidenceGraph({
      matter: { id: "m1", title: "T" },
      documents: [],
      authorities: [{ id: "ni-45-106", title: "NI 45-106" }],
      transcript: [
        makeTurn({ id: "t1", toolCalls: [mkCite("t1")] }),
        makeTurn({ id: "t2", toolCalls: [mkCite("t2")] }),
      ],
    });
    const citations = graph.nodes.filter((n) => n.kind === "citation");
    expect(citations).toHaveLength(1);
    const grounds = graph.edges.filter((e) => e.kind === "grounds");
    expect(grounds).toHaveLength(2);
  });
});

describe("context360", () => {
  it("returns null for unknown node", () => {
    const graph = buildEvidenceGraph({
      matter: { id: "m1", title: "T" },
      documents: [],
      authorities: [],
      transcript: [],
    });
    expect(context360(graph, "no-such-id")).toBeNull();
  });

  it("splits edges into incoming + outgoing correctly", () => {
    const graph = buildEvidenceGraph({
      matter: { id: "m1", title: "T" },
      documents: [{ id: "d1", filename: "f.pdf", documentType: "offering-memo" }],
      authorities: [],
      transcript: [],
    });
    const ctx = context360(graph, "doc:d1");
    expect(ctx).not.toBeNull();
    // Document has an incoming "contains" edge from the matter.
    expect(ctx!.incoming).toHaveLength(1);
    expect(ctx!.incoming[0]!.edge.kind).toBe("contains");
    expect(ctx!.incoming[0]!.other.id).toBe("matter:m1");
    expect(ctx!.outgoing).toHaveLength(0);
  });
});
