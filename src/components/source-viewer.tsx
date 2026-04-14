"use client";
import { useState, useEffect } from "react";

interface ChunkData { id: string; fileName: string; pageNumber: number; sectionHeader: string | null; content: string; chunkIndex: number; totalChunks: number; createdAt: string; }

export function SourceViewer({ chunkId, onClose }: { chunkId: string | null; onClose: () => void }) {
  const [chunk, setChunk] = useState<ChunkData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!chunkId) { setChunk(null); return; }
    setLoading(true);
    fetch(`/api/sources?chunkId=${encodeURIComponent(chunkId)}`)
      .then((r) => r.json()).then((d) => { setChunk(d.chunk || null); setLoading(false); })
      .catch(() => { setChunk(null); setLoading(false); });
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
        {chunk && !loading && (
          <div className="animate-slide-up">
            <div className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--accent)" }}>{chunk.fileName}</div>
            <div className="text-base font-semibold mb-1">{chunk.sectionHeader || `Chunk ${chunk.chunkIndex + 1}`}</div>
            <div className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Page {chunk.pageNumber} | Chunk {chunk.chunkIndex + 1}/{chunk.totalChunks}</div>
            <div className="p-4 rounded-lg text-sm leading-relaxed" style={{ background: "var(--bg-card)", borderLeft: "3px solid var(--accent)", color: "var(--text-secondary)" }}>{chunk.content}</div>
            <div className="mt-4 p-3 rounded-md border" style={{ background: "var(--bg-primary)", borderColor: "var(--border)" }}>
              <div className="text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Retrieval Metadata</div>
              <div className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                <div>Method: Vector similarity search</div>
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
