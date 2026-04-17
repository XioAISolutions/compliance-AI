"use client";

/**
 * AuthorityLibrarySnapshot — compact card showing this tenant's cognition
 * corpus at a glance: total count, jurisdiction breakdown, and the unique
 * source files that have been ingested.
 *
 * Rendered below the quick-review dropzone on the home page so the user
 * gets immediate confirmation that an authority intake "took" — the
 * number should go up after a regulation upload, and the newly-uploaded
 * file appears in the "Source files" list.
 */

import { useEffect, useState } from "react";

interface Snapshot {
  total: number;
  byJurisdiction: Record<string, number>;
  byRegistrationCategory: Record<string, number>;
  uploadedSources: string[];
}

function humanizeJurisdiction(j: string): string {
  if (j === "ontario") return "Ontario";
  if (j === "quebec") return "Quebec";
  if (j === "british-columbia") return "BC";
  if (j === "alberta") return "Alberta";
  if (j === "federal") return "Federal";
  if (j === "unspecified") return "Cross-jurisdictional";
  return j;
}

function humanizeCategory(c: string): string {
  if (c === "emd") return "EMD";
  if (c === "pm") return "PM";
  if (c === "iiroc") return "IIROC";
  if (c === "issuer") return "Issuer";
  if (c === "unspecified") return "Cross-registration";
  return c;
}

export function AuthorityLibrarySnapshot({ refreshToken }: { refreshToken?: number }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Keep this simple — the original .then/.catch/.finally chain with typed
    // body callbacks was hot-reloading to a state where setSnapshot didn't
    // re-render under some Turbopack fast-refresh sequences. async/await is
    // boring and works.
    (async () => {
      try {
        const res = await fetch("/api/authorities");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as Snapshot;
        if (!cancelled) {
          setSnapshot(body);
          setErr(null);
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  if (loading && !snapshot) {
    return (
      <div className="mt-8 rounded-lg border border-neutral-200 p-4 text-xs text-neutral-400 dark:border-neutral-800">
        Loading authority library…
      </div>
    );
  }
  if (err || !snapshot) {
    return null;
  }
  if (snapshot.total === 0) {
    return null;
  }

  const jurisdictions = Object.entries(snapshot.byJurisdiction).sort((a, b) => b[1] - a[1]);

  return (
    <section className="mt-8 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Authority library
        </h2>
        <span className="text-[10px] text-neutral-400">
          retrieval corpus this tenant&apos;s reviewers cite from
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums">{snapshot.total}</span>
        <span className="text-xs text-neutral-500">
          authority chunk{snapshot.total === 1 ? "" : "s"} available for citation
        </span>
      </div>

      {jurisdictions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {jurisdictions.map(([j, count]) => (
            <span
              key={j}
              className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              title={`${count} chunks for ${humanizeJurisdiction(j)}`}
            >
              {humanizeJurisdiction(j)} · {count}
            </span>
          ))}
        </div>
      )}

      {snapshot.uploadedSources.length > 0 && (
        <div className="mt-3">
          <p className="text-[11px] font-medium text-neutral-500">
            Uploaded source files ({snapshot.uploadedSources.length})
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-neutral-600 dark:text-neutral-400">
            {snapshot.uploadedSources.slice(0, 6).map((src) => (
              <li key={src} className="truncate">
                · {src}
              </li>
            ))}
            {snapshot.uploadedSources.length > 6 && (
              <li className="text-neutral-400">… and {snapshot.uploadedSources.length - 6} more</li>
            )}
          </ul>
        </div>
      )}

      {/* Registration-category chips — only render the "interesting" ones. */}
      {Object.keys(snapshot.byRegistrationCategory).filter((c) => c !== "unspecified").length >
        0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(snapshot.byRegistrationCategory)
            .filter(([c]) => c !== "unspecified")
            .sort((a, b) => b[1] - a[1])
            .map(([c, count]) => (
              <span
                key={c}
                className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                title={`${count} chunks scoped to ${humanizeCategory(c)}`}
              >
                {humanizeCategory(c)} · {count}
              </span>
            ))}
        </div>
      )}
    </section>
  );
}
