"use client";
import { useState, useRef } from "react";

export type DocType =
  | "statute" | "regulation" | "caselaw"
  | "contract" | "client_facts" | "correspondence"
  | "form" | "unknown";

interface DocInfo {
  documentId: string;
  fileName: string;
  chunkCount: number;
  matterId?: string;
  docType?: DocType;
}
interface GraphStats { nodeCount: number; edgeCount: number; resolvedRefs: number; unresolvedRefs: number; unresolvedSamples: { phrase: string; fromChunkId: string; fileName: string }[]; }

const DOC_TYPE_OPTIONS: { id: DocType; label: string; color: string }[] = [
  { id: "statute",        label: "Statute",        color: "#3b82f6" },
  { id: "regulation",     label: "Regulation",     color: "#6366f1" },
  { id: "caselaw",        label: "Case law",       color: "#8b5cf6" },
  { id: "contract",       label: "Contract",       color: "#0ea5e9" },
  { id: "correspondence", label: "Correspondence", color: "#14b8a6" },
  { id: "client_facts",   label: "Client facts",   color: "#10b981" },
  { id: "form",           label: "Form",           color: "#64748b" },
  { id: "unknown",        label: "Unknown",        color: "#475569" },
];

function badgeFor(docType: DocType | undefined) {
  const opt = DOC_TYPE_OPTIONS.find((o) => o.id === docType) ?? DOC_TYPE_OPTIONS[DOC_TYPE_OPTIONS.length - 1];
  return opt;
}

export function DocumentLibrary({
  documents,
  totalChunks,
  graphStats,
  onUpload,
  onRefresh,
  allowTypeSelection = true,
  allowFiltering = true,
}: {
  documents: DocInfo[];
  totalChunks: number;
  graphStats: GraphStats | null;
  onUpload: (file: File, meta: { docType: DocType }) => Promise<any>;
  onRefresh: () => void;
  allowTypeSelection?: boolean;
  allowFiltering?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [uploadDocType, setUploadDocType] = useState<DocType>("unknown");
  const [filter, setFilter] = useState<DocType | "all">("all");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) { setStatus("Only PDFs"); return; }
    setUploading(true); setStatus("Parsing...");
    try {
      setTimeout(() => setStatus("Chunking..."), 1500);
      setTimeout(() => setStatus("Embedding..."), 3000);
      const res = await onUpload(file, { docType: uploadDocType });
      // If the user left the type as "unknown", the server may have
      // auto-classified. Surface that so the user can confirm or reject.
      const autoDocType: DocType | undefined = res?.docType;
      const classification = res?.classification as { docType: DocType; confidence: number; method: string } | null | undefined;
      if (uploadDocType === "unknown" && classification && autoDocType && autoDocType !== "unknown") {
        const label = DOC_TYPE_OPTIONS.find((o) => o.id === autoDocType)?.label ?? autoDocType;
        setStatus(`Indexed as ${label} (${Math.round(classification.confidence * 100)}%)`);
      } else {
        setStatus("Indexed");
      }
      onRefresh();
      setTimeout(() => setStatus(null), 3000);
    } catch (e: any) { setStatus(`Error: ${e.message}`); }
    setUploading(false);
  }

  const filtered = filter === "all" ? documents : documents.filter((d) => (d.docType ?? "unknown") === filter);

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>Corpus</span>
        <button onClick={() => fileRef.current?.click()} disabled={uploading}
          className="px-2.5 py-1 rounded-md text-xs border" style={{ background: "var(--accent-dim)", borderColor: "var(--accent)", color: "var(--accent)", cursor: uploading ? "wait" : "pointer" }}>+ Upload</button>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </div>

      {allowTypeSelection && (
        <div className="px-3 pt-2 pb-1 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>Upload as:</div>
          <select
            value={uploadDocType}
            onChange={(e) => setUploadDocType(e.target.value as DocType)}
            className="w-full text-xs py-1 px-2 rounded bg-transparent border"
            style={{ borderColor: "var(--border)" }}
            disabled={uploading}
          >
            {DOC_TYPE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {allowFiltering && documents.length > 0 && (
        <div className="px-3 pt-2 pb-1 border-b overflow-x-auto" style={{ borderColor: "var(--border)" }}>
          <div className="flex gap-1 flex-wrap">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="All" color="#3b82f6" />
            {DOC_TYPE_OPTIONS.map((o) => (
              <FilterChip
                key={o.id}
                active={filter === o.id}
                onClick={() => setFilter(o.id)}
                label={o.label}
                color={o.color}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}>
        {filtered.length === 0 && !uploading && (
          <div className="flex flex-col items-center justify-center h-40 rounded-lg border-2 border-dashed text-center p-4" style={{ borderColor: "var(--border)" }}>
            <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
              {documents.length === 0 ? "No documents loaded" : "No documents match filter"}
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {documents.length === 0 ? "Upload PDFs or drop here" : "Try 'All'"}
            </div>
          </div>
        )}
        {filtered.map((d) => {
          const b = badgeFor(d.docType);
          return (
            <div key={d.documentId} className="p-3 mb-2 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="text-sm font-medium break-words flex-1">{d.fileName}</div>
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: b.color + "33", color: b.color, whiteSpace: "nowrap" }}>{b.label}</span>
              </div>
              <div className="flex gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>{d.chunkCount} chunks</span><span style={{ color: "var(--success)" }}>indexed</span>
              </div>
            </div>
          );
        })}
        {status && (
          <div className="p-3 rounded-lg border-2 border-dashed mt-2" style={{ borderColor: status.startsWith("Error") ? "var(--danger)" : "var(--accent)", background: "var(--bg-card)" }}>
            <div className="text-xs" style={{ color: status === "Indexed" ? "var(--success)" : status.startsWith("Error") ? "var(--danger)" : "var(--accent)" }}>{status}</div>
          </div>
        )}
      </div>
      <div className="px-3 py-3 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
        <div>Runtime: Ollama (local)</div>
        <div>Chunks indexed: {totalChunks}</div>
        {graphStats && (
          <>
            <div className="mt-1">Graph: {graphStats.nodeCount} nodes / {graphStats.edgeCount} edges</div>
            <div className="flex items-center gap-2 mt-1">
              <span style={{ color: "var(--success)" }}>{graphStats.resolvedRefs} resolved</span>
              <span style={{ color: graphStats.unresolvedRefs > 0 ? "var(--warning)" : "var(--text-muted)" }} title={graphStats.unresolvedSamples.map((s) => `${s.phrase} (${s.fileName})`).join("\n")}>
                {graphStats.unresolvedRefs} unresolved
              </span>
            </div>
          </>
        )}
        <div className="flex items-center gap-1.5 mt-2">
          <div className="rounded-full" style={{ width: 6, height: 6, background: "var(--success)", boxShadow: "0 0 6px var(--success)" }} />
          <span style={{ color: "var(--success)" }}>Private / on-device</span>
        </div>
      </div>
    </>
  );
}

function FilterChip({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color: string }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-0.5 rounded border"
      style={{
        background: active ? color + "33" : "transparent",
        borderColor: active ? color : "var(--border)",
        color: active ? color : "var(--text-muted)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
