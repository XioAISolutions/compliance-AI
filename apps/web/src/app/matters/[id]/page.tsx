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

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { InputPane } from "./InputPane";
import { ContextPane } from "./ContextPane";
import { OutputPane } from "./OutputPane";
import { ChatDrawer } from "./ChatDrawer";
import { AuditLog } from "./AuditLog";

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

  const [chatOpen, setChatOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditVerified, setAuditVerified] = useState(true);
  const [showAudit, setShowAudit] = useState(false);
  const [uploading, setUploading] = useState(false);

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

  useEffect(() => {
    void fetchMatter();
  }, [fetchMatter]);

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
    setVerdict(null);
    setTotalRounds(null);

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

            if (event.type === "text-delta" && typeof event.delta === "string") {
              setOutput((prev) => prev + event.delta);
            } else if (event.type === "verdict-final") {
              setVerdict(event.verdict as JudgeVerdict);
            } else if (event.type === "loop-done") {
              setTotalRounds(event.totalRounds as number);
              if (event.finalVerdict) setVerdict(event.finalVerdict as JudgeVerdict);
            } else if (event.type === "citations" && Array.isArray(event.citations)) {
              setCitations(event.citations as Citation[]);
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
        <p className="mt-2 text-neutral-500">This matter may have been deleted or does not exist.</p>
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
                uploading={uploading}
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
      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        matterId={matterId}
      />
    </div>
  );
}
