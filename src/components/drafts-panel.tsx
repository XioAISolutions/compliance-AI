"use client";
import { useEffect, useState } from "react";
import { CitationRenderer } from "./citation-renderer";

export type DraftKind = "demand_letter" | "complaint" | "internal_memo" | "response_to_regulator";

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
  verification: { verified: boolean; overlap: number; significantTokens: number; matchedTokens: number };
  judge?: { supported: boolean; confidence: number; reasoning: string };
  claim: string;
}

interface DraftSection {
  id: string;
  heading: string;
  answer: string;
  citations: Citation[];
  invalidTagCount: number;
  verifiedRate: number;
  judgeSupportedRate: number | null;
}

interface Draft {
  id: string;
  matterId: string;
  kind: DraftKind;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  sections: DraftSection[];
  readiness: {
    signReady: boolean;
    verifiedRate: number;
    judgeSupportedRate: number | null;
    totalCitations: number;
    totalInvalidTags: number;
  };
}

const DRAFT_KIND_LABELS: Record<DraftKind, string> = {
  demand_letter: "Demand letter",
  complaint: "Complaint",
  internal_memo: "Internal memo",
  response_to_regulator: "Response to regulator",
};

export function DraftsPanel({ matterId, onOpenSource }: { matterId: string; onOpenSource?: (chunkId: string) => void }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [availableKinds, setAvailableKinds] = useState<DraftKind[]>([]);
  const [active, setActive] = useState<Draft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [kind, setKind] = useState<DraftKind>("demand_letter");
  const [judge, setJudge] = useState<"off" | "weak" | "on">("off");
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await fetch(`/api/matters/${matterId}/drafts`);
      if (r.ok) {
        const d = await r.json();
        setDrafts(d.drafts || []);
        setAvailableKinds(d.availableKinds || []);
        if (d.availableKinds?.length && !d.availableKinds.includes(kind)) {
          setKind(d.availableKinds[0]);
        }
      }
    } catch {}
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  async function generate() {
    setGenerating(true); setErr(null);
    try {
      const judgeArg = judge === "on" ? true : judge === "weak" ? "weak" : false;
      const r = await fetch(`/api/matters/${matterId}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, judge: judgeArg }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "Generation failed");
      }
      const d = await r.json();
      setActive(d.draft);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
    setGenerating(false);
  }

  return (
    <div className="flex h-full">
      <div className="flex flex-col border-r overflow-auto" style={{ width: 280, borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>New draft</div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as DraftKind)}
            className="w-full text-sm py-1 px-2 rounded bg-transparent border mb-2"
            style={{ borderColor: "var(--border)" }}
          >
            {availableKinds.map((k) => (
              <option key={k} value={k}>{DRAFT_KIND_LABELS[k]}</option>
            ))}
          </select>
          <div className="flex gap-1 mb-2 text-xs">
            <button onClick={() => setJudge("off")} className="flex-1 py-1 rounded border" style={chipStyle(judge === "off")}>No judge</button>
            <button onClick={() => setJudge("weak")} className="flex-1 py-1 rounded border" style={chipStyle(judge === "weak")}>Weak</button>
            <button onClick={() => setJudge("on")} className="flex-1 py-1 rounded border" style={chipStyle(judge === "on")}>On</button>
          </div>
          <button
            onClick={generate}
            disabled={generating || availableKinds.length === 0}
            className="w-full px-3 py-2 rounded-md text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff", opacity: generating ? 0.6 : 1 }}
          >
            {generating ? "Generating..." : "Generate draft"}
          </button>
          {err && <div className="text-xs mt-2" style={{ color: "var(--danger)" }}>{err}</div>}
        </div>

        <div className="px-3 py-2 text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Drafts ({drafts.length})</div>
        <div className="flex-1 overflow-auto px-3 pb-3">
          {drafts.length === 0 && <div className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>No drafts yet.</div>}
          {drafts.map((d) => {
            const isActive = active?.id === d.id;
            return (
              <button
                key={d.id}
                onClick={() => setActive(d)}
                className="w-full flex flex-col items-start p-2 mb-2 rounded-md border text-left"
                style={{ background: isActive ? "#1e3a5f" : "var(--bg-card)", borderColor: isActive ? "var(--accent)" : "var(--border)" }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-medium truncate">{d.displayName}</span>
                  <ReadinessPill readiness={d.readiness} />
                </div>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(d.updatedAt).toLocaleString()} · {d.readiness.totalCitations} cites
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {active ? (
          <DraftView matterId={matterId} draft={active} onOpenSource={onOpenSource} />
        ) : (
          <div className="p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Select a draft on the left, or generate a new one.
          </div>
        )}
      </div>
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--accent-dim)" : "transparent",
    borderColor: active ? "var(--accent)" : "var(--border)",
    color: active ? "var(--accent)" : "var(--text-muted)",
  };
}

function ReadinessPill({ readiness }: { readiness: Draft["readiness"] }) {
  const color = readiness.signReady ? "var(--success)" : readiness.totalInvalidTags > 0 ? "var(--danger)" : "var(--warning)";
  const label = readiness.signReady
    ? "Sign-ready"
    : readiness.totalInvalidTags > 0
    ? `${readiness.totalInvalidTags} invalid`
    : "Review";
  return (
    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--bg-primary)", color, border: `1px solid ${color}` }}>
      {label}
    </span>
  );
}

function DraftView({ matterId, draft, onOpenSource }: { matterId: string; draft: Draft; onOpenSource?: (chunkId: string) => void }) {
  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">{draft.displayName}</h2>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Created {new Date(draft.createdAt).toLocaleString()} · {draft.readiness.totalCitations} citations · verify {Math.round(draft.readiness.verifiedRate * 100)}%
              {draft.readiness.judgeSupportedRate !== null && (
                <> · judge {Math.round(draft.readiness.judgeSupportedRate * 100)}%</>
              )}
            </div>
          </div>
          <a
            href={`/api/matters/${matterId}/drafts/${draft.id}?format=markdown`}
            className="text-xs px-3 py-1 rounded border"
            style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
          >
            Export .md
          </a>
        </div>
        {draft.sections.map((s) => (
          <div key={s.id} className="mb-6 p-4 rounded-lg border" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>{s.heading}</h3>
              <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>{s.citations.length} cites</span>
                {s.invalidTagCount > 0 && <span style={{ color: "var(--danger)" }}>{s.invalidTagCount} invalid</span>}
                <span>verify {Math.round(s.verifiedRate * 100)}%</span>
                {s.judgeSupportedRate !== null && <span>judge {Math.round(s.judgeSupportedRate * 100)}%</span>}
              </div>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              <CitationRenderer
                text={s.answer}
                citations={s.citations}
                onOpen={(chunkId) => onOpenSource?.(chunkId)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
