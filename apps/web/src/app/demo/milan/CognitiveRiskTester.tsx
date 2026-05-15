"use client";

/**
 * CognitiveRiskTester — the proof that BrainSNN scoring is computation,
 * not decoration. A judge pastes any text and watches the four
 * dimensions + composite update against POST /api/demo/milan/cognitive-risk.
 *
 * Once a score lands, the "Rewrite via Featherless" button appears.
 * Clicking it routes the same text through Featherless (POST
 * /api/demo/milan/rewrite) for safer-language edits, re-scores the
 * concatenated rewrite, and shows the before/after risk pair so the
 * full proof loop runs in one click — measure → rewrite → re-measure.
 */

import { useState, useTransition } from "react";

interface Dimensions {
  emotionalActivation: number;
  certaintyPressure: number;
  trustErosion: number;
  urgencyCompression: number;
}

interface RiskResult {
  score: number;
  dimensions: Dimensions;
  inputLength: number;
}

interface RewriteResult {
  before: { text: string; cognitiveRisk: { score: number; dimensions: Dimensions } };
  after: { text: string; cognitiveRisk: { score: number; dimensions: Dimensions } };
  redline: {
    source: "featherless" | "deterministic";
    model: string;
    latencyMs: number;
    edits: Array<{ before: string; after: string; reason: string }>;
    error?: string;
  };
  delta: { score: number; dimensions: Dimensions };
}

const SAMPLES: ReadonlyArray<{ label: string; text: string }> = [
  {
    label: "Neutral disclosure",
    text: "The board reviewed Q3 results. Performance varies with market conditions and past performance is not indicative of future results. All material risk factors are disclosed in section 4 of the offering memorandum.",
  },
  {
    label: "Investor pressure pitch",
    text: "Protected returns. Guaranteed performance — our model is risk-free. Limited spots remain in this round. Closing today. You need to act now before the round closes. Only a few seats left. Our AI reviews everything in seconds — instant approval, no paperwork.",
  },
  {
    label: "Soft urgency marketing",
    text: "Early access available now. Sign up today and get priority onboarding. Limited time enrollment window — closes Friday.",
  },
];

