"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { DocumentLibrary } from "./document-library";
import { SourceViewer } from "./source-viewer";
import { CitationBadge } from "./citation-badge";
import { CitationRenderer } from "./citation-renderer";

interface Citation {
  id: string;
  chunkId: string;
  fileName: string;
  pageNumber: number;
  section: string | null;
  sectionNumber: string | null;
  sectionPath: string[];
  excerpt: string;
  confidence: number;
  vectorScore: number;
  bm25Score: number;
}
interface Message { id: string; role: "user" | "assistant"; content: string; citations?: Citation[]; model?: string; queryTimeMs?: number; streaming?: boolean; }
interface DocInfo { documentId: string; fileName: string; chunkCount: number; }

const SUGGESTED = [
  "What are the consent requirements under PIPEDA?",
  "When must a breach be reported to the Commissioner?",
  "What are the third-party outsourcing requirements?",
  "How do breach notification and technology risk management interact?",
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocInfo[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);
  const [showDocs, setShowDocs] = useState(true);
  const [showSource, setShowSource] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { refreshDocs(); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isStreaming]);

  async function refreshDocs() {
    try { const r = await fetch("/api/sources"); if (r.ok) { const d = await r.json(); setDocuments(d.documents || []); setTotalChunks(d.totalChunks || 0); } } catch {}
  }

  async function handleUpload(file: File) {
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
    return r.json();
  }

  const sendMessage = useCallback(async (text?: string) => {
    const q = text || input.trim();
    if (!q || isStreaming) return;
    setInput("");

    const uid = `u-${Date.now()}`, aid = `a-${Date.now()}`;
    setMessages((p) => [...p, { id: uid, role: "user", content: q }, { id: aid, role: "assistant", content: "", streaming: true }]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
      if (!res.ok) throw new Error("Request failed");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No stream");

      let full = "", cits: Citation[] = [], model = "", ms = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const p = line.slice(6).trim();
          if (p === "[DONE]") continue;
          try {
            const c = JSON.parse(p);
            if (c.type === "text") { full += c.data; setMessages((prev) => prev.map((m) => m.id === aid ? { ...m, content: full } : m)); }
            else if (c.type === "citations") cits = c.data;
            else if (c.type === "meta") { model = c.data.model; ms = c.data.queryTimeMs; }
          } catch {}
        }
      }
      setMessages((prev) => prev.map((m) => m.id === aid ? { ...m, content: full, citations: cits, model, queryTimeMs: ms, streaming: false } : m));
    } catch {
      setMessages((prev) => prev.map((m) => m.id === aid ? { ...m, content: "Failed. Is Ollama running?", streaming: false } : m));
    }
    setIsStreaming(false);
  }, [input, isStreaming]);

  return (
    <div className="flex h-screen">
      {showDocs && <div className="flex flex-col border-r" style={{ width: 260, borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <DocumentLibrary documents={documents} totalChunks={totalChunks} onUpload={handleUpload} onRefresh={refreshDocs} />
      </div>}

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center rounded-lg text-lg font-bold" style={{ width: 34, height: 34, background: "linear-gradient(135deg, #1e3a5f, #3b82f6)" }}>C</div>
            <div><div className="text-sm font-semibold">Compliance AI</div><div className="text-xs" style={{ color: "var(--text-muted)" }}>Citation-first private assistant</div></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowDocs(!showDocs)} className="px-3 py-1 rounded-md text-xs border" style={{ background: showDocs ? "var(--accent-dim)" : "transparent", borderColor: showDocs ? "var(--accent)" : "var(--border)", color: "var(--text-secondary)" }}>Corpus</button>
            <button onClick={() => setShowSource(!showSource)} className="px-3 py-1 rounded-md text-xs border" style={{ background: showSource ? "var(--accent-dim)" : "transparent", borderColor: showSource ? "var(--accent)" : "var(--border)", color: "var(--text-secondary)" }}>Sources</button>
          </div>
        </header>

        <div className="flex-1 overflow-auto px-5 py-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full gap-5">
              <div className="flex items-center justify-center rounded-2xl text-3xl font-bold" style={{ width: 64, height: 64, background: "linear-gradient(135deg, #1e3a5f, #3b82f6)" }}>C</div>
              <div className="text-center">
                <div className="text-lg font-semibold mb-1">Private Compliance Assistant</div>
                <div className="text-sm max-w-md" style={{ color: "var(--text-muted)" }}>Ask questions about your compliance documents. Every answer includes source citations.</div>
              </div>
              <div className="flex flex-col gap-2 w-full max-w-lg">
                {SUGGESTED.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)} className="px-4 py-3 rounded-lg text-sm text-left border transition-colors hover:border-blue-500" style={{ background: "var(--bg-card)", borderColor: "var(--border)", color: "var(--text-secondary)" }}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="mb-4 animate-slide-up">
              {msg.role === "user" ? (
                <div className="flex justify-end"><div className="max-w-3/4 px-4 py-3 text-sm leading-relaxed" style={{ background: "#1e3a5f", borderRadius: "14px 14px 4px 14px" }}>{msg.content}</div></div>
              ) : (
                <div style={{ maxWidth: "85%" }}>
                  <div className="px-4 py-3 text-sm leading-relaxed border" style={{ background: "var(--bg-card)", borderColor: "var(--border)", borderRadius: "4px 14px 14px 14px" }}>
                    <div className="whitespace-pre-wrap">
                      <CitationRenderer
                        text={msg.content}
                        citations={msg.citations ?? []}
                        onOpen={(chunkId) => { setSelectedChunkId(chunkId); setShowSource(true); }}
                      />
                      {msg.streaming && <span className="inline-block ml-0.5 rounded-sm" style={{ width: 8, height: 16, background: "var(--accent)", animation: "blink 1s infinite" }} />}
                    </div>
                    {!msg.streaming && msg.citations && msg.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                        <div className="text-xs mb-2 uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Sources</div>
                        {msg.citations.map((c) => (
                          <button key={c.id} onClick={() => { setSelectedChunkId(c.chunkId); setShowSource(true); }}
                            className="flex items-center gap-2 w-full px-3 py-2 mb-1 rounded-md text-left border transition-colors"
                            style={{ background: selectedChunkId === c.chunkId ? "#1e3a5f" : "var(--bg-primary)", borderColor: selectedChunkId === c.chunkId ? "var(--accent)" : "var(--border)", fontSize: 13 }}>
                            <span className="font-mono font-bold text-xs" style={{ color: "var(--accent)" }}>{c.id}</span>
                            <span className="flex-1 truncate">{c.sectionPath.length > 0 ? c.sectionPath[c.sectionPath.length - 1] : c.fileName}</span>
                            <span className="text-xs" style={{ color: "var(--text-muted)" }}>p.{c.pageNumber}</span>
                            <CitationBadge confidence={c.vectorScore} />
                          </button>
                        ))}
                      </div>
                    )}
                    {!msg.streaming && msg.model && (
                      <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                        <span>{msg.model}</span>
                        {msg.queryTimeMs && <span>{msg.queryTimeMs}ms</span>}
                        <div className="flex items-center gap-1">
                          <div className="rounded-full" style={{ width: 6, height: 6, background: "var(--success)", boxShadow: "0 0 6px var(--success)" }} />
                          <span style={{ color: "var(--success)" }}>Local</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="px-4 py-3 border-t" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div className="flex items-center gap-2 rounded-xl border px-4" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask about your compliance documents..." disabled={isStreaming}
              className="flex-1 bg-transparent border-none outline-none text-sm py-3" style={{ color: "var(--text-primary)" }} />
            <button onClick={() => sendMessage()} disabled={isStreaming || !input.trim()}
              className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{ background: input.trim() && !isStreaming ? "var(--accent)" : "var(--border)", color: input.trim() && !isStreaming ? "#fff" : "var(--text-muted)" }}>Send</button>
          </div>
          <div className="flex justify-between mt-1.5 px-1 text-xs" style={{ color: "var(--text-muted)" }}>
            <span>All processing runs locally. No data leaves this device.</span>
            <span>Powered by XIO AI</span>
          </div>
        </div>
      </div>

      {showSource && <div className="flex flex-col border-l" style={{ width: 340, borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <SourceViewer chunkId={selectedChunkId} onClose={() => setShowSource(false)} onOpenChunk={setSelectedChunkId} />
      </div>}
    </div>
  );
}
