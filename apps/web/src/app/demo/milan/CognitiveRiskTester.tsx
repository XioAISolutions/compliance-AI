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
    <div className="rounded-3xl border border-cyan-300/20 bg-neutral-900/60 p-5 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">Try BrainSNN yourself</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Paste any deck paragraph, sales-call line, or marketing claim. The score is computed
            server-side and varies with the text.
          </p>
        </div>
        <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100">
          live endpoint
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
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
            className="rounded-full border border-white/15 px-3 py-1 font-medium text-neutral-200 hover:bg-white/10"
          >
            {sample.label}
          </button>
        ))}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        className="mt-4 w-full rounded-2xl border border-white/10 bg-neutral-950 p-3 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-cyan-300/40 focus:outline-none"
        placeholder="Paste deck text, transcript line, or claim…"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              startScoring(() => {
                void score(text);
              })
            }
            disabled={scoring || text.trim().length === 0}
            className="rounded-full bg-cyan-300 px-4 py-2 font-semibold text-neutral-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scoring ? "Scoring…" : "Re-score"}
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
              className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 font-semibold text-cyan-100 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
              title="Route this text through Featherless for safer-language edits, then re-score."
            >
              {rewriting ? "Rewriting…" : "Rewrite via Featherless →"}
            </button>
          )}
        </div>
        <span className="text-xs text-neutral-500">
          POST /api/demo/milan/cognitive-risk · {text.length} chars
        </span>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-5 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="rounded-2xl border border-white/10 bg-neutral-950/80 p-4 text-center">
            <div className="text-4xl font-semibold text-rose-300">{result.score}</div>
            <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">composite</div>
          </div>
          <div className="space-y-2">
            <Bar label="Emotional activation" value={result.dimensions.emotionalActivation} />
            <Bar label="Certainty pressure" value={result.dimensions.certaintyPressure} />
            <Bar label="Trust erosion" value={result.dimensions.trustErosion} />
            <Bar label="Urgency compression" value={result.dimensions.urgencyCompression} />
          </div>
        </div>
      )}

      {rewrite && (
        <div className="mt-6 space-y-4 rounded-2xl border border-cyan-300/30 bg-cyan-300/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="font-semibold uppercase tracking-[0.25em] text-cyan-200">
              Featherless rewrite · {rewrite.redline.source} · {rewrite.redline.model}
            </div>
            <div className="text-neutral-400">
              {rewrite.redline.latencyMs}ms · {rewrite.redline.edits.length} edits
              {rewrite.redline.error ? ` · fallback: ${rewrite.redline.error.slice(0, 60)}` : ""}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <BeforeAfterCard
              label="Before"
              risk={rewrite.before.cognitiveRisk}
              tone="rose"
            />
            <BeforeAfterCard
              label="After"
              risk={rewrite.after.cognitiveRisk}
              tone="emerald"
              delta={rewrite.delta.score}
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-neutral-950/80 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Safer-language rewrite (concatenated)
            </div>
            <p className="mt-2 text-sm leading-relaxed text-neutral-200">{rewrite.after.text}</p>
          </div>

          {rewrite.redline.edits.length > 0 && (
            <details className="rounded-xl border border-white/10 bg-neutral-950/60 p-3 text-sm">
              <summary className="cursor-pointer font-semibold text-neutral-200">
                Show {rewrite.redline.edits.length} edits
              </summary>
              <ul className="mt-3 space-y-3">
                {rewrite.redline.edits.map((edit, i) => (
                  <li key={i} className="border-l-2 border-cyan-300/40 pl-3 text-xs">
                    <div className="text-rose-200">— {edit.before}</div>
                    <div className="mt-1 text-emerald-200">+ {edit.after}</div>
                    <div className="mt-1 text-neutral-500 italic">{edit.reason}</div>
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
    <div className="rounded-xl border border-white/10 bg-neutral-950/80 p-3">
      <div className="flex items-baseline justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-400">
          {label}
        </div>
        {typeof delta === "number" && delta !== 0 && (
          <div className="text-xs font-semibold text-emerald-300">
            {delta > 0 ? `−${delta}` : `+${Math.abs(delta)}`}
          </div>
        )}
      </div>
      <div className={`mt-1 text-3xl font-semibold ${scoreColor}`}>{risk.score}</div>
      <div className="mt-2 space-y-1.5">
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
      <div className="mb-1 flex justify-between text-xs text-neutral-400">
        <span>{label}</span>
        <span>{clamped}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-cyan-300" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
