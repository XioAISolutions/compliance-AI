"use client";

/**
 * QuickReviewDropZone — the single action on the home page.
 *
 * Drop a file here and we:
 *   1. Upload to /api/quick-review
 *   2. Auto-classify + auto-create a matter + chunk + store
 *   3. Navigate to /matters/[id] where the user can click Start review
 *
 * While the POST is in flight we show a 4-step intake stepper (Parsing →
 * Classifying → Creating matter → Starting review) so the several-second
 * round-trip feels intentional instead of fragile. A first-time visitor
 * without a document can also kick the tires from the sample shelf below
 * the drop zone — each sample is a real markdown file that gets POSTed
 * through the same pipeline.
 *
 * The payoff: a prospect's first 60 seconds is drag (or sample click) →
 * stepper → matter ready to review.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Classification {
  documentType: string;
  taskType: string | null;
  jurisdiction: string | null;
  registrationCategory: string | null;
  confidence: number;
  suggestedTitle: string | null;
}

interface QuickReviewMatterResponse {
  kind?: "matter";
  matterId: string;
  matter: { title: string; taskType: string; jurisdiction: string };
  classification: Classification;
}

interface QuickReviewAuthorityIntakeResponse {
  kind: "authority-intake";
  authorityTitle: string;
  chunksIngested: number;
  classification: Classification;
  message: string;
  alreadyIngested?: boolean;
}

type QuickReviewResponse = QuickReviewMatterResponse | QuickReviewAuthorityIntakeResponse;

const TASK_LABELS: Record<string, string> = {
  "om-review": "Offering memo review",
  "kyc-gap-check": "KYC/AML gap check",
  "marketing-signoff": "Marketing sign-off",
  "response-memo": "Regulator response memo",
};

interface SampleDoc {
  slug: string;
  label: string;
  hint: string;
  filename: string;
}

const SAMPLES: SampleDoc[] = [
  {
    slug: "sample-offering-memo.md",
    label: "Offering memo",
    hint: "Form 45-106F2 · Ontario",
    filename: "sample-offering-memo.md",
  },
  {
    slug: "sample-kyc-file.md",
    label: "KYC file",
    hint: "EMD client package",
    filename: "sample-kyc-file.md",
  },
  {
    slug: "sample-marketing-deck.md",
    label: "Marketing deck",
    hint: "Investor pitch · Fund II",
    filename: "sample-marketing-deck.md",
  },
  {
    slug: "sample-regulator-inquiry.md",
    label: "Regulator inquiry",
    hint: "OSC deficiency letter",
    filename: "sample-regulator-inquiry.md",
  },
];

type IntakeStep = 0 | 1 | 2 | 3 | 4;

const STEP_LABELS: Record<Exclude<IntakeStep, 0>, string> = {
  1: "Parsing",
  2: "Classifying",
  3: "Creating matter",
  4: "Starting review",
};

export function QuickReviewDropZone({
  onAuthorityIntake,
}: {
  onAuthorityIntake?: () => void;
} = {}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<IntakeStep>(0);
  const [error, setError] = useState<string | null>(null);
  // Persistent confirmation when a regulation was ingested into the
  // authority library — the drop stays on the home page rather than
  // navigating to a matter that wasn't created.
  const [authorityIntake, setAuthorityIntake] = useState<{
    title: string;
    chunks: number;
    message: string;
    alreadyIngested: boolean;
  } | null>(null);

  // Time-based step advancement. The POST /api/quick-review request is
  // synchronous and we don't get intermediate progress; showing a named
  // step keeps the user oriented instead of staring at "Reading…" for
  // five seconds. Steps 1→2→3 advance on a timer; step 4 ("Starting
  // review") is snapped on when the matter response arrives.
  useEffect(() => {
    if (!busy) {
      setStep(0);
      return;
    }
    setStep(1);
    const startedAt = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setStep((current) => {
        // Never step backwards, never override the final "Starting review".
        if (current === 4) return 4;
        if (elapsed >= 2400) return current < 3 ? 3 : current;
        if (elapsed >= 1200) return current < 2 ? 2 : current;
        return current < 1 ? 1 : current;
      });
    }, 200);
    return () => clearInterval(id);
  }, [busy]);

  async function handleFile(file: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/quick-review", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? body?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as QuickReviewResponse;
      // Authority-intake: regulation or staff notice was ingested into the
      // tenant's cognition corpus. Don't navigate — the next upload (an OM,
      // KYC file, marketing material, or regulator letter) is what produces
      // a matter, and reviews for that matter will now cite the freshly
      // ingested material.
      if (data.kind === "authority-intake") {
        setAuthorityIntake({
          title: data.authorityTitle,
          chunks: data.chunksIngested,
          message: data.message,
          alreadyIngested: data.alreadyIngested === true,
        });
        // Nudge the corpus snapshot on the home page to re-fetch so the new
        // chunk count + source file shows up without a manual reload.
        onAuthorityIntake?.();
        return;
      }
      // Standard matter-creation response: advance the stepper to "Starting
      // review", then navigate. The label hints at what comes next on the
      // matter page.
      setStep(4);
      setAuthorityIntake(null);
      router.push(`/matters/${data.matterId}?autoStart=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadSample(sample: SampleDoc) {
    if (busy) return;
    setError(null);
    try {
      const res = await fetch(`/samples/${sample.slug}`);
      if (!res.ok) throw new Error(`Couldn't load sample (HTTP ${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], sample.filename, {
        type: blob.type || "text/markdown",
      });
      await handleFile(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
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
          busy ? "cursor-wait border-neutral-200 dark:border-neutral-800" : ""
        } ${
          dragOver && !busy
            ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
            : "border-neutral-300 hover:border-neutral-400 dark:border-neutral-700"
        }`}
      >
        {busy ? (
          <IntakeStepper step={step} />
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
      {/* Sample shelf — one-click seed documents so a prospect without a
          real file can still see the pipeline land a matter. These go
          through the exact same /api/quick-review path as an upload. */}
      {!busy && !authorityIntake && (
        <div className="mt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            Or try a sample
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {SAMPLES.map((sample) => (
              <button
                key={sample.slug}
                type="button"
                onClick={() => void loadSample(sample)}
                className="rounded-md border border-neutral-200 px-3 py-2 text-left text-xs hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:border-neutral-600 dark:hover:bg-neutral-900"
              >
                <span className="block font-medium">{sample.label}</span>
                <span className="mt-0.5 block text-[10px] text-neutral-500">{sample.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {authorityIntake && !error && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          <div className="flex items-start gap-2">
            <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <div className="flex-1">
              <p className="font-medium">
                {authorityIntake.alreadyIngested
                  ? `Already in authority library: ${authorityIntake.title}`
                  : `Added to authority library: ${authorityIntake.title}`}
              </p>
              <p className="mt-1">
                {authorityIntake.alreadyIngested
                  ? "This regulation was previously ingested for this tenant — no new chunks added."
                  : `Ingested ${authorityIntake.chunks} chunk${authorityIntake.chunks === 1 ? "" : "s"}. Reviews will now cite this material.`}
              </p>
              {/* Replace the old "drop an OM/KYC/deck/inquiry next" prose
                  with actual next actions. The authority is in — the user
                  should now be able to act on it in one click instead of
                  having to re-read the tagline and guess. */}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-600 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-200"
                >
                  Upload OM
                </button>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="rounded-md border border-emerald-300 px-2.5 py-1 text-[11px] font-medium hover:bg-emerald-100 dark:border-emerald-700 dark:hover:bg-emerald-900"
                >
                  Upload KYC
                </button>
                <button
                  type="button"
                  onClick={() => void loadSample(SAMPLES[0]!)}
                  className="rounded-md border border-emerald-300 px-2.5 py-1 text-[11px] font-medium hover:bg-emerald-100 dark:border-emerald-700 dark:hover:bg-emerald-900"
                >
                  Use sample document
                </button>
                <a
                  href="#authority-library"
                  className="rounded-md border border-emerald-300 px-2.5 py-1 text-[11px] font-medium hover:bg-emerald-100 dark:border-emerald-700 dark:hover:bg-emerald-900"
                >
                  Open authority library
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IntakeStepper({ step }: { step: IntakeStep }) {
  const steps: IntakeStep[] = [1, 2, 3, 4];
  return (
    <div className="w-full max-w-md">
      <div className="flex items-center gap-2">
        {steps.map((s, idx) => {
          const state: "done" | "active" | "pending" =
            step > s ? "done" : step === s ? "active" : "pending";
          return (
            <div key={s} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                  state === "done"
                    ? "bg-blue-500 text-white"
                    : state === "active"
                      ? "bg-blue-100 text-blue-700 ring-2 ring-blue-500 dark:bg-blue-950 dark:text-blue-300"
                      : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500"
                }`}
              >
                {state === "done" ? "✓" : s}
              </span>
              {idx < steps.length - 1 && (
                <span
                  className={`h-[2px] flex-1 ${
                    step > s ? "bg-blue-500" : "bg-neutral-200 dark:bg-neutral-800"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 flex items-center justify-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
        {step === 0 ? "Processing…" : STEP_LABELS[step as Exclude<IntakeStep, 0>]}…
      </p>
    </div>
  );
}
