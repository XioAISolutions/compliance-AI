"use client";

/**
 * HomeComposer — the unified intake composer on the home page.
 *
 * Replaces the earlier drop-zone-only UI. Two modes share a single
 * ChatGPT-style composer:
 *
 *   1. Ask — user types a question; we POST /api/ask and stream the
 *      answer below the composer with citations and a confidence bar.
 *      Rendering mirrors /ask (AskForm.tsx) so citation behaviour is
 *      consistent between the home page and the dedicated Q&A page.
 *
 *   2. Review — user attaches a document (paperclip, drag-and-drop, or
 *      sample click); we POST /api/quick-review, show the intake
 *      stepper, and navigate to /matters/[id]?autoStart=1 on success,
 *      or show an authority-intake confirmation if the uploaded file
 *      was a regulation the classifier routed into the authority
 *      library.
 *
 * The mode is inferred from what the user submits:
 *   - attached file + optional text → review (file is primary; text
 *     is currently ignored at the review stage but preserved in the
 *     transcript so future reviewer personas can consume it)
 *   - text only → ask
 *
 * The composer stays in place after an answer renders so the user
 * can ask a follow-up without reloading. A "New question" button
 * clears the last answer.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { parseModelOutput, type Citation } from "@compliance-ai/agents";
import { CitedMarkdown } from "./matters/[id]/CitedMarkdown";

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

/** SSE event shapes from /api/ask. */
type StreamEvent =
  | { type: "persona-selected"; persona: string; reason: string }
  | { type: "text-delta"; delta: string }
  | {
      type: "done";
      usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
    }
  | {
      type: "qa-summary";
      confidence: number;
      crossJurisdictionNote: boolean;
      citationsByJurisdiction: { CA: string[]; US: string[] };
    }
  | { type: "error"; message: string };

interface QaSummary {
  confidence: number;
  crossJurisdictionNote: boolean;
  citationsByJurisdiction: { CA: string[]; US: string[] };
}

