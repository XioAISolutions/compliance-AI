"use client";

/**
 * Evidence graph view — Sigma.js canvas + 360° context rail.
 *
 * Cannibalized from GitNexus: graph is a first-class citizen, not a supplement.
 * Force-atlas2 layout, colored-by-kind, searchable, with a right-rail
 * context panel that shows incoming/outgoing/metadata for the selected node.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type Sigma from "sigma";
import { buildEvidenceGraph, context360, type EvidenceGraph } from "../../../lib/evidence-graph";
import type { TranscriptTurn } from "@compliance-ai/chat-structure";
import { ContextPanel } from "./ContextPanel";

interface MatterLite {
  id: string;
  title: string;
  status?: string;
}
interface DocumentLite {
  id: string;
  filename: string;
  documentType: string;
}
interface AuthorityLite {
  id: string;
  title: string;
  source?: string;
}

interface Props {
  matter: MatterLite;
  documents: DocumentLite[];
  authorities: AuthorityLite[];
  transcript: TranscriptTurn[];
}

export function GraphView({ matter, documents, authorities, transcript }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const graph: EvidenceGraph = useMemo(
    () => buildEvidenceGraph({ matter, documents, authorities, transcript }),
    [matter, documents, authorities, transcript],
  );

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;
    let sigmaInstance: Sigma | null = null;

    (async () => {
      // Dynamic import — Sigma needs `window` which is only present client-side.
      const { default: SigmaCls } = await import("sigma");
      if (cancelled) return;

      const g = new Graph({ multi: false });
      for (const node of graph.nodes) {
        g.addNode(node.id, {
          label: node.label,
          x: Math.random(),
          y: Math.random(),
          size: node.size,
          color: node.color,
        });
      }
      for (const edge of graph.edges) {
        if (!g.hasNode(edge.source) || !g.hasNode(edge.target)) continue;
        if (g.hasEdge(edge.source, edge.target)) continue;
        g.addEdgeWithKey(edge.id, edge.source, edge.target, {
          label: edge.kind,
          size: edge.kind === "grounds" ? 1 : 2,
        });
      }

      // Light force-atlas2 pass for a physics-ish layout.
      forceAtlas2.assign(g, {
        iterations: 100,
        settings: {
          gravity: 0.2,
          scalingRatio: 10,
          strongGravityMode: false,
          slowDown: 4,
        },
      });

      if (cancelled || !containerRef.current) return;

      sigmaInstance = new SigmaCls(g, containerRef.current, {
        renderLabels: true,
        labelSize: 12,
        labelDensity: 0.3,
        labelGridCellSize: 60,
      });
      sigmaRef.current = sigmaInstance;

      sigmaInstance.on("clickNode", ({ node }: { node: string }) => {
        setSelectedNode(node);
      });
      sigmaInstance.on("clickStage", () => {
        setSelectedNode(null);
      });
    })();

    return () => {
      cancelled = true;
      sigmaInstance?.kill();
      sigmaInstance = null;
      sigmaRef.current = null;
    };
  }, [graph]);

  // Highlight search matches.
  useEffect(() => {
    const s = sigmaRef.current;
    if (!s) return;
    const g = s.getGraph();
    const q = search.trim().toLowerCase();
    g.forEachNode((id, attrs) => {
      const match = q.length > 0 && String(attrs.label ?? "").toLowerCase().includes(q);
      g.setNodeAttribute(
        id,
        "highlighted",
        match,
      );
      if (q.length > 0) {
        g.setNodeAttribute(id, "zIndex", match ? 2 : 0);
      }
    });
    s.refresh();
  }, [search]);

  const context = selectedNode ? context360(graph, selectedNode) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <h2 className="text-sm font-semibold">Evidence graph</h2>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes…"
          className="flex-1 rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs focus:outline-none dark:border-neutral-700"
        />
        <span className="text-[10px] text-neutral-400">
          {graph.nodes.length} nodes · {graph.edges.length} edges
        </span>
      </div>
      <div className="flex flex-1 overflow-hidden pt-3">
        <div className="flex-1 overflow-hidden rounded-md bg-neutral-50 dark:bg-neutral-950">
          <div ref={containerRef} className="h-full w-full" />
        </div>
        {context && (
          <aside className="ml-4 w-72 shrink-0 overflow-y-auto border-l border-neutral-200 pl-4 dark:border-neutral-800">
            <ContextPanel context={context} />
          </aside>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-neutral-500">
        <LegendDot color="#0ea5e9" label="matter" />
        <LegendDot color="#6366f1" label="document" />
        <LegendDot color="#14b8a6" label="authority" />
        <LegendDot color="#f59e0b" label="citation" />
        <LegendDot color="#a855f7" label="agent turn" />
        <LegendDot color="#ef4444" label="gap" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
