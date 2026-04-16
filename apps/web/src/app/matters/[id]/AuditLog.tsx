"use client";

/**
 * Audit log — per-matter evidence / work log.
 *
 * Shows every substantive action in reverse-chronological order.
 * Each row is expandable to show full input/output.
 * "Show me your work" for the regulator.
 */

import { useState } from "react";

interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  inputHash: string;
  authoritiesUsed: string[];
  outputHash: string | null;
  judgeVerdict: string | null;
  inputContent: string | null;
  outputContent: string | null;
}

interface Props {
  entries: AuditEntry[];
  verified: boolean;
}

const ACTION_STYLES: Record<string, string> = {
  query: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  retrieval: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  generation: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  verdict: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  export: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export function AuditLog({ entries, verified }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Audit trail ({entries.length} entries)
        </h2>
        <div className="flex items-center gap-2">
          {verified ? (
            <span className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Chain verified
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-red-600 dark:text-red-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              Chain broken
            </span>
          )}
          <button
            onClick={() => {
              const csv = entriesToCSV(entries);
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "audit-trail.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-[10px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Export CSV
          </button>
        </div>
      </div>

      {entries.length === 0 && (
        <p className="text-xs text-neutral-400">No actions recorded yet.</p>
      )}

      <div className="space-y-1.5">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-md border border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs"
            >
              <span className="shrink-0 text-[10px] font-mono text-neutral-400">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  ACTION_STYLES[entry.action] ?? ACTION_STYLES.query
                }`}
              >
                {entry.action}
              </span>
              <span className="truncate text-neutral-600 dark:text-neutral-400">
                {entry.actor}
              </span>
              {entry.judgeVerdict && (
                <span className="ml-auto shrink-0 text-[10px] font-mono text-amber-600">
                  {entry.judgeVerdict}
                </span>
              )}
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className={`shrink-0 text-neutral-400 transition-transform ${
                  expandedId === entry.id ? "rotate-180" : ""
                }`}
              >
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
            </button>

            {expandedId === entry.id && (
              <div className="border-t border-neutral-200 px-3 py-2 text-[10px] dark:border-neutral-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="font-semibold text-neutral-400">Input hash:</span>{" "}
                    <span className="font-mono">{entry.inputHash.slice(0, 16)}…</span>
                  </div>
                  {entry.outputHash && (
                    <div>
                      <span className="font-semibold text-neutral-400">Output hash:</span>{" "}
                      <span className="font-mono">{entry.outputHash.slice(0, 16)}…</span>
                    </div>
                  )}
                </div>
                {entry.authoritiesUsed.length > 0 && (
                  <div className="mt-1">
                    <span className="font-semibold text-neutral-400">Authorities:</span>{" "}
                    {entry.authoritiesUsed.join(", ")}
                  </div>
                )}
                {entry.inputContent && (
                  <div className="mt-2">
                    <span className="font-semibold text-neutral-400">Input:</span>
                    <p className="mt-0.5 whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">
                      {entry.inputContent.slice(0, 500)}
                      {entry.inputContent.length > 500 ? "…" : ""}
                    </p>
                  </div>
                )}
                {entry.outputContent && (
                  <div className="mt-2">
                    <span className="font-semibold text-neutral-400">Output:</span>
                    <p className="mt-0.5 whitespace-pre-wrap text-neutral-600 dark:text-neutral-400">
                      {entry.outputContent.slice(0, 500)}
                      {entry.outputContent.length > 500 ? "…" : ""}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function entriesToCSV(entries: AuditEntry[]): string {
  const header = "timestamp,actor,action,input_hash,output_hash,judge_verdict,authorities_used";
  const rows = entries.map(
    (e) =>
      `${e.timestamp},${e.actor},${e.action},${e.inputHash},${e.outputHash ?? ""},${e.judgeVerdict ?? ""},${e.authoritiesUsed.join(";")}`,
  );
  return [header, ...rows].join("\n");
}