export function CognitiveRiskTester({ initialText }: { initialText: string }) {
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [rewrite, setRewrite] = useState<RewriteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scoring, startScoring] = useTransition();
  const [rewriting, startRewriting] = useTransition();

  const score = async (input: string) => {
    setError(null);
    setRewrite(null);
    try {
      const res = await fetch("/api/demo/milan/cognitive-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const body = (await res.json()) as RiskResult | { error: string };
      if (!res.ok) {
        setError("error" in body ? body.error : `Request failed (${res.status})`);
        return;
      }
      if ("score" in body) setResult(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
  };

  const runRewrite = async (input: string) => {
    setError(null);
    try {
      const res = await fetch("/api/demo/milan/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input }),
      });
      const body = (await res.json()) as RewriteResult | { error: string };
      if (!res.ok) {
        setError("error" in body ? body.error : `Rewrite failed (${res.status})`);
        return;
      }
      if ("before" in body) setRewrite(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rewrite network error");
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-neutral-500">
          Try BrainSNN yourself
        </p>
        <span className="text-[10px] font-medium uppercase tracking-wider text-cyan-300">
          live · POST
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-neutral-400">
        Paste any deck paragraph, sales-call line, or marketing claim. Score moves with the text.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {SAMPLES.map((sample) => (
          <button
            key={sample.label}
            type="button"
            onClick={() => {
              setText(sample.text);
              startScoring(() => {
                void score(sample.text);
              });
            }}
            className="rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-xs font-medium text-neutral-300 transition hover:border-cyan-300/40 hover:text-cyan-100"
          >
            {sample.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="mt-5 w-full resize-y rounded-xl border border-white/[0.08] bg-neutral-950 p-3 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-cyan-300/40 focus:outline-none"
        placeholder="Paste deck text, transcript line, or claim…"
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              startScoring(() => {
                void score(text);
              })
            }
            disabled={scoring || text.trim().length === 0}
            className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scoring ? "Scoring…" : "Score"}
          </button>
          {result && (
            <button
              type="button"
              onClick={() =>
                startRewriting(() => {
                  void runRewrite(text);
                })
              }
              disabled={rewriting || text.trim().length === 0}
              className="rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300/40 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Route this text through Featherless, then re-score."
            >
              {rewriting ? "Rewriting…" : "Rewrite via Featherless →"}
            </button>
          )}
        </div>
        <span className="font-mono text-[11px] text-neutral-500">{text.length} chars</span>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/[0.06] p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div>
            <div className="text-5xl font-semibold tracking-tight text-rose-300">
              {result.score}
            </div>
            <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">
              composite
            </div>
          </div>
          <div className="space-y-3">
            <Bar label="Emotional activation" value={result.dimensions.emotionalActivation} />
            <Bar label="Certainty pressure" value={result.dimensions.certaintyPressure} />
            <Bar label="Trust erosion" value={result.dimensions.trustErosion} />
            <Bar label="Urgency compression" value={result.dimensions.urgencyCompression} />
          </div>
        </div>
      )}

      {rewrite && (
        <div className="mt-8 border-t border-white/[0.06] pt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-cyan-300">
              Featherless rewrite · {rewrite.redline.source}
            </p>
            <p className="font-mono text-[11px] text-neutral-500">
              {rewrite.redline.model} · {rewrite.redline.latencyMs}ms ·{" "}
              {rewrite.redline.edits.length} edits
            </p>
          </div>

          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <BeforeAfterCard label="Before" risk={rewrite.before.cognitiveRisk} tone="rose" />
            <BeforeAfterCard
              label="After"
              risk={rewrite.after.cognitiveRisk}
              tone="emerald"
              delta={rewrite.delta.score}
            />
          </div>

          <div className="mt-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">
              Safer-language passage
            </p>
            <p className="mt-2 text-sm leading-relaxed text-neutral-200">{rewrite.after.text}</p>
          </div>

          {rewrite.redline.edits.length > 0 && (
            <details className="mt-5 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-neutral-400 transition hover:text-neutral-100">
                Show {rewrite.redline.edits.length} edit{rewrite.redline.edits.length !== 1 ? "s" : ""}
              </summary>
              <ul className="mt-3 space-y-4">
                {rewrite.redline.edits.map((edit, i) => (
                  <li key={i} className="border-l border-cyan-300/30 pl-3 text-xs leading-relaxed">
                    <div className="text-rose-200">− {edit.before}</div>
                    <div className="mt-1 text-emerald-200">+ {edit.after}</div>
                    <div className="mt-1 italic text-neutral-500">{edit.reason}</div>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function BeforeAfterCard({
  label,
  risk,
  tone,
  delta,
}: {
  label: string;
  risk: { score: number; dimensions: Dimensions };
  tone: "rose" | "emerald";
  delta?: number;
}) {
  const scoreColor = tone === "rose" ? "text-rose-300" : "text-emerald-300";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-neutral-500">
          {label}
        </p>
        {typeof delta === "number" && delta !== 0 && (
          <p className="font-mono text-xs text-emerald-300">
            {delta > 0 ? `−${delta}` : `+${Math.abs(delta)}`}
          </p>
        )}
      </div>
      <div className={`mt-2 text-4xl font-semibold tracking-tight ${scoreColor}`}>
        {risk.score}
      </div>
      <div className="mt-4 space-y-2">
        <Bar label="Emotional" value={risk.dimensions.emotionalActivation} />
        <Bar label="Certainty" value={risk.dimensions.certaintyPressure} />
        <Bar label="Trust" value={risk.dimensions.trustErosion} />
        <Bar label="Urgency" value={risk.dimensions.urgencyCompression} />
      </div>
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px]">
        <span className="text-neutral-400">{label}</span>
        <span className="font-mono text-neutral-500">{clamped}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-cyan-300/80" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
