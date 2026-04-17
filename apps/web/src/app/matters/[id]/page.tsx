"use client";

/**
 * Matter detail — the Input → Context → Output layout.
 *
 * This is the core of the redesigned workbench. Three panes:
 *   - Input (left, compact): matter scope + document drop zone
 *   - Context (left below input, collapsible): auto-loaded authorities
 *   - Output (right, largest): the streaming deliverable with citations
 *
 * Chat is a drawer opened from the output pane.
 * Audit log is a collapsible panel at the bottom.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { InputPane } from "./InputPane";
import { ContextPane } from "./ContextPane";
import { OutputPane } from "./OutputPane";
import { ChatDrawer } from "./ChatDrawer";
import { AuditLog } from "./AuditLog";
import { EvidencePanel, type EvidenceItem } from "./EvidencePanel";

type JudgeVerdict = "READY_TO_SUBMIT" | "ITERATE" | "REWRITE";

interface Matter {
  id: string;
  title: string;
  jurisdiction: string;
  registrationCategory: string;
  taskType: string;
  status: string;
}

interface MatterDocument {
  id: string;
  filename: string;
  documentType: string;
  chunkCount: number;
}

interface Authority {
  id: string;
  title: string;
  source: string;
}

interface Citation {
  id: string;
  authorityId: string;
  section: string;
  quote: string;
  docId: string;
  chunkId: string;
  page?: number;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  inputHash: string;
  authoritiesUsed: string[];
  outputHash: string | null;
  judgeVerdict: string | null;
  inputContent: string | null;
  outputContent: string | null;
}

export default function MatterDetailPage() {
  const params = useParams();
  const matterId = params.id as string;
  const searchParams = useSearchParams();
  const autoStart = searchParams.get("autoStart") === "1";
  const autoStartFired = useRef(false);
  /**
   * Which persona is actively emitting text-deltas right now. Set by
   * round-started events. Used to filter judge deltas out of the output
   * pane — the deliverable is the drafter's work, not the reasoning
   * transcript.
   */
  const currentPersonaRef = useRef<string | null>(null);

  const [matter, setMatter] = useState<Matter | null>(null);
  const [documents, setDocuments] = useState<MatterDocument[]>([]);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [excluded, setExcluded] = useState<{ rule: string; reason: string }[]>([]);
  const [loadingContext, setLoadingContext] = useState(true);

  const [output, setOutput] = useState("");
  const [citations, setCitations] = useState<Citation[]>([]);
  const [verdict, setVerdict] = useState<JudgeVerdict | null>(null);
  const [totalRounds, setTotalRounds] = useState<number | null>(null);
  const [streaming, setStreaming] = useState(false);
  // Citation integrity signals — surface the new SSE events the review route
  // emits when the drafter's ```citations fence is missing / truncated /
  // references hallucinated chunkIds. Silent dropping is what produced empty
  // `authorities_used` in the audit trail before; the UI now names the gap
  // (and, when the citation-retry rescues it, shows that too).
  const [citationRetry, setCitationRetry] = useState<{
    inFlight: boolean;
    reason: string | null;
    markerCount: number;
    priorValidCount: number;
  }>({ inFlight: false, reason: null, markerCount: 0, priorValidCount: 0 });
  const [citationWarnings, setCitationWarnings] = useState<{
    orphanedMarkers: string[];
    unusedCitations: string[];
    droppedChunkIds: string[];
    afterRetry: boolean;
  } | null>(null);
  // Last judge round's rationale — shown when the final verdict isn't
  // READY_TO_SUBMIT so a compliance lawyer can see WHY the draft got
  // rejected instead of just "Rewriting" / "Iterating" badges.
  const [verdictRationale, setVerdictRationale] = useState<string | null>(null);

  const [chatOpen, setChatOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditVerified, setAuditVerified] = useState(true);
  const [showAudit, setShowAudit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);

  const fetchMatter = useCallback(async () => {
    try {
      const [matterRes, evidenceRes] = await Promise.all([
        fetch(`/api/matters/${matterId}`),
        fetch(`/api/matters/${matterId}/evidence`),
      ]);
      if (matterRes.ok) {
        const data = await matterRes.json();
        setMatter(data.matter);
        setDocuments(data.documents ?? []);
        setAuthorities(data.authorities ?? []);
        setExcluded(data.excluded ?? []);
        setAuditEntries(data.auditEntries ?? []);
        setAuditVerified(data.auditVerified ?? true);
      }
      if (evidenceRes.ok) {
        const items = (await evidenceRes.json()) as EvidenceItem[];
        setEvidence(items);
      }
    } catch {
      // Will be handled by the UI showing empty state
    } finally {
      setLoadingContext(false);
    }
  }, [matterId]);

  useEffect(() => {
    void fetchMatter();
  }, [fetchMatter]);

  // Auto-start the review when arriving from the home-page quick-review flow
  // (URL param autoStart=1 set by QuickReviewDropZone). Fires once after the
  // matter data has loaded and at least one document is present.
  useEffect(() => {
    if (!autoStart) return;
    if (autoStartFired.current) return;
    if (!matter) return;
    if (documents.length === 0) return;
    if (streaming) return;
    autoStartFired.current = true;
    void startReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, matter, documents.length, streaming]);

  async function handleDocumentUpload(file: File) {
    if (uploading) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/matters/${matterId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        void fetchMatter();
      } else {
        const body = await res.json().catch(() => null);
        const errorMsg = body?.error ?? `HTTP ${res.status}`;
        setOutput((prev) => prev + `\n\n**Upload error:** ${errorMsg}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOutput((prev) => prev + `\n\n**Upload error:** ${msg}`);
    } finally {
      setUploading(false);
    }
  }

  async function startReview() {
    if (streaming || !matter) return;
    setStreaming(true);
    setOutput("");
    setCitations([]);
    setCitationRetry({ inFlight: false, reason: null, markerCount: 0, priorValidCount: 0 });
    setCitationWarnings(null);
    setVerdictRationale(null);
    setVerdict(null);
    setTotalRounds(null);
    currentPersonaRef.current = null;

    try {
      const res = await fetch(`/api/matters/${matterId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskType: matter.taskType }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          if (!raw.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(raw.slice(6)) as Record<string, unknown>;

            if (event.type === "round-started") {
              const persona = event.persona as string;
              const round = event.round as number;
              currentPersonaRef.current = persona;
              // On a new drafter round (R2+), the previously-streamed draft
              // is now stale — the judge said ITERATE and the drafter is
              // producing a revised version. Clear the pane so the user
              // sees the NEW draft cleanly, not stacked on the old one.
              if (persona !== "judge" && round > 1) {
                setOutput("");
                setCitations([]);
              }
            } else if (event.type === "text-delta" && typeof event.delta === "string") {
              // Only the drafter's output is the deliverable. The judge's
              // rationale appears as a verdict badge, not as prose in the
              // output pane.
              if (currentPersonaRef.current !== "judge") {
                setOutput((prev) => prev + event.delta);
              }
            } else if (event.type === "verdict-final") {
              setVerdict(event.verdict as JudgeVerdict);
            } else if (event.type === "prose-final" && typeof event.prose === "string") {
              // Replace the accumulated stream with the canonical final
              // prose (citations JSON fence stripped). Emitted once after
              // the loop exits.
              setOutput(event.prose);
            } else if (event.type === "citations" && Array.isArray(event.citations)) {
              setCitations(event.citations as Citation[]);
              // Arrival of a citations event means either the first-pass
              // citations landed OR the retry just rescued them. Either way
              // the retry is no longer in-flight.
              setCitationRetry((prev) => ({ ...prev, inFlight: false }));
            } else if (event.type === "citation-retry-started") {
              setCitationRetry({
                inFlight: true,
                reason: typeof event.reason === "string" ? event.reason : "citation gap",
                markerCount: Array.isArray(event.markersInProse) ? event.markersInProse.length : 0,
                priorValidCount:
                  typeof event.priorValidCount === "number" ? event.priorValidCount : 0,
              });
            } else if (event.type === "citation-warnings") {
              setCitationWarnings({
                orphanedMarkers: Array.isArray(event.orphanedMarkers)
                  ? (event.orphanedMarkers as string[])
                  : [],
                unusedCitations: Array.isArray(event.unusedCitations)
                  ? (event.unusedCitations as string[])
                  : [],
                droppedChunkIds: Array.isArray(event.droppedChunkIds)
                  ? (event.droppedChunkIds as string[])
                  : [],
                afterRetry: event.afterRetry === true,
              });
            } else if (event.type === "verdict-rationale" && typeof event.rationale === "string") {
              setVerdictRationale(event.rationale);
            } else if (event.type === "loop-done") {
              setTotalRounds(event.totalRounds as number);
              if (event.finalVerdict) setVerdict(event.finalVerdict as JudgeVerdict);
            }
          } catch {
            // skip malformed
          }
        }
      }

      // Refresh audit log after review completes
      void fetchMatter();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setOutput((prev) => prev + `\n\n**Error:** ${msg}`);
    } finally {
      setStreaming(false);
    }
  }

  if (!matter && !loadingContext) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Matter not found</h1>
        <p className="mt-2 text-neutral-500">
          This matter may have been deleted or does not exist.
        </p>
        <Link href="/matters" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          Back to matters
        </Link>
      </main>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <Link
            href="/matters"
            className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            Matters
          </Link>
          <span className="text-neutral-300">/</span>
          <h1 className="text-sm font-semibold">{matter?.title ?? "Loading…"}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAudit(!showAudit)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            {showAudit ? "Hide audit trail" : "Audit trail"} ({auditEntries.length})
          </button>
          <span className="text-xs text-neutral-400">Demo preview. Use sample documents only.</span>
        </div>
      </header>

      {/* Main content — three pane layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Input + Context */}
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-neutral-200 p-4 dark:border-neutral-800">
          {matter && (
            <>
              <InputPane
                matter={matter}
                documents={documents}
                onDocumentUpload={handleDocumentUpload}
                uploading={uploading}
              />
              <div className="mt-6">
                <ContextPane
                  authorities={authorities}
                  excluded={excluded}
                  loading={loadingContext}
                />
              </div>
              <div className="mt-6">
                <EvidencePanel items={evidence} matterId={matterId} onRefresh={fetchMatter} />
              </div>
            </>
          )}
        </aside>

        {/* Right: Output (the hero) */}
        <main className="flex-1 overflow-y-auto p-6">
          <OutputPane
            content={output}
            citations={citations}
            verdict={verdict}
            totalRounds={totalRounds}
            streaming={streaming}
            matterId={matterId}
            onOpenChat={() => setChatOpen(true)}
            onStartReview={startReview}
            citationRetry={citationRetry}
            citationWarnings={citationWarnings}
            verdictRationale={verdictRationale}
          />
        </main>
      </div>

      {/* Audit trail (collapsible bottom panel) */}
      {showAudit && (
        <div className="max-h-64 overflow-y-auto border-t border-neutral-200 px-6 py-4 dark:border-neutral-800">
          <AuditLog entries={auditEntries} verified={auditVerified} />
        </div>
      )}

      {/* Chat drawer */}
      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} matterId={matterId} />
    </div>
  );
}