export function HomeComposer({
  onAuthorityIntake,
}: {
  onAuthorityIntake?: () => void;
} = {}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Composer state
  const [question, setQuestion] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review (upload) state
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<IntakeStep>(0);
  const [authorityIntake, setAuthorityIntake] = useState<{
    title: string;
    chunks: number;
    message: string;
    alreadyIngested: boolean;
  } | null>(null);

  // Ask (Q&A) state
  const [streaming, setStreaming] = useState(false);
  const [askedQuestion, setAskedQuestion] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [summary, setSummary] = useState<QaSummary | null>(null);
  const [askDone, setAskDone] = useState(false);
  const parsed = useMemo(() => (askDone ? parseModelOutput(raw) : null), [askDone, raw]);
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null);

  // Upload-intake stepper timing (same cadence as the previous drop zone).
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
        if (current === 4) return 4;
        if (elapsed >= 2400) return current < 3 ? 3 : current;
        if (elapsed >= 1200) return current < 2 ? 2 : current;
        return current < 1 ? 1 : current;
      });
    }, 200);
    return () => clearInterval(id);
  }, [busy]);

  async function handleFileSubmit(file: File) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setAuthorityIntake(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/quick-review", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? body?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as QuickReviewResponse;
      if (data.kind === "authority-intake") {
        setAuthorityIntake({
          title: data.authorityTitle,
          chunks: data.chunksIngested,
          message: data.message,
          alreadyIngested: data.alreadyIngested === true,
        });
        onAuthorityIntake?.();
        setAttachedFile(null);
        setQuestion("");
        return;
      }
      setStep(4);
      setAttachedFile(null);
      setQuestion("");
      router.push(`/matters/${data.matterId}?autoStart=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleAskSubmit(q: string) {
    if (streaming) return;
    setAskedQuestion(q);
    setRaw("");
    setSummary(null);
    setError(null);
    setAskDone(false);
    setStreaming(true);
    setHoveredCitation(null);
    abortRef.current = new AbortController();
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          jurisdictions: ["CA", "US"],
          audience: "professional",
        }),
        signal: abortRef.current.signal,
      });
      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done: readerDone, value } = await reader.read();
        if (readerDone) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
          if (!frame.startsWith("data: ")) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(frame.slice(6)) as StreamEvent;
          } catch {
            continue;
          }
          if (event.type === "text-delta") setRaw((prev) => prev + event.delta);
          else if (event.type === "qa-summary") {
            setSummary({
              confidence: event.confidence,
              crossJurisdictionNote: event.crossJurisdictionNote,
              citationsByJurisdiction: event.citationsByJurisdiction,
            });
          } else if (event.type === "error") setError(event.message);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // AbortError when the user hits Stop — don't surface as an error.
      if (!(err instanceof Error && err.name === "AbortError")) setError(msg);
    } finally {
      setStreaming(false);
      setAskDone(true);
      abortRef.current = null;
    }
  }

  async function submit() {
    if (busy || streaming) return;
    if (attachedFile) {
      await handleFileSubmit(attachedFile);
      return;
    }
    const q = question.trim();
    if (!q) return;
    setQuestion("");
    await handleAskSubmit(q);
  }

  function stop() {
    abortRef.current?.abort();
  }

  function clearAnswer() {
    setRaw("");
    setSummary(null);
    setAskDone(false);
    setAskedQuestion(null);
    setError(null);
    textareaRef.current?.focus();
  }

  async function loadSample(sample: SampleDoc) {
    if (busy || streaming) return;
    setError(null);
    try {
      const res = await fetch(`/samples/${sample.slug}`);
      if (!res.ok) throw new Error(`Couldn't load sample (HTTP ${res.status})`);
      const blob = await res.blob();
      const file = new File([blob], sample.filename, {
        type: blob.type || "text/markdown",
      });
      await handleFileSubmit(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAttachedFile(f);
    // Reset the input so re-selecting the same file fires onChange again.
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setAttachedFile(f);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter submits; Shift+Enter for newline (ChatGPT-style).
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  }

  const submitDisabled =
    busy || streaming || (!attachedFile && question.trim().length === 0);
  const canClearAnswer = askDone && !streaming && (raw.length > 0 || summary !== null);

  return (
    <div>
      {/* Composer card */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy && !streaming) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-xl border bg-white transition-colors dark:bg-neutral-950 ${
          dragOver
            ? "border-blue-500 ring-2 ring-blue-200 dark:border-blue-400 dark:ring-blue-900"
            : "border-neutral-300 dark:border-neutral-700"
        }`}
      >
        {/* Drag overlay — only visual; drop handler is on the whole card. */}
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-blue-50/80 text-sm font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            Drop to attach — we&apos;ll route it to the right reviewer
          </div>
        )}

        {busy ? (
          <div className="px-5 py-8">
            <IntakeStepper step={step} />
          </div>
        ) : (
          <div className="space-y-2 px-4 py-3">
            {/* Attached file chip */}
            {attachedFile && (
              <div className="flex w-fit items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs dark:border-neutral-800 dark:bg-neutral-900">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                </svg>
                <span className="max-w-[16rem] truncate font-medium">{attachedFile.name}</span>
                <span className="text-neutral-400">
                  ({Math.max(1, Math.round(attachedFile.size / 1024))} KB)
                </span>
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="ml-1 rounded text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  aria-label="Remove attachment"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={streaming}
              rows={attachedFile ? 2 : 3}
              placeholder={
                attachedFile
                  ? "Optional — add context for the reviewer (or just press Enter to start)…"
                  : "Ask a compliance question, or drop a document to review…"
              }
              className="w-full resize-none bg-transparent px-1 py-1 text-sm placeholder-neutral-400 focus:outline-none disabled:opacity-50"
            />

            {/* Bottom toolbar: attach, hint, submit */}
            <div className="flex items-center justify-between gap-2 border-t border-neutral-100 pt-2 dark:border-neutral-900">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={streaming}
                  title="Attach a document"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-40 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
                  aria-label="Attach a document"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
                <p className="text-[11px] text-neutral-400">
                  PDF · DOCX · TXT · MD &nbsp;— max 25 MB · Enter to send, Shift+Enter for newline
                </p>
              </div>
              <div className="flex items-center gap-2">
                {streaming ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void submit()}
                    disabled={submitDisabled}
                    className="flex h-8 min-w-[2rem] items-center justify-center rounded-md bg-neutral-900 px-3 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900"
                    aria-label={attachedFile ? "Review document" : "Ask question"}
                  >
                    {attachedFile ? "Review" : "Ask"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md"
          onChange={onFileChosen}
          disabled={busy || streaming}
          className="hidden"
        />
      </div>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Authority-intake confirmation — unchanged behaviour from the old
          drop zone: the uploaded file was a regulation, not a subject
          doc, so no matter was created. Show an emerald confirmation and
          next-action buttons. */}
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
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-md bg-emerald-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-600 dark:bg-emerald-300 dark:text-emerald-950 dark:hover:bg-emerald-200"
                >
                  Upload OM
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
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

      {/* Q&A thread — user question + streamed answer. Lives below the
          composer so the composer stays in place for follow-up questions. */}
      {askedQuestion && (
        <section className="mt-4 space-y-3">
          <div className="rounded-md bg-neutral-50 px-3 py-2 text-sm dark:bg-neutral-900">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              You asked
            </div>
            <p className="mt-0.5 whitespace-pre-wrap text-neutral-800 dark:text-neutral-200">
              {askedQuestion}
            </p>
          </div>

          {summary && <QaSummaryBar summary={summary} />}

          <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold">Answer</h2>
              {streaming && <span className="text-xs text-neutral-400">streaming…</span>}
              {canClearAnswer && (
                <button
                  type="button"
                  onClick={clearAnswer}
                  className="ml-auto text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-900 dark:hover:text-neutral-100"
                >
                  New question
                </button>
              )}
            </div>
            {parsed ? (
              <CitedMarkdown
                content={parsed.prose}
                citations={parsed.citations}
                hoveredCitation={hoveredCitation}
                onHoverCitation={setHoveredCitation}
              />
            ) : (
              <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                {raw}
              </pre>
            )}
            {parsed && parsed.citations.length > 0 && (
              <CitationList
                citations={parsed.citations}
                hovered={hoveredCitation}
                onHover={setHoveredCitation}
              />
            )}
          </div>
        </section>
      )}

      {/* Sample shelf — hidden during upload/streaming and once a Q&A
          answer is on screen to avoid visual clutter. */}
      {!busy && !streaming && !askedQuestion && !authorityIntake && (
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
    </div>
  );
}

function QaSummaryBar({ summary }: { summary: QaSummary }) {
  const pct = Math.round(summary.confidence * 100);
  const confTone = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  const totalCitations =
    summary.citationsByJurisdiction.CA.length + summary.citationsByJurisdiction.US.length;
  return (
    <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3 text-xs">
        <span className="w-24 shrink-0 font-medium">Confidence</span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div className={`h-full transition-all ${confTone}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-10 text-right font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
          {pct}%
        </span>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-neutral-500">
        <span>
          <strong className="text-neutral-700 dark:text-neutral-300">{totalCitations}</strong>{" "}
          citation{totalCitations === 1 ? "" : "s"}
        </span>
        {summary.citationsByJurisdiction.CA.length > 0 && (
          <span>
            CA: <strong>{summary.citationsByJurisdiction.CA.length}</strong>
          </span>
        )}
        {summary.citationsByJurisdiction.US.length > 0 && (
          <span>
            US: <strong>{summary.citationsByJurisdiction.US.length}</strong>
          </span>
        )}
      </div>
      {summary.crossJurisdictionNote && (
        <div className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>Cross-jurisdiction note:</strong> both CA and US authorities were retrieved.
        </div>
      )}
    </div>
  );
}

function CitationList({
  citations,
  hovered,
  onHover,
}: {
  citations: Citation[];
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  return (
    <details className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
        Citations ({citations.length})
      </summary>
      <ol className="space-y-2 px-4 py-3 text-xs">
        {citations.map((c) => (
          <li
            key={c.id}
            id={`citation-${c.id}`}
            onMouseEnter={() => onHover(c.id)}
            onMouseLeave={() => onHover(null)}
            className={`rounded p-2 transition-colors ${
              hovered === c.id ? "bg-amber-100 dark:bg-amber-900/40" : "bg-transparent"
            }`}
          >
            <div className="font-mono text-[10px] text-amber-700 dark:text-amber-400">[{c.id}]</div>
            <div className="mt-0.5 font-medium text-neutral-800 dark:text-neutral-200">
              {c.authorityId} § {c.section}
              {c.page ? `, p.${c.page}` : ""}
            </div>
            <blockquote className="mt-1 border-l-2 border-neutral-300 pl-2 italic text-neutral-600 dark:border-neutral-700 dark:text-neutral-400">
              {c.quote}
            </blockquote>
          </li>
        ))}
      </ol>
    </details>
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
