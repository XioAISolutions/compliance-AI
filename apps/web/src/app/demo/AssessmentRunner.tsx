"use client";

import { useState } from "react";

interface AssessmentResponse {
  readinessScore: number;
  executiveSummary: string;
  nextSteps: string[];
}

export function AssessmentRunner() {
  const [usesAi, setUsesAi] = useState(true);
  const [handlesPersonalData, setHandlesPersonalData] = useState(true);
  const [hasSecurityOwner, setHasSecurityOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssessmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/demo/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usesAi, handlesPersonalData, hasSecurityOwner }),
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      const json = (await response.json()) as AssessmentResponse;
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800">
      <h2 className="text-lg font-semibold">Interactive assessment runner</h2>
      <p className="mt-2 text-sm text-neutral-500">
        Change a few profile signals and show how the queue reprioritizes instantly without any migrations or tenant setup.
      </p>

      <div className="mt-4 space-y-3 text-sm">
        <Toggle label="Company uses AI in production" checked={usesAi} onChange={setUsesAi} />
        <Toggle
          label="Company handles personal data"
          checked={handlesPersonalData}
          onChange={setHandlesPersonalData}
        />
        <Toggle
          label="Security owner already assigned"
          checked={hasSecurityOwner}
          onChange={setHasSecurityOwner}
        />
      </div>

      <button
        type="button"
        onClick={run}
        disabled={loading}
        className="mt-4 rounded-lg bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
      >
        {loading ? "Running…" : "Run assessment"}
      </button>

      {result && (
        <div className="mt-4 rounded-xl bg-neutral-100 p-4 dark:bg-neutral-900">
          <div className="text-3xl font-semibold">{result.readinessScore}%</div>
          <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
            {result.executiveSummary}
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-600 dark:text-neutral-400">
            {result.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 px-3 py-2 dark:border-neutral-800">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-emerald-600"
      />
    </label>
  );
}
