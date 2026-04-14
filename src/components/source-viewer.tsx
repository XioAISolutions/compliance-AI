"use client";
import { useState, useEffect } from "react";

interface ChunkData { id: string; fileName: string; pageNumber: number; sectionHeader: string | null; sectionNumber: string | null; sectionPath: string[]; content: string; chunkIndex: number; totalChunks: number; createdAt: string; }
interface ContextPayload { chunk: ChunkData; parents: { id: string; heading: string; number: string | null }[]; citedBy: { chunkId: string; heading: string | null; fileName: string }[]; cites: { chunkId: string; heading: string | null; fileName: string }[]; }

export function SourceViewer({ chunkId, onClose, onOpenChunk }: { chunkId: string | null; onClose: () => void; onOpenChunk?: (id: string) => void }) {
  const [ctx, setCtx] = useState<ContextPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const chunk = ctx?.chunk ?? null;

  useEffect(() => {
    if (!chunkId) { setCtx(null); return; }
    setLoading(true);
    fetch(`/api/sources?chunkId=${encodeURIComponent(chunkId)}`)
      .then((r) => r.json()).then((d) => { setCtx(d.chunk ? d : null); setLoading(false); })
      .catch(() => { setCtx(null); setLoading(false); });
  }, [chunkId]);

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Source Viewer</span>
        <button onClick={onClose} className="text-base bg-transparent border-none cursor-pointer" style={{ color: "var(--text-muted)" }}>x</button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {!chunkId && <div className="flex items-center justify-center h-32 text-sm" style={{ color: "var(--text-muted)" }}>Click a citation to view source</div>}
        {loading && <div className="text-sm" style={{ color: "var(--text-muted)" }}>Loading...</div>}
        {chunk && !loading && ctx && (
          <div className="animate-slide-up">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>{chunk.fileName}</div>
            {chunk.sectionPath.length > 0 && (
              <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>{chunk.sectionPath.join(" › ")}</div>
            )}
            <div className="text-base font-semibold mb-1">{chunk.sectionHeader || `Chunk ${chunk.chunkIndex + 1}`}</div>
            <div className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Page {chunk.pageNumber} | Chunk {chunk.chunkIndex + 1}/{chunk.totalChunks}{chunk.sectionNumber ? ` | §${chunk.sectionNumber}` : ""}</div>
            <div className="p-4 rounded-lg text-sm leading-relaxed" style={{ background: "var(--bg-card)", borderLeft: "3px solid var(--accent)", color: "var(--text-secondary)" }}>{chunk.content}</div>

            {ctx.cites.length > 0 && (
              <div className="mt-4">
                <div className="text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Cites ({ctx.cites.length})</div>
                {ctx.cites.map((r) => (
                  <button key={`cite-${r.chunkId}`} onClick={() => onOpenChunk?.(r.chunkId)} className="flex flex-col w-full text-left px-3 py-2 mb-1 rounded-md border text-xs" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
                    <span style={{ color: "var(--accent)" }}>{r.heading ?? r.fileName}</span>
                    <span style={{ color: "var(--text-muted)" }}>{r.fileName}</span>
                  </button>
                ))}
              </div>
            )}

            {ctx.citedBy.length > 0 && (
              <div className="mt-4">
                <div className="text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Cited by ({ctx.citedBy.length})</div>
                {ctx.citedBy.map((r) => (
                  <button key={`cb-${r.chunkId}`} onClick={() => onOpenChunk?.(r.chunkId)} className="flex flex-col w-full text-left px-3 py-2 mb-1 rounded-md border text-xs" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
                    <span style={{ color: "var(--accent)" }}>{r.heading ?? r.fileName}</span>
                    <span style={{ color: "var(--text-muted)" }}>{r.fileName}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 p-3 rounded-md border" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
              <div className="text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Retrieval Metadata</div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                <div>Method: Hybrid (BM25 + vector, RRF)</div>
                <div>Embedding: nomic-embed-text</div>
                <div>Chunk ID: {chunk.id}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
