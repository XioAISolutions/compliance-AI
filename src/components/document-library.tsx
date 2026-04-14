"use client";
import { useState, useRef } from "react";

interface DocInfo { documentId: string; fileName: string; chunkCount: number; }

export function DocumentLibrary({ documents, totalChunks, onUpload, onRefresh }: {
  documents: DocInfo[]; totalChunks: number;
  onUpload: (file: File) => Promise<any>; onRefresh: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) { setStatus("Only PDFs"); return; }
    setUploading(true); setStatus("Parsing...");
    try {
      setTimeout(() => setStatus("Chunking..."), 1500);
      setTimeout(() => setStatus("Embedding..."), 3000);
      await onUpload(file);
      setStatus("Indexed"); onRefresh();
      setTimeout(() => setStatus(null), 2000);
    } catch (e: any) { setStatus(`Error: ${e.message}`); }
    setUploading(false);
  }

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Corpus</span>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-2.5 py-1 rounded-md text-xs border" style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", cursor: uploading ? "wait" : "pointer" }}>+ Upload</button>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </div>
      <div className="flex-1 overflow-auto p-3" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}>
        {documents.length === 0 && !uploading && (
          <div className="flex flex-col items-center justify-center h-40 rounded-lg border-2 border-dashed text-center p-4" style={{ borderColor: "var(--border)" }}>
            <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>No documents loaded</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>Upload PDFs or drop here</div>
          </div>
        )}
        {documents.map((d) => (
          <div key={d.documentId} className="p-3 mb-2 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <div className="text-sm font-medium mb-1 break-words">{d.fileName}</div>
            <div className="flex gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
              <span>{d.chunkCount} chunks</span><span style={{ color: "var(--success)" }}>indexed</span>
            </div>
          </div>
        ))}
        {status && (
          <div className="p-3 rounded-lg border-2 border-dashed mt-2" style={{ borderColor: status.startsWith("Error") ? "var(--danger)" : "var(--accent)", background: "var(--bg-card)" }}>
            <div className="text-xs" style={{ color: status === "Indexed" ? "var(--success)" : status.startsWith("Error") ? "var(--danger)" : "var(--accent)" }}>{status}</div>
          </div>
        )}
      </div>
      <div className="px-3 py-3 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        <div>Runtime: Ollama (local)</div>
        <div>Chunks indexed: {totalChunks}</div>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="rounded-full" style={{ width: 6, height: 6, background: "var(--success)", boxShadow: "0 0 6px var(--success)" }} />
          <span style={{ color: "var(--success)" }}>Private / on-device</span>
        </div>
      </div>
    </>
  );
}
