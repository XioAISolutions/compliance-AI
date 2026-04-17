"use client";

/**
 * Output pane — the primary canvas. The deliverable is the hero.
 *
 * Renders the streaming output with structured citations as superscripts.
 * Shows the judge-loop verdict inline. Provides export controls.
 */

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CitedMarkdown } from "./CitedMarkdown";

interface Citation {
  id: string;
  authorityId: string;
  section: string;
  quote: string;
  docId: string;
  chunkId: string;
  page?: number;
}

type JudgeVerdict = "READY_TO_SUBMIT" | "ITERATE" | "REWRITE";

interface CitationRetryState {
  inFlight: boolean;
  reason: string | null;
  markerCount: number;
  priorValidCount: number;
}

interface CitationWarnings {
  orphanedMarkers: string[];
  unusedCitations: string[];
  droppedChunkIds: string[];
  afterRetry: boolean;
}

interface Props {
  content: string;
  citations: Citation[];
  verdict: JudgeVerdict | null;
  totalRounds: number | null;
  streaming: boolean;
  matterId: string;
  onOpenChat: () => void;
  onStartReview: () => void;
  onExported?: () => void;
  citationRetry?: CitationRetryState;
  citationWarnings?: CitationWarnings | null;
  /**
   * Judge's last-round rationale prose. Surfaced as an expandable panel
   * when the verdict isn't READY_TO_SUBMIT, so a compliance lawyer
   * landing on a `needs-revision` or `blocked` matter can read WHY the
   * judge rejected, not just the status chip.
   */
  verdictRationale?: string | null;
}

type ActiveTab = "output" | "transcript" | "graph";

interface TranscriptEvent {
  id: string;
  type: "audit" | "agent" | "tool" | "approval";
  actor: string;
  action: string;
  content: string;
  createdAt: string;
}

interface EvidenceGraphNode {
  id: string;
  type: "matter" | "document" | "chunk" | "authority" | "evidence" | "audit";
  label: string;
  detail?: string;
}

interface EvidenceGraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
}

const VERDICT_STYLES: Record<JudgeVerdict, { bg: string; label: string }> = {
  READY_TO_SUBMIT: {
    bg: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    label: "Ready to submit",
  },
  ITERATE: {
    bg: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    label: "Iterating",
  },
  REWRITE: {
    bg: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    label: "Rewriting",
  },
};

