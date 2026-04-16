"use client";

/**
 * Output pane — the primary canvas. The deliverable is the hero.
 *
 * Renders the streaming output with structured citations as superscripts.
 * Shows the judge-loop verdict inline. Provides export controls.
 */

import { useState } from "react";

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
  leadPersona: string;
  matterId: string;
  onOpenChat: () => void;
  onStartReview: () => void;
}

/**
 * Persona label lookup — keeps the OutputPane self-contained without
 * importing the agents package on the client.
 */
const PERSONA_LABEL: Record<string, string> = {
  drafter: "Drafter",
  reviewer: "Reviewer",
  "om-reviewer": "OM Reviewer",
  "kyc-reviewer": "KYC Reviewer",
  "marketing-reviewer": "Marketing Reviewer",
  "response-drafter": "Response Drafter",
  "evidence-collector": "Evidence Collector",
  "risk-assessor": "Risk Assessor",
  judge: "Judge",
};

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
  leadPersona,
  matterId,
  onOpenChat,
  onStartReview,
}: Props) {
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null);

  const renderedContent = renderWithCitations(content, citations, hoveredCitation, setHoveredCitation);
  const leadLabel = PERSONA_LABEL[leadPersona] ?? leadPersona;

  // Referenced so the matter id is reachable for future export-to-docx action
  // (see plan, Phase 4). Today it's passed through so the wiring exists.
  void matterId;

  return (
    <div className="flex h-full flex-col">
      {/* Header with verdict and actions */}
      <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">Output</h2>
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-medium text-teal-700 dark:bg-teal-950 dark:text-teal-300">
            {leadLabel}
          </span>
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
            onClick={() => {
              // Export as text file for now; Day 3 adds DOCX generation
              const blob = new Blob([content], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "compliance-review.md";
              a.click();
              URL.revokeObjectURL(url);
            }}
            disabled={!content || streaming}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
          >
            Export
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
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap leading-relaxed">{renderedContent}</div>
            {streaming && (
              <span className="inline-block h-4 w-1 animate-pulse bg-neutral-400" />
            )}
          </div>
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

/**
 * Render content with citation markers as interactive superscripts.
 * Replaces [c1], [c2], etc. with clickable links.
 */
function renderWithCitations(
  content: string,
  citations: Citation[],
  hoveredCitation: string | null,
  setHoveredCitation: (id: string | null) => void,
): React.ReactNode[] {
  if (!content) return [];

  const citationMap = new Map(citations.map((c) => [c.id, c]));
  const parts = content.split(/(\[c\d+\])/g);

  return parts.map((part, i) => {
    const match = part.match(/^\[(c\d+)\]$/);
    if (match) {
      const citId = match[1]!;
      const citation = citationMap.get(citId);
      if (citation) {
        return (
          <sup
            key={i}
            className={`cursor-pointer rounded px-0.5 font-mono text-[10px] font-bold transition-colors ${
              hoveredCitation === citId
                ? "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
                : "text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50"
            }`}
            onMouseEnter={() => setHoveredCitation(citId)}
            onMouseLeave={() => setHoveredCitation(null)}
            onClick={() => {
              document.getElementById(`citation-${citId}`)?.scrollIntoView({ behavior: "smooth" });
            }}
            title={`${citation.authorityId} § ${citation.section}`}
          >
            [{citId}]
          </sup>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}
