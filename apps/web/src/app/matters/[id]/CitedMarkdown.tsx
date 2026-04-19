"use client";

/**
 * CitedMarkdown — renders markdown with inline [cN] citation superscripts.
 *
 * The model emits markdown (tables, headings, lists, bold) with bracketed
 * citation markers like `[c1]` scattered through prose. We render the
 * markdown via react-markdown + remark-gfm, then intercept TEXT nodes to
 * replace `[cN]` tokens with interactive superscripts that link to the
 * footnotes list.
 *
 * Why we split inside the react-markdown text-node callback instead of
 * preprocessing: preprocessing breaks across markdown boundaries (a `[c1]`
 * inside a table cell gets the same treatment as one in a paragraph). Doing
 * it per text node keeps the markdown tree intact.
 */

import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Citation {
  id: string;
  authorityId: string;
  section: string;
  quote: string;
  docId: string;
  chunkId: string;
  page?: number;
  jurisdiction?: string;
  sourceType?: string;
  authorityDate?: string;
  pinpoint?: string;
  confidence?: number;
}

interface Props {
  content: string;
  citations: Citation[];
  hoveredCitation: string | null;
  onHoverCitation: (id: string | null) => void;
}

const CITATION_MARKER_RE = /(\[c\d+\])/g;

export function CitedMarkdown({ content, citations, hoveredCitation, onHoverCitation }: Props) {
  const citationIds = useMemo(() => new Set(citations.map((c) => c.id)), [citations]);
  const citationById = useMemo(
    () => new Map(citations.map((c) => [c.id, c])),
    [citations],
  );

  const renderText = (text: string): React.ReactNode => {
    if (!text) return text;
    const parts = text.split(CITATION_MARKER_RE);
    if (parts.length === 1) return text;

    return parts.map((part, i) => {
      const match = part.match(/^\[(c\d+)\]$/);
      if (match) {
        const citId = match[1]!;
        if (citationIds.has(citId)) {
          const citation = citationById.get(citId)!;
          const isHovered = hoveredCitation === citId;
          return (
            <sup
              key={`cit-${i}-${citId}`}
              className={`cursor-pointer rounded px-0.5 font-mono text-[10px] font-bold transition-colors ${
                isHovered
                  ? "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
                  : "text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-900/50"
              }`}
              onMouseEnter={() => onHoverCitation(citId)}
              onMouseLeave={() => onHoverCitation(null)}
              onClick={() => {
                document.getElementById(`citation-${citId}`)?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
              }}
              title={buildCitationTooltip(citation)}
            >
              [{citId}]
            </sup>
          );
        }
        // Unknown citation marker — render as plain text so we don't silently drop it.
        return <span key={`unk-${i}`}>{part}</span>;
      }
      return <React.Fragment key={`t-${i}`}>{part}</React.Fragment>;
    });
  };

  // Recursively walk children and replace string nodes with citation-aware
  // output. This keeps the markdown structure (p, li, td, em, strong, …)
  // and only rewrites the leaves.
  const walkChildren = (children: React.ReactNode): React.ReactNode => {
    return React.Children.map(children, (child) => {
      if (typeof child === "string") return renderText(child);
      return child;
    });
  };

  return (
    <div className="cited-markdown prose prose-sm max-w-none dark:prose-invert prose-table:border prose-table:border-collapse prose-th:border prose-th:p-2 prose-td:border prose-td:p-2 prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{walkChildren(children)}</p>,
          li: ({ children }) => <li>{walkChildren(children)}</li>,
          td: ({ children }) => <td>{walkChildren(children)}</td>,
          th: ({ children }) => <th>{walkChildren(children)}</th>,
          strong: ({ children }) => <strong>{walkChildren(children)}</strong>,
          em: ({ children }) => <em>{walkChildren(children)}</em>,
          h1: ({ children }) => <h1>{walkChildren(children)}</h1>,
          h2: ({ children }) => <h2>{walkChildren(children)}</h2>,
          h3: ({ children }) => <h3>{walkChildren(children)}</h3>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function buildCitationTooltip(c: Citation): string {
  const head = `${c.authorityId} § ${c.section}${c.page ? `, p.${c.page}` : ""}${c.pinpoint ? `, ${c.pinpoint}` : ""}`;
  const tail: string[] = [];
  if (c.jurisdiction) tail.push(c.jurisdiction.toUpperCase());
  if (c.sourceType) tail.push(c.sourceType);
  if (c.authorityDate) tail.push(`as-of ${c.authorityDate}`);
  if (typeof c.confidence === "number") tail.push(`conf ${Math.round(c.confidence * 100)}%`);
  return tail.length > 0 ? `${head} — ${tail.join(" · ")}` : head;
}
