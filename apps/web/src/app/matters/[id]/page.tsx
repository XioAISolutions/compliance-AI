"use client";

/**
 * Matter detail — Input → Context → Output, with a three-tab main canvas.
 *
 * Left rail (always visible):
 *   - Input: matter scope + document drop zone
 *   - Context: auto-loaded authorities + what's excluded and why
 *
 * Main canvas (tabbed):
 *   - Output     — the streaming deliverable with citation superscripts
 *   - Transcript — multi-persona reply-threaded timeline (cannibalized
 *                  from agentchattr)
 *   - Graph      — evidence graph (cannibalized from GitNexus)
 *
 * Chat is a drawer opened from the output pane. Audit log is a collapsible
 * panel at the bottom.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { InputPane } from "./InputPane";
import { ContextPane } from "./ContextPane";
import { OutputPane } from "./OutputPane";
import { ChatDrawer } from "./ChatDrawer";
import { AuditLog } from "./AuditLog";
import { Timeline } from "./Timeline";
import { GraphView } from "./GraphView";
import type { TranscriptTurn } from "@compliance-ai/chat-structure";

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

type Tab = "output" | "transcript" | "graph";

export default function MatterDetailPage() {
  const params = useParams();
  const matterId = params.id as string;

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
  const [leadPersona, setLeadPersona] = useState<string>("om-reviewer");

  const [chatOpen, setChatOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditVerified, setAuditVerified] = useState(true);
  const [showAudit, setShowAudit] = useState(false);

  const [tab, setTab] = useState<Tab>("output");
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [chunks, setChunks] = useState<
    Array<{ id: string; docId: string; title?: string; page?: number; preview?: string }>
  >([]);
  // Forces Timeline / GraphView to refetch when the loop ends.
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchMatter = useCallback(async () => {
    try {
      const res = await fetch(`/api/matters/${matterId}`);
      if (res.ok) {
        const data = await res.json();
        setMatter(data.matter);
        setDocuments(data.documents ?? []);
        setAuthorities(data.authorities ?? []);
        setExcluded(data.excluded ?? []);
        setAuditEntries(data.auditEntries ?? []);
        setAuditVerified(data.auditVerified ?? true);
      }
    } catch {
      // Will be handled by the UI showing empty state
    } finally {
      setLoadingContext(false);
    }
  }, [matterId]);

  const fetchTranscript = useCallback(async () => {
    try {
      const res = await fetch(`/api/matters/${matterId}/transcript`);
      if (res.ok) {
        const data = (await res.json()) as { turns: TranscriptTurn[] };
        setTranscript(data.turns ?? []);
      }
    } catch {
      // silent — empty state
    }
  }, [matterId]);

  const fetchChunks = useCallback(async () => {
    try {
      const res = await fetch(`/api/matters/${matterId}/chunks`);
      if (res.ok) {
        const data = (await res.json()) as {
          chunks: Array<{ id: string; docId: string; title?: string; page?: number; preview?: string }>;
        };
        setChunks(data.chunks ?? []);
      }
    } catch {
      // silent — graph just won't show chunk nodes
    }
  }, [matterId]);

  useEffect(() => {
    void fetchMatter();
    void fetchTranscript();
    void fetchChunks();
  }, [fetchMatter, fetchTranscript, fetchChunks]);

  async function handleDocumentUpload(file: File) {
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await fetch(`/api/matters/${matterId}/documents`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        void fetchMatter();
      }
    } catch {
      // Silent fail in preview
    }
  }

  async function startReview() {
    if (streaming || !matter) return;
    setStreaming(true);
    setOutput("");
    setCitations([]);
    setVerdict(null);
    setTotalRounds(null);
    // Track the lead persona's streaming buffer separately so we can replace
    // it with the redacted prose once the citations event arrives.
    let leadBuffer = "";
    let isLeadTurn = false;

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
              isLeadTurn = persona !== "judge";
              if (isLeadTurn) {
                leadBuffer = "";
                setLeadPersona(persona);
              }
            } else if (event.type === "text-delta" && typeof event.delta === "string") {
              if (isLeadTurn) {
                leadBuffer += event.delta;
                // Strip fenced ```citations + tool-call blocks visually
                // while streaming; parseModelOutput + parseToolCalls run
                // server-side and the "citations" event carries the
                // cleaned prose once the round finishes.
                const fenceStart = leadBuffer.indexOf("```citations");
                const toolStart = leadBuffer.search(/\{\{tool:/);
                let end = leadBuffer.length;
                if (fenceStart !== -1) end = Math.min(end, fenceStart);
                if (toolStart !== -1) end = Math.min(end, toolStart);
                setOutput(leadBuffer.slice(0, end));
              }
            } else if (event.type === "citations") {
              if (Array.isArray(event.citations)) {
                setCitations((prev) => [...prev, ...(event.citations as Citation[])]);
              }
              if (typeof event.redactedText === "string") {
                setOutput(event.redactedText);
              }
              isLeadTurn = false;
            } else if (event.type === "verdict-final") {
              setVerdict(event.verdict as JudgeVerdict);
            } else if (event.type === "loop-done") {
              setTotalRounds(event.totalRounds as number);
              if (event.finalVerdict) setVerdict(event.finalVerdict as JudgeVerdict);
            }
          } catch {
            // skip malformed
          }
        }
      }

      void fetchMatter();
      void fetchTranscript();
      void fetchChunks();
      setRefreshKey((k) => k + 1);
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
        <Link
          href="/matters"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
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
          <span className="text-xs text-neutral-400">
            Cloud inference · Anthropic zero-retention
          </span>
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
              />
              <div className="mt-6">
                <ContextPane
                  authorities={authorities}
                  excluded={excluded}
                  loading={loadingContext}
                />
              </div>
            </>
          )}
        </aside>

        {/* Right: tabbed main canvas */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <nav className="flex items-center gap-1 border-b border-neutral-200 px-6 pt-3 dark:border-neutral-800">
            <TabButton active={tab === "output"} onClick={() => setTab("output")}>
              Output
            </TabButton>
            <TabButton active={tab === "transcript"} onClick={() => setTab("transcript")}>
              Transcript
              {transcript.length > 0 && (
                <span className="ml-1 text-[10px] text-neutral-400">({transcript.length})</span>
              )}
            </TabButton>
            <TabButton active={tab === "graph"} onClick={() => setTab("graph")}>
              Graph
            </TabButton>
          </nav>
          <section className="flex-1 overflow-y-auto p-6">
            {tab === "output" && (
              <OutputPane
                content={output}
                citations={citations}
                verdict={verdict}
                totalRounds={totalRounds}
                streaming={streaming}
                leadPersona={leadPersona}
                matterId={matterId}
                onOpenChat={() => setChatOpen(true)}
                onStartReview={startReview}
              />
            )}
            {tab === "transcript" && (
              <Timeline matterId={matterId} refreshKey={refreshKey} />
            )}
            {tab === "graph" && matter && (
              <GraphView
                matter={{ id: matter.id, title: matter.title, status: matter.status }}
                documents={documents.map((d) => ({
                  id: d.id,
                  filename: d.filename,
                  documentType: d.documentType,
                  chunkCount: d.chunkCount,
                }))}
                authorities={authorities}
                transcript={transcript}
                chunks={chunks}
              />
            )}
          </section>
        </main>
      </div>

      {/* Audit trail (collapsible bottom panel) */}
      {showAudit && (
        <div className="max-h-64 overflow-y-auto border-t border-neutral-200 px-6 py-4 dark:border-neutral-800">
          <AuditLog entries={auditEntries} verified={auditVerified} />
        </div>
      )}

      {/* Chat drawer */}
      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        matterId={matterId}
      />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border border-b-0 border-neutral-200 bg-white text-neutral-900 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100"
          : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}
