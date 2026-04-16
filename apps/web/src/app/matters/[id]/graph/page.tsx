"use client";

/**
 * /matters/[id]/graph — evidence graph view.
 *
 * Cannibalized from abhigyanpatwari/GitNexus. Sigma.js + Graphology +
 * force-atlas2 canvas with a 360° context panel on node click. Pulls
 * matter + documents + authorities from /api/matters/[id] and the
 * transcript from /api/matters/[id]/transcript, then composes the
 * payload with `buildEvidenceGraph`.
 *
 * Separate subroute to keep this merge additive-only on top of main.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { GraphView } from "../GraphView";
import type { TranscriptTurn } from "@compliance-ai/chat-structure";

interface Matter {
  id: string;
  title: string;
  status?: string;
}

interface MatterDocument {
  id: string;
  filename: string;
  documentType: string;
  chunkCount?: number;
}

interface Authority {
  id: string;
  title: string;
  source?: string;
}

export default function GraphPage() {
  const params = useParams();
  const matterId = params.id as string;

  const [matter, setMatter] = useState<Matter | null>(null);
  const [documents, setDocuments] = useState<MatterDocument[]>([]);
  const [authorities, setAuthorities] = useState<Authority[]>([]);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [matterRes, transcriptRes] = await Promise.all([
          fetch(`/api/matters/${matterId}`),
          fetch(`/api/matters/${matterId}/transcript`),
        ]);
        if (!matterRes.ok) throw new Error(`matter HTTP ${matterRes.status}`);
        const m = await matterRes.json();
        if (cancelled) return;
        setMatter(m.matter);
        setDocuments((m.documents ?? []) as MatterDocument[]);
        setAuthorities((m.authorities ?? []) as Authority[]);
        if (transcriptRes.ok) {
          const t = (await transcriptRes.json()) as { turns: TranscriptTurn[] };
          if (!cancelled) setTranscript(t.turns ?? []);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matterId]);

  return (
    <main className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3 dark:border-neutral-800">
        <div className="flex items-center gap-3">
          <Link
            href={`/matters/${matterId}`}
            className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            ← Matter
          </Link>
          <span className="text-neutral-300">/</span>
          <h1 className="text-sm font-semibold">{matter?.title ?? "Graph"}</h1>
        </div>
        <Link
          href={`/matters/${matterId}/timeline`}
          className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          Transcript →
        </Link>
      </header>

      <section className="flex-1 overflow-hidden p-4">
        {loading && (
          <div className="flex h-full items-center justify-center text-xs text-neutral-400">
            Loading graph…
          </div>
        )}
        {error && (
          <div className="flex h-full items-center justify-center text-xs text-red-500">
            Failed to load graph: {error}
          </div>
        )}
        {!loading && !error && matter && (
          <GraphView
            matter={{ id: matter.id, title: matter.title, status: matter.status }}
            documents={documents}
            authorities={authorities}
            transcript={transcript}
          />
        )}
      </section>
    </main>
  );
}
