"use client";
import React from "react";

interface Citation {
  id: string;
  chunkId: string;
}

/**
 * Parse answer text and rewrite [[Sn:ref]] markers into clickable badges
 * that open the source viewer. Unknown refs render as plain text — though
 * the server should have stripped them before they reach the client.
 */
export function CitationRenderer({
  text,
  citations,
  onOpen,
}: {
  text: string;
  citations: Citation[];
  onOpen: (chunkId: string) => void;
}) {
  const byId = new Map(citations.map((c) => [c.id, c.chunkId]));

  const re = /\[\[\s*S\d+\s*:\s*[^\]]+?\s*\]\]/gi;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const m of text.matchAll(re)) {
    const start = m.index ?? 0;
    if (start > cursor) parts.push(<span key={`t-${key++}`}>{text.slice(cursor, start)}</span>);
    const raw = m[0];
    const normalized = raw.replace(/\s+/g, "");
    const chunkId = byId.get(normalized) ?? byId.get(raw);
    if (chunkId) {
      parts.push(
        <button
          key={`c-${key++}`}
          onClick={() => onOpen(chunkId)}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-xs font-medium border align-baseline transition-colors hover:opacity-80"
          style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)" }}
        >
          {raw.replace(/\s+/g, "")}
        </button>,
      );
    } else {
      // Hallucinated citations should already be stripped server-side,
      // but fall back to muted text if one slips through.
      parts.push(
        <span key={`m-${key++}`} className="opacity-50" style={{ color: "var(--text-muted)" }}>{raw}</span>,
      );
    }
    cursor = start + raw.length;
  }
  if (cursor < text.length) parts.push(<span key={`t-${key++}`}>{text.slice(cursor)}</span>);

  return <span className="whitespace-pre-wrap">{parts}</span>;
}
