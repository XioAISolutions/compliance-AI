"use client";

/**
 * Output pane — the primary canvas. The deliverable is the hero.
 *
 * Renders the streaming output with structured citations as superscripts.
 * Shows the judge-loop verdict inline. Provides export controls.
 */

import { useState } from "react";
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

interface Props {
  content: string;
  citations: Citation[];
  verdict: JudgeVerdict | null;
  totalRounds: number | null;
  streaming: boolean;
  matterId: string;
  onOpenChat: () => void;
  onStartReview: () => void;
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
}: Props) {
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

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
        </div>
      </div>

      {/* Main output area */}
      <div className="flex-1 overflow-y-auto pt-4">
        {!content && !streaming && (
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
        {(content || streaming) && (
          <>
            <CitedMarkdown
              content={content}
              citations={citations}
              hoveredCitation={hoveredCitation}
              onHoverCitation={setHoveredCitation}
            />
            {streaming && (
              <span className="mt-1 inline-block h-4 w-1 animate-pulse bg-neutral-400" />
            )}
          </>
        )}
      </div>

      {/* Citations footnotes */}
      {citations.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-3 dark:border-neutral-800">
          <h3 className="text-xs font-semibold text-neutral-400">
            Citations ({citations.length})
          </h3>
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
                <span className="font-medium">{c.authorityId} § {c.section}</span>
                <p className="mt-0.5 text-neutral-500 italic">&ldquo;{c.quote}&rdquo;</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

