"use client";

/**
 * RedlinePreview — renders the contract-redliner persona's inline diff
 * tokens as a visual track-change document directly in the browser.
 *
 * Today the only way to see the redline is to export DOCX. This component
 * shows the same strikethrough/underline/footnote visual the DOCX
 * renderer produces, so the lawyer can review before exporting.
 *
 * Renders are pure-CSS — no extra dependencies. Uses the shared
 * parseRedline + redlineStats helpers so any future tokenizer change
 * lights up here automatically.
 */

import { useMemo } from "react";
import { parseRedline, redlineStats } from "../../../lib/redline-diff";

export function RedlinePreview({ content }: { content: string }) {
  const segments = useMemo(() => parseRedline(content), [content]);
  const stats = useMemo(() => redlineStats(segments), [segments]);

  // Footnotes are numbered sequentially and rendered at the bottom of
  // the preview. We collect them in a single pass through the segment
  // list so the inline superscript and the bottom list share the same
  // numbering.
  const notes: string[] = [];
  const inline: React.ReactNode[] = [];
  let key = 0;

  for (const seg of segments) {
    key += 1;
    if (seg.kind === "text") {
      // Preserve paragraph boundaries: split on blank lines and emit
      // each chunk as its own paragraph block. Single newlines inside
      // a paragraph become spaces (matches the DOCX render semantics).
      const parts = seg.content.split(/\n\s*\n/);
      for (let i = 0; i < parts.length; i += 1) {
        const text = parts[i]!.replace(/\s*\n\s*/g, " ");
        if (text.length > 0) {
          inline.push(<span key={`t-${key}-${i}`}>{text}</span>);
        }
        if (i < parts.length - 1) {
          inline.push(<br key={`br-${key}-${i}`} />);
          inline.push(<br key={`br2-${key}-${i}`} />);
        }
      }
    } else if (seg.kind === "delete") {
      inline.push(
        <del
          key={`d-${key}`}
          className="bg-red-50 text-red-700 decoration-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {seg.content}
        </del>,
      );
    } else if (seg.kind === "insert") {
      inline.push(
        <ins
          key={`i-${key}`}
          className="bg-blue-50 text-blue-800 underline decoration-blue-800 decoration-2 underline-offset-2 dark:bg-blue-950/40 dark:text-blue-200 dark:decoration-blue-300"
        >
          {seg.content}
        </ins>,
      );
    } else if (seg.kind === "note") {
      const n = notes.length + 1;
      notes.push(seg.content);
      inline.push(
        <sup key={`n-${key}`} className="font-mono text-[10px] text-amber-700 dark:text-amber-300">
          <a
            href={`#redline-note-${n}`}
            className="rounded px-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/40"
            title={seg.content}
          >
            [{n}]
          </a>
        </sup>,
      );
    }
  }

  return (
    <div className="redline-preview">
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
        <span className="font-medium">Redline preview</span>
        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          {stats.insertions} ins
        </span>
        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-red-800 dark:bg-red-950 dark:text-red-200">
          {stats.deletions} del
        </span>
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {stats.notes} note{stats.notes === 1 ? "" : "s"}
        </span>
        <span className="ml-auto text-[10px] text-neutral-400">
          Visual only — Word reader sees the same colour scheme on Export Redline.
        </span>
      </div>

      <div className="leading-relaxed">{inline}</div>

      {notes.length > 0 && (
        <div className="mt-6 border-t border-neutral-200 pt-3 text-xs dark:border-neutral-800">
          <p className="text-xs font-semibold text-neutral-400">
            Notes ({notes.length})
          </p>
          <ol className="mt-2 space-y-1.5 pl-4">
            {notes.map((n, i) => (
              <li
                key={`note-${i}`}
                id={`redline-note-${i + 1}`}
                className="rounded-md bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <span className="mr-1.5 font-mono text-[10px] text-amber-700 dark:text-amber-300">
                  [{i + 1}]
                </span>
                {n}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

/**
 * Heuristic: is this output a redline that should be rendered with the
 * RedlinePreview component instead of CitedMarkdown? True if any of the
 * three diff tokens appear. Used by the matter page to auto-pick the
 * right renderer without forcing the user to flip a toggle.
 */
export function looksLikeRedline(content: string): boolean {
  return /\[-[\s\S]+?-\]|\{\+[\s\S]+?\+\}|<<NOTE:/.test(content);
}
