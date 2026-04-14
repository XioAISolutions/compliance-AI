"use client";
import { useEffect, useState } from "react";
import { Chat } from "./chat";
import { IntakePanel } from "./intake-panel";
import { DraftsPanel } from "./drafts-panel";
import { MatterSelector, type MatterSummary } from "./matter-selector";
import { SourceViewer } from "./source-viewer";

type Tab = "chat" | "intake" | "triage" | "drafts";

interface MatterDetail {
  matter: MatterSummary & {
    jurisdiction?: string;
    statuteCorpusIds: string[];
    notes?: string;
    createdAt: string;
  };
  documents: { documentId: string; fileName: string; chunkCount: number; docType?: string }[];
  chunkCount: number;
}

const TABS: { id: Tab; label: string; enabled: boolean }[] = [
  { id: "chat", label: "Chat", enabled: true },
  { id: "intake", label: "Intake", enabled: true },
  { id: "triage", label: "Triage", enabled: false },
  { id: "drafts", label: "Drafts", enabled: true },
];

export function MatterWorkspace({ matterId }: { matterId: string }) {
  const [matters, setMatters] = useState<MatterSummary[]>([]);
  const [detail, setDetail] = useState<MatterDetail | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [draftSourceChunkId, setDraftSourceChunkId] = useState<string | null>(null);
  const [showDraftSource, setShowDraftSource] = useState(false);

  async function refreshMatters() {
    try {
      const r = await fetch("/api/matters");
      if (r.ok) {
        const d = await r.json();
        setMatters(d.matters || []);
      }
    } catch {}
  }
  async function refreshDetail() {
    try {
      const r = await fetch(`/api/matters/${matterId}`);
      if (r.ok) {
        setDetail(await r.json());
      }
    } catch {}
  }

  useEffect(() => {
    refreshMatters();
  }, []);
  useEffect(() => {
    refreshDetail();
  }, [matterId]);

  const matter = detail?.matter;

  return (
    <div className="flex h-screen">
      <div className="flex flex-col border-r overflow-auto" style={{ width: 280, borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <MatterSelector matters={matters} activeId={matterId} onCreated={refreshMatters} />
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
          <div>
            <div className="text-sm font-semibold">{matter?.displayName ?? matterId}</div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              {matter ? (
                <>
                  {matter.persona.replace("_", " ")}
                  {matter.jurisdiction ? ` · ${matter.jurisdiction}` : ""}
                  {matter.isLibrary ? " · library" : ""}
                  {detail ? ` · ${detail.documents.length} docs / ${detail.chunkCount} chunks` : ""}
                </>
              ) : "Loading matter..."}
            </div>
          </div>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => t.enabled && setTab(t.id)}
                disabled={!t.enabled}
                className="px-3 py-1 rounded-md text-xs border"
                style={{
                  background: tab === t.id ? "var(--accent-dim)" : "transparent",
                  borderColor: tab === t.id ? "var(--accent)" : "var(--border)",
                  color: tab === t.id ? "var(--accent)" : t.enabled ? "var(--text-secondary)" : "var(--text-muted)",
                  opacity: t.enabled ? 1 : 0.5,
                  cursor: t.enabled ? "pointer" : "not-allowed",
                }}
                title={t.enabled ? t.label : `${t.label} (Phase 2)`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </header>

        <div className="flex-1 overflow-hidden">
          {tab === "chat" && <Chat matterId={matterId} embedded />}
          {tab === "intake" && <IntakePanel matterId={matterId} />}
          {tab === "drafts" && (
            <div className="flex h-full">
              <div className="flex-1 min-w-0">
                <DraftsPanel matterId={matterId} onOpenSource={(id) => { setDraftSourceChunkId(id); setShowDraftSource(true); }} />
              </div>
              {showDraftSource && (
                <div className="flex flex-col border-l" style={{ width: 340, borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                  <SourceViewer chunkId={draftSourceChunkId} onClose={() => setShowDraftSource(false)} onOpenChunk={setDraftSourceChunkId} />
                </div>
              )}
            </div>
          )}
          {tab === "triage" && (
            <div className="p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Triage panel ships in Phase 2.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
