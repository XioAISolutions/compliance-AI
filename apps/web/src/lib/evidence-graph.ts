/**
 * Evidence graph builder.
 *
 * Cannibalized from [abhigyanpatwari/GitNexus](https://github.com/abhigyanpatwari/GitNexus) — same graph-as-first-class-citizen
 * arrangement, adapted to compliance artifacts. Nodes are matters, documents,
 * chunks, authorities, agent turns, citations, gaps. Edges capture the
 * "this quote came from that chunk; this gap addresses that authority;
 * this turn grounded on that snippet" relationships.
 *
 * The builder is pure (no I/O): it takes a matter + its documents +
 * retrieved authorities + transcript + citation map and returns a
 * `{ nodes, edges }` payload Sigma.js can render directly.
 */

import type { TranscriptTurn, ToolCallRecord, CiteAuthorityArgs } from "@compliance-ai/chat-structure";

export type GraphNodeKind =
  | "matter"
  | "document"
  | "authority"
  | "citation"
  | "agent-turn"
  | "gap";

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  /** Optional secondary text (e.g. an authority section, or a verdict). */
  detail?: string;
  /** Color token mapped by the UI layer to tailwind classes. */
  color: string;
  /** Physical layout size hint for sigma. */
  size: number;
  /** Free-form metadata for the 360° context panel. */
  metadata?: Record<string, unknown>;
}

export type GraphEdgeKind = "contains" | "cites" | "grounds" | "flags" | "replies";

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: GraphEdgeKind;
  label?: string;
}

export interface EvidenceGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface EvidenceGraphInput {
  matter: { id: string; title: string; status?: string };
  documents: Array<{ id: string; filename: string; documentType: string }>;
  authorities: Array<{ id: string; title: string; source?: string }>;
  transcript: TranscriptTurn[];
}

const NODE_COLOR: Record<GraphNodeKind, string> = {
  matter: "#0ea5e9",     // sky-500
  document: "#6366f1",   // indigo-500
  authority: "#14b8a6",  // teal-500
  citation: "#f59e0b",   // amber-500
  "agent-turn": "#a855f7", // purple-500
  gap: "#ef4444",        // red-500
};

const NODE_SIZE: Record<GraphNodeKind, number> = {
  matter: 18,
  document: 12,
  authority: 14,
  citation: 7,
  "agent-turn": 10,
  gap: 10,
};

function isCiteCall(tc: ToolCallRecord): tc is ToolCallRecord & { args: CiteAuthorityArgs } {
  return tc.tool === "cite_authority";
}

export function buildEvidenceGraph(input: EvidenceGraphInput): EvidenceGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // --- Matter node ------------------------------------------------------
  nodes.push({
    id: `matter:${input.matter.id}`,
    kind: "matter",
    label: input.matter.title,
    detail: input.matter.status,
    color: NODE_COLOR.matter,
    size: NODE_SIZE.matter,
    metadata: { status: input.matter.status },
  });

  // --- Document nodes ---------------------------------------------------
  for (const doc of input.documents) {
    nodes.push({
      id: `doc:${doc.id}`,
      kind: "document",
      label: doc.filename,
      detail: doc.documentType,
      color: NODE_COLOR.document,
      size: NODE_SIZE.document,
      metadata: { documentType: doc.documentType },
    });
    edges.push({
      id: `e:${input.matter.id}-contains-${doc.id}`,
      source: `matter:${input.matter.id}`,
      target: `doc:${doc.id}`,
      kind: "contains",
    });
  }

  // --- Authority nodes --------------------------------------------------
  for (const auth of input.authorities) {
    nodes.push({
      id: `auth:${auth.id}`,
      kind: "authority",
      label: auth.title,
      detail: auth.source,
      color: NODE_COLOR.authority,
      size: NODE_SIZE.authority,
      metadata: { source: auth.source },
    });
  }

  // --- Agent turn + citation + gap nodes from the transcript -----------
  // Dedupe citations so multiple turns quoting the same authority chunk
  // collapse to a single citation node.
  const seenCitations = new Set<string>();

  for (const turn of input.transcript) {
    if (turn.kind === "user-message") continue;

    const turnNodeId = `turn:${turn.id}`;
    nodes.push({
      id: turnNodeId,
      kind: "agent-turn",
      label: `${turn.from} · R${turn.round ?? "—"}`,
      detail: turn.verdict ?? turn.kind,
      color: NODE_COLOR["agent-turn"],
      size: NODE_SIZE["agent-turn"],
      metadata: {
        persona: turn.from,
        round: turn.round,
        verdict: turn.verdict,
        content: turn.content.slice(0, 240),
      },
    });

    // Reply threading → `replies` edges
    if (turn.replyTo) {
      edges.push({
        id: `e:reply:${turn.id}`,
        source: `turn:${turn.replyTo}`,
        target: turnNodeId,
        kind: "replies",
      });
    }

    // Tool calls → citations + gaps
    for (const tc of turn.toolCalls ?? []) {
      if (isCiteCall(tc)) {
        const cid = `cite:${tc.args.id}`;
        if (!seenCitations.has(cid)) {
          seenCitations.add(cid);
          nodes.push({
            id: cid,
            kind: "citation",
            label: `${tc.args.authorityId} § ${tc.args.section}`,
            detail: tc.args.quote,
            color: NODE_COLOR.citation,
            size: NODE_SIZE.citation,
            metadata: { ...tc.args },
          });
          // Citation → Authority edge (if we have the authority)
          if (input.authorities.some((a) => a.id === tc.args.authorityId)) {
            edges.push({
              id: `e:cites:${tc.args.id}`,
              source: cid,
              target: `auth:${tc.args.authorityId}`,
              kind: "cites",
            });
          }
        }
        edges.push({
          id: `e:grounds:${turn.id}-${tc.args.id}`,
          source: turnNodeId,
          target: cid,
          kind: "grounds",
        });
      } else if (tc.tool === "flag_gap") {
        const gid = `gap:${tc.id}`;
        nodes.push({
          id: gid,
          kind: "gap",
          label:
            (tc.args as { title?: string }).title ??
            (tc.args as { description?: string }).description ??
            "Gap",
          detail: (tc.args as { severity?: string }).severity,
          color: NODE_COLOR.gap,
          size: NODE_SIZE.gap,
          metadata: { ...tc.args },
        });
        edges.push({
          id: `e:flag:${turn.id}-${tc.id}`,
          source: turnNodeId,
          target: gid,
          kind: "flags",
        });
        const gapAuth = (tc.args as { authorityId?: string }).authorityId;
        if (gapAuth && input.authorities.some((a) => a.id === gapAuth)) {
          edges.push({
            id: `e:flag-auth:${tc.id}`,
            source: gid,
            target: `auth:${gapAuth}`,
            kind: "flags",
          });
        }
      }
    }
  }

  return { nodes, edges };
}

/**
 * Compute 360° context for a node: incoming edges, outgoing edges, and the
 * node's own metadata. Used by the GraphView's right-rail context panel.
 */
export function context360(graph: EvidenceGraph, nodeId: string) {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const incoming: { edge: GraphEdge; other: GraphNode }[] = [];
  const outgoing: { edge: GraphEdge; other: GraphNode }[] = [];

  for (const edge of graph.edges) {
    if (edge.target === nodeId) {
      const other = graph.nodes.find((n) => n.id === edge.source);
      if (other) incoming.push({ edge, other });
    } else if (edge.source === nodeId) {
      const other = graph.nodes.find((n) => n.id === edge.target);
      if (other) outgoing.push({ edge, other });
    }
  }

  return { node, incoming, outgoing };
}
