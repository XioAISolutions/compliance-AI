"use client";

/**
 * QuickReviewDropZone — the single action on the home page.
 *
 * Drop a file here and we:
 *   1. Upload to /api/quick-review
 *   2. Auto-classify + auto-create a matter + chunk + store
 *   3. Navigate to /matters/[id] where the user can click Start review
 *
 * The payoff: a prospect's first 60 seconds is drag → wait 3 seconds →
 * see the matter ready to review. No form to fill out first.
 */

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Classification {
  documentType: string;
  taskType: string | null;
  jurisdiction: string | null;
  registrationCategory: string | null;
  confidence: number;
  suggestedTitle: string | null;
}

interface QuickReviewResponse {
  matterId: string;
  matter: { title: string; taskType: string; jurisdiction: string };
  classification: Classification;
}

const TASK_LABELS: Record<string, string> = {
  "om-review": "Offering memo review",
  "kyc-gap-check": "KYC/AML gap check",
  "marketing-signoff": "Marketing sign-off",
  "response-memo": "Regulator response memo",
};

export function QuickReviewDropZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setStatus(`Reading ${file.name}…`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/quick-review", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as QuickReviewResponse;
      const taskLabel = TASK_LABELS[data.matter.taskType] ?? data.matter.taskType;
      setStatus(`Classified as ${taskLabel}. Opening matter…`);
      router.push(`/matters/${data.matterId}?autoStart=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const first = files[0];
    if (first) void handleFile(first);
  }

  function handleBrowse(e: React.ChangeEvent<HTMLInputElement>) {
    const first = e.target.files?.[0];
    if (first) void handleFile(first);
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
          busy
            ? "cursor-wait border-neutral-200 dark:border-neutral-800"
            : ""
        } ${
          dragOver && !busy
            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
            : "border-neutral-300 hover:border-neutral-400 dark:border-neutral-700"
        }`}
      >
        {busy ? (
          <>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {status ?? "Processing…"}
              </span>
            </div>
          </>
        ) : (
          <>
            <p className="text-lg font-medium">Drop a document to review</p>
            <p className="mt-1 text-sm text-neutral-500">
              or{" "}
              <span className="font-medium text-neutral-700 underline underline-offset-2 dark:text-neutral-300">
                browse
              </span>
            </p>
            <p className="mt-3 text-xs text-neutral-400">
              PDF · DOCX · TXT · MD &nbsp;—&nbsp; max 25 MB
            </p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md"
          onChange={handleBrowse}
          disabled={busy}
          className="hidden"
        />
      </label>
      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