export function OutputPane({
  content,
  citations,
  verdict,
  totalRounds,
  streaming,
  matterId,
  onOpenChat,
  onStartReview,
  onExported,
  citationRetry,
  citationWarnings,
  verdictRationale,
}: Props) {
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("output");
  const [transcript, setTranscript] = useState<TranscriptEvent[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [graph, setGraph] = useState<{ nodes: EvidenceGraphNode[]; edges: EvidenceGraphEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [loadingGraph, setLoadingGraph] = useState(false);

  const displayContent = useMemo(() => stripCitationFence(content), [content]);

  useEffect(() => {
    if (activeTab !== "transcript" || loadingTranscript || transcript.length > 0) return;
    let cancelled = false;
    setLoadingTranscript(true);
    void fetch(`/api/matters/${matterId}/transcript`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { events?: TranscriptEvent[] } | null) => {
        if (!cancelled) setTranscript(body?.events ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoadingTranscript(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, loadingTranscript, matterId, transcript.length]);

  useEffect(() => {
    if (activeTab !== "graph" || loadingGraph || graph.nodes.length > 0) return;
    let cancelled = false;
    setLoadingGraph(true);
    void fetch(`/api/matters/${matterId}/graph`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { nodes?: EvidenceGraphNode[]; edges?: EvidenceGraphEdge[] } | null) => {
        if (!cancelled) setGraph({ nodes: body?.nodes ?? [], edges: body?.edges ?? [] });
      })
      .finally(() => {
        if (!cancelled) setLoadingGraph(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, graph.nodes.length, loadingGraph, matterId]);

  async function exportDocx() {
    if (exporting || !content) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/matters/${matterId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "docx", output: content, citations }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "compliance-review.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onExported?.();
    } catch (err) {
      // Fall back to markdown if export fails
      const msg = err instanceof Error ? err.message : String(err);
      console.error("DOCX export failed:", msg);
      const blob = new Blob([content], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "compliance-review.md";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function exportCrumbHandoff() {
    const res = await fetch(`/api/matters/${matterId}/handoff`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "compliance-handoff.crumb";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onExported?.();
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header with verdict and actions */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">Output</h2>
          {verdict && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${VERDICT_STYLES[verdict].bg}`}
            >
              {VERDICT_STYLES[verdict].label}
            </span>
          )}
          {totalRounds !== null && (
            <span className="text-xs text-neutral-400">
              {totalRounds} round{totalRounds === 1 ? "" : "s"}
            </span>
          )}
          {/* Citation integrity: if a retry is running right now, or warnings
              remain post-retry, name the state so the compliance lawyer can
              see "why the citations count changed". Silent rescue would
              repeat the original sin — shipping output without showing what
              shifted between what the model first wrote and what the audit
              actually records. */}
          {citationRetry?.inFlight && (
            <span
              className="flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950 dark:text-blue-300"
              title={
                citationRetry.reason
                  ? `Retry reason: ${citationRetry.reason}. Prior valid citations: ${citationRetry.priorValidCount}/${citationRetry.markerCount}.`
                  : undefined
              }
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-500" />
              Rescuing citations…
            </span>
          )}
          {!citationRetry?.inFlight && citationWarnings && (
            <span
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                citationWarnings.orphanedMarkers.length +
                  citationWarnings.droppedChunkIds.length ===
                0
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
              }`}
              title={[
                citationWarnings.afterRetry ? "(after retry)" : "",
                citationWarnings.orphanedMarkers.length > 0
                  ? `Orphan markers: ${citationWarnings.orphanedMarkers.map((m) => `[${m}]`).join(", ")}`
                  : "",
                citationWarnings.unusedCitations.length > 0
                  ? `Unused: ${citationWarnings.unusedCitations.join(", ")}`
                  : "",
                citationWarnings.droppedChunkIds.length > 0
                  ? `Dropped chunkIds: ${citationWarnings.droppedChunkIds.join(", ")}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              {citationWarnings.orphanedMarkers.length + citationWarnings.droppedChunkIds.length ===
              0
                ? citationWarnings.afterRetry
                  ? "Citations rescued"
                  : "Citations resolved"
                : `${citationWarnings.orphanedMarkers.length} orphan · ${citationWarnings.droppedChunkIds.length} dropped`}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onOpenChat}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Refine
          </button>
          <button
            onClick={exportDocx}
            disabled={!content || streaming || exporting}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {exporting ? "Exporting…" : "Export DOCX"}
          </button>
          <button
            onClick={() => void exportCrumbHandoff()}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Export handoff
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-1 border-b border-neutral-200 pb-3 text-xs dark:border-neutral-800">
        <TabButton active={activeTab === "output"} onClick={() => setActiveTab("output")}>
          Output
        </TabButton>
        <TabButton active={activeTab === "transcript"} onClick={() => setActiveTab("transcript")}>
          Transcript
        </TabButton>
        <TabButton active={activeTab === "graph"} onClick={() => setActiveTab("graph")}>
          Graph
        </TabButton>
      </div>

      {/* Main output area */}
      <div className="flex-1 overflow-y-auto pt-4">
        {activeTab === "output" && !content && !streaming && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-neutral-400">
              Upload a document and start a review to see the output here.
            </p>
            <button
              onClick={onStartReview}
              className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 dark:bg-neutral-100 dark:text-neutral-900"
            >
              Start review
            </button>
          </div>
        )}
        {activeTab === "output" && (content || streaming) && (
          <>
            <CitedMarkdown
              content={displayContent}
              citations={citations}
              hoveredCitation={hoveredCitation}
              onHoverCitation={setHoveredCitation}
            />
            {streaming && (
              <span className="mt-1 inline-block h-4 w-1 animate-pulse bg-neutral-400" />
            )}
          </>
        )}
        {activeTab === "transcript" && (
          <TranscriptPanel events={transcript} loading={loadingTranscript} matterId={matterId} />
        )}
        {activeTab === "graph" && <GraphPanel graph={graph} loading={loadingGraph} />}
      </div>

      {/* Judge's rationale when verdict isn't READY — why the matter is
          at needs-revision / blocked. Details disclosure so the prose
          doesn't dominate the output pane unless the user opens it. */}
      {activeTab === "output" && verdictRationale && verdict && verdict !== "READY_TO_SUBMIT" && (
        <details className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs dark:border-amber-900 dark:bg-amber-950/40">
          <summary className="cursor-pointer font-medium text-amber-800 dark:text-amber-300">
            Judge&apos;s notes — why this matter is at{" "}
            {verdict === "REWRITE" ? "blocked" : "needs-revision"}
          </summary>
          <div className="mt-2 whitespace-pre-wrap text-amber-900 dark:text-amber-100">
            {verdictRationale}
          </div>
        </details>
      )}

      {/* Citations footnotes */}
      {activeTab === "output" && citations.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <h3 className="text-xs font-semibold text-neutral-400">Citations ({citations.length})</h3>
          <ol className="mt-2 space-y-1.5">
            {citations.map((c) => (
              <li
                key={c.id}
                id={`citation-${c.id}`}
                className={`rounded-md p-2 text-xs transition-colors ${
                  hoveredCitation === c.id
                    ? "bg-amber-50 dark:bg-amber-950/30"
                    : "bg-neutral-50 dark:bg-neutral-900"
                }`}
                onMouseEnter={() => setHoveredCitation(c.id)}
                onMouseLeave={() => setHoveredCitation(null)}
              >
                <span className="font-mono font-semibold text-amber-600">[{c.id}]</span>{" "}
                <span className="font-medium">
                  {c.authorityId} § {c.section}
                </span>
                <p className="mt-0.5 italic text-neutral-500">&ldquo;{c.quote}&rdquo;</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function stripCitationFence(value: string): string {
  return value.replace(/```citations\s*\n[\s\S]*?\n```/g, "").trim();
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 font-medium ${
        active
          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
          : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}

function TranscriptPanel({
  events,
  loading,
  matterId,
}: {
  events: TranscriptEvent[];
  loading: boolean;
  matterId: string;
}) {
  if (loading) return <p className="text-sm text-neutral-400">Loading transcript…</p>;
  if (events.length === 0) {
    return <p className="text-sm text-neutral-400">No transcript events recorded yet.</p>;
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Matter transcript</h3>
        <a
          href={`/api/matters/${matterId}/transcript?fmt=jsonl`}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Download JSONL
        </a>
      </div>
      <ol className="space-y-2">
        {events.map((event) => (
          <li key={event.id} className="border-l-2 border-neutral-200 pl-3 dark:border-neutral-800">
            <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {event.actor}
              </span>
              <span>{event.action}</span>
              <span>{new Date(event.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {event.content}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function GraphPanel({
  graph,
  loading,
}: {
  graph: { nodes: EvidenceGraphNode[]; edges: EvidenceGraphEdge[] };
  loading: boolean;
}) {
  if (loading) return <p className="text-sm text-neutral-400">Loading evidence graph…</p>;
  if (graph.nodes.length === 0) {
    return <p className="text-sm text-neutral-400">No graph data recorded yet.</p>;
  }

  const visibleEdges = graph.edges.slice(0, 18);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="min-h-[360px] rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {graph.nodes.slice(0, 18).map((node) => (
            <div
              key={node.id}
              className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
            >
              <div className="text-[10px] font-semibold uppercase text-neutral-400">
                {node.type}
              </div>
              <div className="mt-1 line-clamp-2 text-sm font-medium">{node.label}</div>
              {node.detail && (
                <p className="mt-1 line-clamp-3 text-xs text-neutral-500">{node.detail}</p>
              )}
            </div>
          ))}
        </div>
      </div>
      <aside className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <h3 className="text-sm font-semibold">Edges</h3>
        <ul className="mt-3 space-y-2 text-xs text-neutral-500">
          {visibleEdges.map((edge) => (
            <li key={edge.id}>
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {edge.label}
              </span>{" "}
              {edge.source.slice(0, 10)} → {edge.target.slice(0, 10)}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
