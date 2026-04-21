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
import { RedlinePreview, looksLikeRedline } from "./RedlinePreview";
import { CompareToggle } from "./CompareToggle";

interface Citation {
  id: string;
  authorityId: string;
  section: string;
  quote: string;
  docId: string;
  chunkId: string;
  page?: number;
  /** Source-locker fields — see packages/agents/src/citations.ts. */
  jurisdiction?: string;
  sourceType?: string;
  authorityDate?: string;
  pinpoint?: string;
  confidence?: number;
  /** Privilege classification — drives the PRIV badge in the
   * footnote list + the export-time redaction. See
   * apps/web/src/lib/privilege.ts. */
  privilege?: string;
}

/** Per-citation verification result — mirrors the cognition package type. */
interface VerificationResult {
  citationId: string;
  status: "verified" | "candidate-url" | "unsupported" | "not-found" | "error";
  method: "offline-corpus" | "canlii-url-heuristic" | "canlii-live" | "none";
  reason: string;
  confidence: number;
  evidence?: {
    url?: string;
    matchedAuthorityId?: string;
    matchedTitle?: string;
    matchedJurisdiction?: string;
  };
  verifiedAt: string;
}

interface VerificationSummary {
  total: number;
  verified: number;
  candidateUrl: number;
  unsupported: number;
  notFound: number;
  error: number;
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
   * Auto-verify results streamed from the server immediately after
   * citations land. When present, the OutputPane seeds its local
   * verifications map so the footnote list renders colour-coded
   * badges on first paint — no "Verify citations" click required.
   */
  initialVerifications?: VerificationResult[];
  /**
   * Judge's last-round rationale prose. Surfaced as an expandable panel
   * when the verdict isn't READY_TO_SUBMIT, so a compliance lawyer
   * landing on a `needs-revision` or `blocked` matter can read WHY the
   * judge rejected, not just the status chip.
   */
  verdictRationale?: string | null;
  /**
   * Current matter status. Drives whether the "Retry with deeper
   * rounds" action is offered — only meaningful when the matter lands
   * at needs-revision (the judge had substantive ITERATE feedback and
   * ran out of rounds) or blocked (REWRITE — extra rounds might break
   * through, though for blocked cases the lawyer usually wants to
   * rewrite the subject document first).
   */
  matterStatus?: string | null;
  /**
   * Called with maxRounds=6 to re-run the review with a deeper judge
   * loop, giving the drafter more passes to address accumulated
   * critiques before hitting the cap.
   */
  onRetryDeeper?: () => void;
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
  matterStatus,
  onRetryDeeper,
  initialVerifications,
}: Props) {
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  /**
   * Per-citation verification results, keyed by citation id. Empty until
   * the user hits "Verify citations"; rendered as badges next to each
   * citation in the footnote list. The CanLII-verifier result is
   * advisory — counsel still signs off — but it collapses the "open
   * three tabs, search, paste, verify" flow to a single click per
   * citation.
   */
  const [verifications, setVerifications] = useState<Record<string, VerificationResult>>(() => {
    const seeded: Record<string, VerificationResult> = {};
    for (const r of initialVerifications ?? []) seeded[r.citationId] = r;
    return seeded;
  });
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Stream-driven prop updates: when the server emits new
  // `verifications` frames (e.g., on a re-review), the parent passes a
  // fresh array and we rebuild the map. A useEffect keeps local state in
  // sync instead of stale-prop trapping the user on an earlier run.
  useEffect(() => {
    if (!initialVerifications) return;
    const next: Record<string, VerificationResult> = {};
    for (const r of initialVerifications) next[r.citationId] = r;
    setVerifications(next);
  }, [initialVerifications]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("output");
  const [transcript, setTranscript] = useState<TranscriptEvent[]>([]);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [graph, setGraph] = useState<{ nodes: EvidenceGraphNode[]; edges: EvidenceGraphEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [loadingGraph, setLoadingGraph] = useState(false);
  const [outputHash, setOutputHash] = useState<string | null>(null);
  const [approvalRequested, setApprovalRequested] = useState(false);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);

  const displayContent = useMemo(() => stripCitationFence(content), [content]);

  // If the reviewer flipped to Transcript or Graph and then the matter
  // was reset to an empty state, the tab row hides — snap back to Output
  // so the placeholder is what shows, not a stale secondary panel.
  useEffect(() => {
    if (!content && !streaming && activeTab !== "output") setActiveTab("output");
  }, [content, streaming, activeTab]);

  // Hash the current output so we can both send it on POST and compare
  // against any existing pending approval tied to the same bytes — if the
  // reviewer retries and regenerates, the hash shifts and the button
  // resets so stale approvals don't look current.
  useEffect(() => {
    if (!content || streaming) {
      setOutputHash(null);
      return;
    }
    let cancelled = false;
    void sha256Hex(content).then((hash) => {
      if (!cancelled) setOutputHash(hash);
    });
    return () => {
      cancelled = true;
    };
  }, [content, streaming]);

  // On mount (and whenever the hash changes) check whether this exact
  // output already has a pending approval so a refresh keeps showing
  // "Approval requested" instead of inviting a duplicate submission.
  useEffect(() => {
    if (verdict !== "READY_TO_SUBMIT" || !outputHash) {
      setApprovalRequested(false);
      return;
    }
    let cancelled = false;
    void fetch(`/api/approvals?matterId=${matterId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((items: Array<{ id: string; status: string; outputHash: string }> | null) => {
        if (cancelled || !Array.isArray(items)) return;
        const match = items.find((i) => i.status === "requested" && i.outputHash === outputHash);
        setApprovalRequested(Boolean(match));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [matterId, outputHash, verdict]);

  async function requestApproval() {
    if (requestingApproval || approvalRequested || !outputHash || !content) return;
    setRequestingApproval(true);
    setApprovalError(null);
    try {
      const summary = deriveApprovalSummary(displayContent) || `Matter ${matterId.slice(0, 8)}`;
      const res = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matterId, outputHash, summary }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setApprovalRequested(true);
    } catch (err) {
      setApprovalError(err instanceof Error ? err.message : String(err));
    } finally {
      setRequestingApproval(false);
    }
  }

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

  async function verifyCitations() {
    if (verifying || citations.length === 0) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const res = await fetch(`/api/citations/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matterId, citations }),
      });
      if (!res.ok) {
        let serverMsg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) serverMsg = `${serverMsg} — ${body.error}`;
        } catch {
          /* non-JSON */
        }
        throw new Error(serverMsg);
      }
      const body = (await res.json()) as {
        summary: VerificationSummary;
        results: VerificationResult[];
      };
      const next: Record<string, VerificationResult> = {};
      for (const r of body.results) next[r.citationId] = r;
      setVerifications(next);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : String(err));
    } finally {
      setVerifying(false);
    }
  }

  const verifySummary = useMemo((): VerificationSummary => {
    const s: VerificationSummary = {
      total: 0,
      verified: 0,
      candidateUrl: 0,
      unsupported: 0,
      notFound: 0,
      error: 0,
    };
    for (const r of Object.values(verifications)) {
      s.total += 1;
      switch (r.status) {
        case "verified":
          s.verified += 1;
          break;
        case "candidate-url":
          s.candidateUrl += 1;
          break;
        case "unsupported":
          s.unsupported += 1;
          break;
        case "not-found":
          s.notFound += 1;
          break;
        case "error":
          s.error += 1;
          break;
      }
    }
    return s;
  }, [verifications]);

  async function exportDocx() {
    if (exporting || !content) return;
    setExporting(true);
    setExportError(null);
    try {
      const res = await fetch(`/api/matters/${matterId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "docx", output: content, citations }),
      });
      if (!res.ok) {
        // Pull the server-side error message if it's JSON; otherwise show
        // the status text so the user has something actionable.
        let serverMsg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          // Hard-signoff gate: surface the human-readable message, not the
          // "approval-required" error code, so the user understands what
          // to do next ("request approval, wait for approver, then export").
          if (res.status === 403 && body?.error === "approval-required") {
            serverMsg =
              body.message ??
              "Export blocked: this output must be approved by a reviewer before it can leave the workbench.";
          } else if (body?.error) {
            serverMsg = `${serverMsg} — ${body.error}`;
          }
        } catch {
          // Response wasn't JSON (e.g., partial DOCX bytes). Leave the
          // HTTP status as the message.
        }
        throw new Error(serverMsg);
      }
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
      // No silent fallback — the previous implementation quietly downloaded
      // the raw markdown as .md when DOCX generation failed, which hid the
      // real bug from users who only saw an unexpected file type. Surface
      // the error so the user can report it and we can fix the underlying
      // DOCX path.
      const msg = err instanceof Error ? err.message : String(err);
      console.error("DOCX export failed:", msg);
      setExportError(msg);
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
          {verdict === "READY_TO_SUBMIT" && content && !streaming && (
            <button
              onClick={() => void requestApproval()}
              disabled={requestingApproval || approvalRequested || !outputHash}
              title={approvalError ?? undefined}
              className={
                approvalRequested
                  ? "rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300"
                  : "rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-40"
              }
            >
              {approvalRequested
                ? "Approval requested"
                : requestingApproval
                  ? "Requesting…"
                  : "Request approval"}
            </button>
          )}
          <button
            onClick={onOpenChat}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Refine
          </button>
          {citations.length > 0 && !streaming && (
            <button
              onClick={() => void verifyCitations()}
              disabled={verifying}
              title="Check every citation against the authority corpus and generate CanLII verification links."
              className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-800 hover:bg-blue-100 disabled:opacity-40 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
            >
              {verifying
                ? "Verifying…"
                : verifySummary.total > 0
                  ? `Re-verify (${verifySummary.verified}/${verifySummary.total} verified)`
                  : "Verify citations"}
            </button>
          )}
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
          <a
            href={`/api/matters/${matterId}/audit-export?format=docx`}
            title="Download a tamper-evident AI-use audit trail (every query / retrieval / generation / verdict / approval / export, with hash chain integrity verdict). Suitable for client transparency or a firm's annual AI-use audit."
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Audit trail
          </a>
        </div>
      </div>
      {exportError && (
        <div className="mt-2 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <span>
            <span className="font-medium">DOCX export failed.</span>{" "}
            {exportError}
          </span>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="shrink-0 text-red-700 underline underline-offset-2 hover:text-red-900 dark:text-red-300 dark:hover:text-red-100"
          >
            Dismiss
          </button>
        </div>
      )}
      {verifyError && (
        <div className="mt-2 flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <span>
            <span className="font-medium">Citation verification failed.</span>{" "}
            {verifyError}
          </span>
          <button
            type="button"
            onClick={() => setVerifyError(null)}
            className="shrink-0 text-amber-700 underline underline-offset-2 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* What-to-do-next hint — adapts to the current matter state so a
          lawyer sees the single action that moves the matter forward,
          without having to remember the approval/export/verification
          contract. */}
      <NextStepHint
        streaming={streaming}
        hasContent={Boolean(content)}
        verdict={verdict}
        approvalRequested={approvalRequested}
        verifySummary={verifySummary}
        citationCount={citations.length}
      />

      {/* Transcript and graph are forensic views — only meaningful once a
          review has produced content. Keep the tab row collapsed until
          then so the first-time visitor sees subject doc → cited draft →
          judge note rather than three empty tabs. */}
      {(content || streaming) && (
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
      )}

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
            {/* Compare-to-prior-round toggle. Offered only when the
                matter has >=2 snapshots. Selecting a prior version
                swaps the output view for a word-level redline between
                that version and the current one. */}
            {!streaming && <CompareToggle matterId={matterId} currentContent={displayContent} />}
            {/* Redline mode: when the output carries the diff-token
                syntax the contract-redliner persona emits, render it
                with the visual track-change component instead of
                markdown. The detection is content-based (not
                taskType-based) so a refine via chat that produces
                redline tokens lights up here too. */}
            {looksLikeRedline(displayContent) ? (
              <RedlinePreview content={displayContent} />
            ) : (
              <CitedMarkdown
                content={displayContent}
                citations={citations}
                hoveredCitation={hoveredCitation}
                onHoverCitation={setHoveredCitation}
              />
            )}
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
          {/* Retry with more rounds — mostly useful for needs-revision.
              For blocked/REWRITE the judge said the approach is wrong,
              and more rounds usually just burn tokens against the same
              wall; the button is still offered for parity but the
              subtitle tells the lawyer what to expect. */}
          {onRetryDeeper && (matterStatus === "needs-revision" || matterStatus === "blocked") && (
            <div className="mt-3 flex items-center gap-3 border-t border-amber-200 pt-3 dark:border-amber-900">
              <button
                onClick={onRetryDeeper}
                disabled={streaming}
                className="rounded-md bg-amber-900 px-3 py-1.5 text-[11px] font-medium text-amber-50 hover:bg-amber-800 disabled:opacity-40 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
              >
                {streaming ? "Rerunning…" : "Retry with deeper rounds (6)"}
              </button>
              <span className="text-[10px] text-amber-700 dark:text-amber-400">
                {matterStatus === "needs-revision"
                  ? "Gives the drafter more passes to address the judge's concerns."
                  : "For blocked matters the reviewer usually needs a revised subject doc — more rounds alone rarely break through."}
              </span>
            </div>
          )}
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
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono font-semibold text-amber-600">[{c.id}]</span>
                  <span className="font-medium">
                    {c.authorityId} § {c.section}
                    {c.page ? `, p.${c.page}` : ""}
                    {c.pinpoint ? `, ${c.pinpoint}` : ""}
                  </span>
                  <SourceLockerBadges c={c} />
                  {verifications[c.id] && <VerifyBadge result={verifications[c.id]!} />}
                </div>
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

/**
 * NextStepHint — one-line guidance banner that adapts to the matter's
 * current workflow state. A lawyer should always be able to look at the
 * top of the output pane and see the single action that moves the
 * matter forward. Without this, the approval-export contract (hash
 * binding, verify-before-request, etc.) is invisible until the user
 * hits a 403.
 *
 * States, in order of precedence (first match wins):
 *   1. streaming          → "review is running"
 *   2. no content yet     → "drop a document, or hit Start review"
 *   3. red citations      → "verify or replace red citations before approval"
 *   4. READY_TO_SUBMIT, not yet requested → "request approval"
 *   5. approval requested → "awaiting reviewer signoff"
 *   6. verdict non-READY  → "retry with deeper rounds or refine via chat"
 *   7. approved (inferred) → "export DOCX or export redline"
 */
function NextStepHint({
  streaming,
  hasContent,
  verdict,
  approvalRequested,
  verifySummary,
  citationCount,
}: {
  streaming: boolean;
  hasContent: boolean;
  verdict: JudgeVerdict | null;
  approvalRequested: boolean;
  verifySummary: VerificationSummary;
  citationCount: number;
}) {
  let tone: "info" | "success" | "warn" = "info";
  let body: React.ReactNode = null;

  if (streaming) {
    tone = "info";
    body = (
      <>
        <span className="font-medium">Review streaming.</span>{" "}
        Watch the citations land and colour-code themselves; leaving the
        tab mid-stream is safe, the result is saved.
      </>
    );
  } else if (!hasContent) {
    tone = "info";
    body = (
      <>
        <span className="font-medium">Step 1 of 5 — drop a document.</span>{" "}
        Upload the document under review, then hit <em>Start review</em>.
        Source packs in scope are shown on the matter info panel.
      </>
    );
  } else if (verifySummary.total > 0 && verifySummary.notFound > 0) {
    tone = "warn";
    body = (
      <>
        <span className="font-medium">Citations flagged.</span>{" "}
        {verifySummary.notFound} of {verifySummary.total} citations could
        not be verified against the seed corpus and have no CanLII match
        either. Open the red pills below, replace or remove the
        offending authorities, then request approval.
      </>
    );
  } else if (verdict === "READY_TO_SUBMIT" && !approvalRequested) {
    tone = "success";
    body = (
      <>
        <span className="font-medium">Step 4 of 5 — request approval.</span>{" "}
        Reviewer persona marked this READY_TO_SUBMIT. Approval binds to
        the SHA-256 of the output text, so any edit after approval
        invalidates it.
      </>
    );
  } else if (approvalRequested) {
    tone = "info";
    body = (
      <>
        <span className="font-medium">Awaiting signoff.</span>{" "}
        Export is blocked until a reviewer approves. The reviewer can
        approve from <code>/approvals</code> or via the approval-store
        API. Once approved, the Export DOCX button unlocks.
      </>
    );
  } else if (verdict && verdict !== "READY_TO_SUBMIT") {
    tone = "warn";
    body = (
      <>
        <span className="font-medium">Judge flagged issues ({verdict}).</span>{" "}
        Retry with deeper rounds (below), or refine the draft via chat.
        Re-running the review replaces the current output.
      </>
    );
  } else if (citationCount > 0 && verifySummary.verified === verifySummary.total && verifySummary.total > 0) {
    tone = "success";
    body = (
      <>
        <span className="font-medium">Every citation verified.</span>{" "}
        Step 5 of 5 — hit Export DOCX to generate the filed artifact, or
        Export Redline for a track-changes DOCX if this matter is a
        contract redline.
      </>
    );
  }

  if (!body) return null;

  const palette =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      : tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        : "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200";

  return (
    <div className={`mt-2 rounded-md border px-3 py-2 text-xs ${palette}`}>{body}</div>
  );
}

/**
 * Verification badge — one per citation once the user has hit "Verify
 * citations". Green = verified against the seed corpus; blue = we
 * generated a CanLII URL, click to verify manually; red = no match in
 * any strategy (likely hallucinated). The blue pill is a real link —
 * the whole point of this badge is to collapse the verification flow
 * to one click.
 */
function VerifyBadge({ result }: { result: VerificationResult }) {
  const base =
    "rounded px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide";
  if (result.status === "verified") {
    return (
      <span
        title={result.reason}
        className={`${base} bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300`}
      >
        ✓ verified
      </span>
    );
  }
  if (result.status === "candidate-url" && result.evidence?.url) {
    return (
      <a
        href={result.evidence.url}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the candidate CanLII URL to verify this citation."
        className={`${base} bg-blue-100 text-blue-800 underline-offset-2 hover:underline dark:bg-blue-950 dark:text-blue-300`}
      >
        ↗ canlii
      </a>
    );
  }
  if (result.status === "not-found") {
    return (
      <span
        title={result.reason}
        className={`${base} bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300`}
      >
        ✕ not found
      </span>
    );
  }
  return (
    <span
      title={result.reason}
      className={`${base} bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300`}
    >
      {result.status}
    </span>
  );
}

/**
 * Source-locker badges — jurisdiction, source type, as-of date, confidence.
 * Rendered inline with each citation so a Canadian reviewer can, at a glance,
 * tell whether the cited authority is primary or secondary, binding in the
 * relevant jurisdiction, and current. Confidence below 0.4 is flagged red —
 * these are the claims a reviewer should verify before export.
 */
function SourceLockerBadges({ c }: { c: Citation }) {
  const isPriv = Boolean(c.privilege && c.privilege !== "none");
  const hasAny =
    c.jurisdiction ||
    c.sourceType ||
    c.authorityDate ||
    typeof c.confidence === "number" ||
    isPriv;
  if (!hasAny) return null;

  return (
    <span className="ml-1 inline-flex flex-wrap items-center gap-1">
      {isPriv && (
        <span
          className="rounded bg-red-100 px-1 py-0 font-mono text-[9px] font-bold uppercase tracking-wide text-red-800 dark:bg-red-950 dark:text-red-300"
          title={`Privilege: ${c.privilege}. External exports redact this citation by default; internal exports show it intact.`}
        >
          🔒 PRIV
        </span>
      )}
      {c.jurisdiction && (
        <span
          className="rounded border border-neutral-300 bg-white px-1 py-0 font-mono text-[9px] uppercase tracking-wide text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
          title="Jurisdiction"
        >
          {formatJurisdictionBadge(c.jurisdiction)}
        </span>
      )}
      {c.sourceType && (
        <span
          className={`rounded px-1 py-0 text-[9px] font-medium uppercase tracking-wide ${sourceTypeStyle(c.sourceType)}`}
          title="Source type"
        >
          {c.sourceType.replace("-", " ")}
        </span>
      )}
      {c.authorityDate && (
        <span
          className="rounded bg-neutral-100 px-1 py-0 font-mono text-[9px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
          title="Authority as-of date"
        >
          {c.authorityDate}
        </span>
      )}
      {typeof c.confidence === "number" && (
        <span
          className={`rounded px-1 py-0 font-mono text-[9px] font-semibold ${confidenceStyle(c.confidence)}`}
          title="Model-reported confidence this authority supports the proposition"
        >
          {Math.round(c.confidence * 100)}%
        </span>
      )}
    </span>
  );
}

function formatJurisdictionBadge(j: string): string {
  if (j === "multi-provincial") return "multi-prov";
  if (j.length <= 3) return j.toUpperCase();
  return j.toUpperCase().slice(0, 8);
}

function sourceTypeStyle(t: string): string {
  switch (t) {
    case "statute":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300";
    case "regulation":
      return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300";
    case "rule":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";
    case "case":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
    case "practice-direction":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300";
    case "regulator-notice":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
    case "commentary":
      return "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300";
    case "firm-precedent":
      // Fuchsia — distinct from any of the primary-authority palettes
      // so a reader scanning citations sees "this is our own prior
      // work" at a glance, not a statute or a regulator notice.
      return "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300";
    case "internal":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    default:
      return "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400";
  }
}

function confidenceStyle(confidence: number): string {
  if (confidence >= 0.75) return "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300";
  if (confidence >= 0.4) return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300";
  return "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300";
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function deriveApprovalSummary(text: string): string {
  const line = text
    .split("\n")
    .map((l) => l.replace(/^#+\s*/, "").trim())
    .find((l) => l.length > 0);
  if (!line) return "";
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
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
