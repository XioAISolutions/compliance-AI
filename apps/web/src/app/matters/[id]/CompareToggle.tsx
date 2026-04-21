"use client";

/**
 * CompareToggle — lets a reviewer pick a prior review snapshot and
 * see a word-level redline between that snapshot and the current
 * output. Only renders when the matter has >=2 snapshots; solo-run
 * matters don't need the UI noise.
 *
 * Flow:
 *   1. Mount → GET /outputs → learn the version list.
 *   2. User selects a prior version from the dropdown.
 *   3. GET /outputs?compare=<v>&to=<latest> → server emits redline
 *      markup in the same [-deleted-]{+inserted+} token syntax
 *      RedlinePreview already renders.
 *   4. Render the diff below the current output.
 *
 * The current output stays visible above the diff so the reviewer
 * can read the finished work AND see what changed from the prior
 * round without toggling back and forth.
 */

import { useEffect, useState } from "react";
import { RedlinePreview } from "./RedlinePreview";

interface VersionSummary {
  id: string;
  versionNo: number;
  createdAt: string;
  createdBy: string;
  chars: number;
  citationCount: number;
}

interface CompareResult {
  from: { versionNo: number; createdAt: string; createdBy: string };
  to: { versionNo: number; createdAt: string; createdBy: string };
  markup: string;
  stats: { inserted: number; deleted: number; unchanged: number };
}

export function CompareToggle({
  matterId,
  currentContent: _currentContent,
}: {
  matterId: string;
  currentContent: string;
}) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [latest, setLatest] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/matters/${matterId}/outputs`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((body: { versions: VersionSummary[]; latest: number | null }) => {
        if (cancelled) return;
        setVersions(body.versions ?? []);
        setLatest(body.latest ?? null);
      })
      .catch(() => {
        // Non-fatal — compare is best-effort; a missing snapshot API
        // just means the toggle stays hidden.
      });
    return () => {
      cancelled = true;
    };
  }, [matterId]);

  useEffect(() => {
    if (selected === null) {
      setResult(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("compare", String(selected));
    fetch(`/api/matters/${matterId}/outputs?${params.toString()}`)
      .then(async (r) => {
        if (!r.ok) {
          const body = (await r.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((body: CompareResult) => {
        if (!cancelled) setResult(body);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matterId, selected]);

  // <2 versions = nothing worth comparing. Keep the UI clean.
  if (versions.length < 2 || latest === null) return null;

  // Don't offer "compare to the latest" (that's a no-op diff).
  const priorVersions = versions.filter((v) => v.versionNo < latest);
  if (priorVersions.length === 0) return null;

  return (
    <div className="mb-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">Compare to prior round:</span>
        <select
          value={selected ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            setSelected(val === "" ? null : Number.parseInt(val, 10));
          }}
          className="rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
        >
          <option value="">— none —</option>
          {priorVersions.map((v) => (
            <option key={v.id} value={v.versionNo}>
              v{v.versionNo} · {new Date(v.createdAt).toLocaleString()} · {v.citationCount}{" "}
              cite{v.citationCount === 1 ? "" : "s"}
            </option>
          ))}
        </select>
        {loading && <span className="text-neutral-400">Computing diff…</span>}
        {result && !loading && (
          <span className="ml-auto flex items-center gap-2 text-[10px]">
            <span className="rounded bg-blue-100 px-1.5 py-0.5 font-medium uppercase tracking-wide text-blue-800 dark:bg-blue-950 dark:text-blue-200">
              {result.stats.inserted} ins
            </span>
            <span className="rounded bg-red-100 px-1.5 py-0.5 font-medium uppercase tracking-wide text-red-800 dark:bg-red-950 dark:text-red-200">
              {result.stats.deleted} del
            </span>
            <span className="text-neutral-400">
              ({result.stats.unchanged} unchanged words)
            </span>
          </span>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded bg-red-50 px-2 py-1 text-[11px] text-red-800 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </p>
      )}

      {result && !loading && !error && (
        <div className="mt-3 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
          <p className="mb-2 text-[10px] uppercase tracking-wide text-neutral-400">
            v{result.from.versionNo} → v{result.to.versionNo}
          </p>
          <RedlinePreview content={result.markup} />
        </div>
      )}
    </div>
  );
}
