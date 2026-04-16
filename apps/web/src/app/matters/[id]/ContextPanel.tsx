"use client";

/**
 * 360° context panel — shown on the right when a graph node is selected.
 *
 * Cannibalized from GitNexus — same incoming / outgoing / metadata
 * decomposition. The three sections answer:
 *   - Incoming: what points at this node (e.g. which turns grounded on this citation)
 *   - Outgoing: what this node points at (e.g. which authority a citation references)
 *   - Metadata: raw attributes (severity, quote, verdict, etc.)
 */

import type { context360 } from "../../../lib/evidence-graph";

type Context = NonNullable<ReturnType<typeof context360>>;

interface Props {
  context: Context;
}

const KIND_LABEL: Record<string, string> = {
  matter: "Matter",
  document: "Document",
  authority: "Authority",
  citation: "Citation",
  "agent-turn": "Agent turn",
  gap: "Gap",
};

const EDGE_LABEL: Record<string, string> = {
  contains: "contains",
  cites: "cites",
  grounds: "grounded on",
  flags: "flags",
  replies: "reply of",
};

export function ContextPanel({ context }: Props) {
  const { node, incoming, outgoing } = context;
  return (
    <div className="flex flex-col gap-4 pt-1">
      <header>
        <div
          className="mb-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: node.color }}
        >
          {KIND_LABEL[node.kind] ?? node.kind}
        </div>
        <h3 className="text-sm font-semibold">{node.label}</h3>
        {node.detail && (
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{node.detail}</p>
        )}
      </header>

      {incoming.length > 0 && (
        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Incoming ({incoming.length})
          </h4>
          <ul className="mt-1 space-y-1">
            {incoming.map(({ edge, other }) => (
              <li
                key={edge.id}
                className="rounded-md border border-neutral-200 px-2 py-1 text-xs dark:border-neutral-800"
              >
                <span className="text-[10px] text-neutral-400">
                  {EDGE_LABEL[edge.kind] ?? edge.kind}
                </span>
                <div className="mt-0.5 truncate">{other.label}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Outgoing ({outgoing.length})
          </h4>
          <ul className="mt-1 space-y-1">
            {outgoing.map(({ edge, other }) => (
              <li
                key={edge.id}
                className="rounded-md border border-neutral-200 px-2 py-1 text-xs dark:border-neutral-800"
              >
                <span className="text-[10px] text-neutral-400">
                  {EDGE_LABEL[edge.kind] ?? edge.kind}
                </span>
                <div className="mt-0.5 truncate">{other.label}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {node.metadata && Object.keys(node.metadata).length > 0 && (
        <section>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Metadata
          </h4>
          <dl className="mt-1 space-y-1 text-xs">
            {Object.entries(node.metadata).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="shrink-0 text-neutral-400">{k}</dt>
                <dd className="min-w-0 flex-1 truncate font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                  {typeof v === "string" ? v : JSON.stringify(v)}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
