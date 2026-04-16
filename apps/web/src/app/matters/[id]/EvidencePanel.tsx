"use client";

/**
 * EvidencePanel — per-matter evidence items with status state-machine actions.
 *
 * The reviewer auto-generates items with status=missing. Users can:
 *   - Mark a request as sent (missing → requested)
 *   - Mark a request as received (requested → present), with a note
 *   - Approve as attested (present → approved)
 *   - Add a manual evidence item
 */

import { useState } from "react";

export type EvidenceStatus = "missing" | "requested" | "stale" | "present" | "approved";

export interface EvidenceItem {
  id: string;
  matterId: string;
  title: string;
  description: string;
  source?: string;
  status: EvidenceStatus;
  requestedFrom?: string;
  fileUri?: string;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  items: EvidenceItem[];
  matterId: string;
  onRefresh: () => void;
}

const STATUS_STYLES: Record<EvidenceStatus, string> = {
  missing: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  requested: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  stale: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  present: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
};

const NEXT_STATUS: Partial<Record<EvidenceStatus, { next: EvidenceStatus; label: string }>> = {
  missing: { next: "requested", label: "Mark requested" },
  requested: { next: "present", label: "Mark received" },
  stale: { next: "requested", label: "Re-request" },
  present: { next: "approved", label: "Approve" },
};

export function EvidencePanel({ items, matterId, onRefresh }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newRequestedFrom, setNewRequestedFrom] = useState("");
  const [saving, setSaving] = useState(false);

  async function updateStatus(id: string, status: EvidenceStatus) {
    setSaving(true);
    try {
      const res = await fetch(`/api/matters/${matterId}/evidence`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function createItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newDescription.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/matters/${matterId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          requestedFrom: newRequestedFrom || undefined,
          status: "missing",
        }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewDescription("");
        setNewRequestedFrom("");
        setAddingNew(false);
        onRefresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const coverage = computeCoverage(items);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Evidence ({items.length}) · {coverage}% covered
        </h2>
        <button
          onClick={() => setAddingNew(!addingNew)}
          className="text-[10px] text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
        >
          {addingNew ? "Cancel" : "+ Add"}
        </button>
      </div>

      {addingNew && (
        <form
          onSubmit={createItem}
          className="space-y-2 rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-800"
        >
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Evidence title"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Description"
            rows={2}
            className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
          />
          <input
            type="text"
            value={newRequestedFrom}
            onChange={(e) => setNewRequestedFrom(e.target.value)}
            placeholder="Requested from (optional, e.g., CFO)"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-1 text-xs dark:border-neutral-700"
          />
          <button
            type="submit"
            disabled={saving || !newTitle.trim() || !newDescription.trim()}
            className="w-full rounded-md bg-neutral-900 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
          >
            {saving ? "Saving…" : "Create"}
          </button>
        </form>
      )}

      {items.length === 0 && !addingNew && (
        <p className="text-[10px] text-neutral-400">
          No evidence items yet. They'll appear automatically after a review runs.
        </p>
      )}

      <ul className="space-y-1.5">
        {items.map((item) => {
          const isExpanded = expandedId === item.id;
          const nextAction = NEXT_STATUS[item.status];
          return (
            <li
              key={item.id}
              className="rounded-md border border-neutral-200 p-2 text-xs dark:border-neutral-800"
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="flex-1 text-left"
                >
                  <p className="font-medium">{item.title}</p>
                  {item.source && (
                    <p className="mt-0.5 text-[10px] text-neutral-500">{item.source}</p>
                  )}
                </button>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[item.status]}`}
                >
                  {item.status}
                </span>
              </div>

              {isExpanded && (
                <div className="mt-2 space-y-2 border-t border-neutral-100 pt-2 dark:border-neutral-900">
                  <p className="text-[10px] text-neutral-600 dark:text-neutral-400">
                    {item.description}
                  </p>
                  {item.requestedFrom && (
                    <p className="text-[10px] text-neutral-500">
                      Requested from: <strong>{item.requestedFrom}</strong>
                    </p>
                  )}
                  {nextAction && (
                    <button
                      onClick={() => updateStatus(item.id, nextAction.next)}
                      disabled={saving}
                      className="rounded-md bg-neutral-900 px-2 py-1 text-[10px] font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
                    >
                      {nextAction.label}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Coverage % = (present + approved) / total, rounded. */
function computeCoverage(items: EvidenceItem[]): number {
  if (items.length === 0) return 0;
  const covered = items.filter((i) => i.status === "present" || i.status === "approved").length;
  return Math.round((covered / items.length) * 100);
}
