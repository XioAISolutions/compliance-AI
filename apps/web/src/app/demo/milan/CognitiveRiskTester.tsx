"use client";

/**
 * CognitiveRiskTester — the proof that BrainSNN scoring is computation,
 * not decoration. A judge pastes any text and watches the four
 * dimensions + composite update against POST /api/demo/milan/cognitive-risk.
 *
 * Kept intentionally narrow: no streaming, no debouncing, no fancy
 * state machine. The user types, hits "Re-score", we hit the endpoint,
 * we render the dimensions. That's the whole product surface this
 * component is meant to expose.
 */

import { useState, useTransition } from "react";

interface RiskResult {
  score: number;
  dimensions: {
    emotionalActivation: number;
    certaintyPressure: number;
    trustErosion: number;
    urgencyCompression: number;
  };
  inputLength: number;
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
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const score = async (input: string) => {
    setError(null);
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
              startTransition(() => {
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
        <button
          type="button"
          onClick={() =>
            startTransition(() => {
              void score(text);
            })
          }
          disabled={pending || text.trim().length === 0}
          className="rounded-full bg-cyan-300 px-4 py-2 font-semibold text-neutral-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Scoring…" : "Re-score"}
        </button>
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
