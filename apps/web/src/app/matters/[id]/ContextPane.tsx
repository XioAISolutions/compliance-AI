"use client";

/**
 * Context pane — collapsible, shows what the AI is using.
 *
 * Auto-populated from matter jurisdiction + registration + task.
 * One toggle: "Show me what you're using."
 */

import { useState } from "react";

interface Authority {
  id: string;
  title: string;
  source: string;
}

interface Props {
  authorities: Authority[];
  excluded: { rule: string; reason: string }[];
  loading: boolean;
}

export function ContextPane({ authorities, excluded, loading }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Context
        </h2>
        <div className="animate-pulse space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 rounded-md bg-neutral-100 dark:bg-neutral-800"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Context ({authorities.length} authorities loaded)
        </h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          {expanded ? "Collapse" : "Show details"}
        </button>
      </div>

      {/* Compact: just the count and names */}
      {!expanded && (
        <ul className="space-y-1">
          {authorities.map((auth) => (
            <li
              key={auth.id}
              className="flex items-center gap-2 rounded-md bg-neutral-50 px-3 py-1.5 text-xs dark:bg-neutral-900"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
              <span className="truncate font-medium">{auth.title}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Expanded: full source info */}
      {expanded && (
        <div className="space-y-2">
          {authorities.map((auth) => (
            <div
              key={auth.id}
              className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800"
            >
              <h3 className="text-xs font-medium">{auth.title}</h3>
              <p className="mt-0.5 text-[10px] text-neutral-400">{auth.source}</p>
            </div>
          ))}
        </div>
      )}

      {/* Excluded rules with explanations */}
      {excluded.length > 0 && (
        <div className="mt-2 space-y-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-300">
            Excluded
          </h3>
          {excluded.map((ex, i) => (
            <p key={i} className="text-[10px] text-neutral-400">
              <span className="line-through">{ex.rule}</span> — {ex.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
