"use client";
import { useEffect, useMemo, useState } from "react";
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
  verification: { verified: boolean; overlap: number; significantTokens: number; matchedTokens: number };
  judge?: { supported: boolean; confidence: number; reasoning: string };
  claim: string;
}

interface TriageElement {
  text: string;
  supportingFactChunks: {
    chunkId: string;
    fileName: string;
    sectionNumber: string | null;
    pageNumber: number;
    excerpt: string;
    verified: boolean;
    overlap: number;
  }[];
  supportRatio: number;
}

interface CauseOfAction {
  id: string;
  statuteTag: string;
  documentId: string;
  fileName: string;
  sectionNumber: string | null;
  sectionHeader: string | null;
  jurisdiction: string | null;
  anchorChunkId: string;
  anchorAuthorityWeight: number;
  elements: TriageElement[];
  score: number;
  narrative: string;
  citations: Citation[];
  readiness: { verifiedRate: number; judgeSupportedRate: number | null; invalidTagCount: number };
}

interface TriageResult {
  id: string;
  matterId: string;
  createdAt: string;
  causes: CauseOfAction[];
  stats: {
    statuteChunksConsidered: number;
    candidatesExplored: number;
    judgeUsed: boolean | "weak";
  };
}

export function TriagePanel({
  matterId,
  onOpenSource,
}: {
  matterId: string;
  onOpenSource?: (chunkId: string) => void;
}) {
  const [runs, setRuns] = useState<TriageResult[]>([]);
  const [active, setActive] = useState<TriageResult | null>(null);
  const [running, setRunning] = useState(false);
  const [judge, setJudge] = useState<"off" | "weak" | "on">("off");
  const [authorityBoost, setAuthorityBoost] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      const r = await fetch(`/api/matters/${matterId}/triage`);
      if (r.ok) {
        const d = await r.json();
        setRuns(d.runs || []);
        if (!active && d.runs?.length > 0) setActive(d.runs[0]);
      }
    } catch {}
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matterId]);

  async function runTriage() {
    setRunning(true); setErr(null);
    try {
      const judgeArg = judge === "on" ? true : judge === "weak" ? "weak" : false;
      const r = await fetch(`/api/matters/${matterId}/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ judge: judgeArg, authorityBoost }),
      });
      if (!r.ok) {
        const e = await r.json();
        throw new Error(e.error || "Triage failed");
      }
      const d = await r.json();
      setActive(d.result);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    }
    setRunning(false);
  }

  return (
    <div className="flex h-full">
      <div
        className="flex flex-col border-r overflow-auto"
        style={{ width: 280, borderColor: "var(--border)", background: "var(--bg-secondary)" }}
      >
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>
            New triage run
          </div>
          <div className="flex gap-1 mb-2 text-xs">
            <button onClick={() => setJudge("off")} className="flex-1 py-1 rounded border" style={chipStyle(judge === "off")}>No judge</button>
            <button onClick={() => setJudge("weak")} className="flex-1 py-1 rounded border" style={chipStyle(judge === "weak")}>Weak</button>
            <button onClick={() => setJudge("on")} className="flex-1 py-1 rounded border" style={chipStyle(judge === "on")}>On</button>
          </div>
          <button
            onClick={() => setAuthorityBoost(!authorityBoost)}
            className="w-full py-1 mb-2 rounded border text-xs"
            title="Rank retrieval by authority weight (statute > regulation > caselaw > client docs)"
            style={chipStyle(authorityBoost)}
          >
            {authorityBoost ? "Authority boost on" : "Authority boost off"}
          </button>
          <button
            onClick={runTriage}
            disabled={running}
            className="w-full px-3 py-2 rounded-md text-sm font-semibold"
            style={{ background: "var(--accent)", color: "#fff", opacity: running ? 0.6 : 1 }}
          >
            {running ? "Running..." : "Run triage"}
          </button>
          {err && <div className="text-xs mt-2" style={{ color: "var(--danger)" }}>{err}</div>}
          <div className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            Uses the matter&apos;s intake and statute libraries to enumerate candidate causes of action.
          </div>
        </div>

        <div className="px-3 py-2 text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Runs ({runs.length})
        </div>
        <div className="flex-1 overflow-auto px-3 pb-3">
          {runs.length === 0 && (
            <div className="text-xs py-4 text-center" style={{ color: "var(--text-muted)" }}>No runs yet.</div>
          )}
          {runs.map((r) => {
            const isActive = active?.id === r.id;
            return (
              <button
                key={r.id}
                onClick={() => setActive(r)}
                className="w-full flex flex-col items-start p-2 mb-2 rounded-md border text-left"
                style={{ background: isActive ? "#1e3a5f" : "var(--bg-card)", borderColor: isActive ? "var(--accent)" : "var(--border)" }}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-sm font-medium">{r.causes.length} cause{r.causes.length === 1 ? "" : "s"}</span>
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {r.stats.judgeUsed ? "judged" : "lexical"}
                  </span>
                </div>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {new Date(r.createdAt).toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {active ? (
          <TriageView run={active} onOpenSource={onOpenSource} />
        ) : (
          <div className="p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Run triage, or select a previous run on the left.
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

function TriageView({
  run,
  onOpenSource,
}: {
  run: TriageResult;
  onOpenSource?: (chunkId: string) => void;
}) {
  if (run.causes.length === 0) {
    return (
      <div className="p-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        No causes of action surfaced for this intake. Check the intake narrative and confirm the matter is linked to a statute library.
      </div>
    );
  }
  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Triage results</h2>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            {new Date(run.createdAt).toLocaleString()} · {run.stats.candidatesExplored} candidate{run.stats.candidatesExplored === 1 ? "" : "s"} from {run.stats.statuteChunksConsidered} statute chunks
          </div>
        </div>
        {run.causes.map((c, i) => (
          <CauseCard key={c.id} cause={c} rank={i + 1} onOpenSource={onOpenSource} />
        ))}
      </div>
    </div>
  );
}

function CauseCard({
  cause,
  rank,
  onOpenSource,
}: {
  cause: CauseOfAction;
  rank: number;
  onOpenSource?: (chunkId: string) => void;
}) {
  const [showNarrative, setShowNarrative] = useState(rank === 1);
  const meanSupport = useMemo(() =>
    cause.elements.length > 0
      ? cause.elements.reduce((n, e) => n + e.supportRatio, 0) / cause.elements.length
      : 0,
    [cause.elements],
  );
  const scoreColor = cause.score >= 0.5 ? "var(--success)" : cause.score >= 0.2 ? "var(--warning)" : "var(--danger)";
  return (
    <div className="mb-5 rounded-lg border overflow-hidden" style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: "var(--border)" }}>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ background: "var(--bg-primary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>#{rank}</span>
            <h3 className="text-sm font-semibold">{cause.statuteTag}</h3>
          </div>
          <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {cause.sectionHeader ?? "no heading detected"}
            {cause.jurisdiction ? ` · ${cause.jurisdiction}` : ""}
            {` · authority ${cause.anchorAuthorityWeight.toFixed(2)}`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>score</div>
          <div className="text-lg font-semibold" style={{ color: scoreColor }}>
            {cause.score.toFixed(2)}
          </div>
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            support {Math.round(meanSupport * 100)}%
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>
          Elements ({cause.elements.length})
        </div>
        {cause.elements.length === 0 && (
          <div className="text-xs" style={{ color: "var(--text-muted)" }}>
            No distinct elements parsed from the statute anchor.
          </div>
        )}
        <ul className="space-y-2">
          {cause.elements.map((el, i) => (
            <ElementRow key={i} element={el} onOpenSource={onOpenSource} />
          ))}
        </ul>

        {cause.narrative.trim().length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowNarrative((s) => !s)}
              className="text-xs"
              style={{ color: "var(--accent)" }}
            >
              {showNarrative ? "Hide" : "Show"} narrative
            </button>
            {showNarrative && (
              <div className="mt-2 p-3 rounded border" style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}>
                <div className="flex items-center gap-3 mb-2 text-xs" style={{ color: "var(--text-muted)" }}>
                  <span>{cause.citations.length} cites</span>
                  {cause.readiness.invalidTagCount > 0 && (
                    <span style={{ color: "var(--danger)" }}>{cause.readiness.invalidTagCount} invalid</span>
                  )}
                  <span>verify {Math.round(cause.readiness.verifiedRate * 100)}%</span>
                  {cause.readiness.judgeSupportedRate !== null && (
                    <span>judge {Math.round(cause.readiness.judgeSupportedRate * 100)}%</span>
                  )}
                </div>
                <div className="text-sm leading-relaxed">
                  <CitationRenderer
                    text={cause.narrative}
                    citations={cause.citations}
                    onOpen={(chunkId) => onOpenSource?.(chunkId)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ElementRow({
  element,
  onOpenSource,
}: {
  element: TriageElement;
  onOpenSource?: (chunkId: string) => void;
}) {
  const pctColor = element.supportRatio >= 0.5 ? "var(--success)" : element.supportRatio > 0 ? "var(--warning)" : "var(--danger)";
  return (
    <li className="p-2 rounded border" style={{ borderColor: "var(--border)", background: "var(--bg-primary)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm flex-1">{element.text}</div>
        <span className="text-xs whitespace-nowrap" style={{ color: pctColor }}>
          {Math.round(element.supportRatio * 100)}% support
        </span>
      </div>
      {element.supportingFactChunks.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {element.supportingFactChunks.map((s) => (
            <button
              key={s.chunkId}
              onClick={() => onOpenSource?.(s.chunkId)}
              className="text-xs px-1.5 py-0.5 rounded border"
              title={s.excerpt}
              style={{
                borderColor: s.verified ? "var(--success)" : "var(--border)",
                color: s.verified ? "var(--success)" : "var(--text-muted)",
                background: "transparent",
              }}
            >
              {s.fileName}{s.sectionNumber ? ` §${s.sectionNumber}` : ` p.${s.pageNumber}`}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
