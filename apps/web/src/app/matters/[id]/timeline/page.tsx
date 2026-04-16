"use client";

/**
 * /matters/[id]/timeline — multi-persona reply-threaded timeline.
 *
 * Cannibalized from bcurts/agentchattr. Renders the per-matter transcript
 * from `@compliance-ai/chat-structure` via the `/api/matters/[id]/transcript`
 * endpoint, with colored identity pills for each participant, reply-thread
 * indents, round chips, verdict badges, and a JSONL download link.
 *
 * Separate subroute (not tabbed into the main matter page) so the merge
 * stays additive-only on top of main's post-layer-5 page.tsx.
 */

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Timeline } from "../Timeline";

export default function TimelinePage() {
  const params = useParams();
  const matterId = params.id as string;
  // refreshKey is exposed via a "Refresh" button so the user can re-pull
  // the transcript after opening the page — the transcript stream is
  // written by the review endpoint on the matter page.
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-neutral-200 pb-4 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <Link
            href={`/matters/${matterId}`}
            className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            ← Matter
          </Link>
          <span className="text-neutral-300">/</span>
          <h1 className="text-sm font-semibold">Transcript</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/matters/${matterId}/graph`}
            className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            Graph →
          </Link>
          <button
            onClick={() => setRefreshKey((k) => k + 1)}
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Refresh
          </button>
        </div>
      </header>
      <div className="mt-6">
        <Timeline matterId={matterId} refreshKey={refreshKey} />
      </div>
    </main>
  );
}
