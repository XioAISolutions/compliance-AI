"use client";

/**
 * AskForm — client component for /ask.
 *
 * Responsibilities:
 *   - Collect the question, jurisdictions, framework, and audience toggle.
 *   - Post to /api/ask and consume the SSE stream.
 *   - Render streaming prose; after the stream closes, parse out the
 *     citations fence via parseModelOutput and re-render with
 *     CitedMarkdown so [cN] markers become interactive superscripts.
 *   - Surface the route's terminal qa-summary event (confidence bar,
 *     divergence banner, per-jurisdiction citation panels).
 *
 * Stream parsing mirrors ChatPanel.tsx (same decoder + boundary logic),
 * kept inline here rather than extracted to a shared helper because the
 * event set differs — /api/ask emits `qa-summary` which /api/chat does
 * not.
 */

import { useMemo, useRef, useState } from "react";
import { parseModelOutput, type Citation } from "@compliance-ai/agents";
import { CitedMarkdown } from "../matters/[id]/CitedMarkdown";

type Jurisdiction = "CA" | "US";
type Audience = "professional" | "public";
type Framework = "soc2" | "gdpr" | "eu-ai-act" | "iso-27001" | "none";

/** SSE event shapes we care about on the client. */
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

export function AskForm() {
  const [question, setQuestion] = useState("");
  const [jurisdictions, setJurisdictions] = useState<Record<Jurisdiction, boolean>>({
    CA: true,
    US: true,
  });
  const [framework, setFramework] = useState<Framework>("none");
  const [audience, setAudience] = useState<Audience>("professional");

  const [streaming, setStreaming] = useState(false);
  const [raw, setRaw] = useState("");
  const [summary, setSummary] = useState<QaSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Parse citations once the stream completes — during streaming the
  // citations fence may be partial, so we render raw prose mid-flight and
  // only switch to CitedMarkdown after `done`.
  const parsed = useMemo(() => (done ? parseModelOutput(raw) : null), [done, raw]);

  const activeJurisdictions = Object.entries(jurisdictions)
    .filter(([, v]) => v)
    .map(([k]) => k as Jurisdiction);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || streaming) return;
    if (activeJurisdictions.length === 0) {
      setError("Pick at least one jurisdiction.");
      return;
    }

    setRaw("");
    setSummary(null);
    setError(null);
    setDone(false);
    setStreaming(true);
    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          jurisdictions: activeJurisdictions,
          ...(framework !== "none" ? { framework } : {}),
          audience,
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
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          if (!raw.startsWith("data: ")) continue;
          let event: StreamEvent;
          try {
            event = JSON.parse(raw.slice(6)) as StreamEvent;
          } catch {
            continue;
          }
          applyEvent(event);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setStreaming(false);
      setDone(true);
      abortRef.current = null;
    }
  }

  function applyEvent(event: StreamEvent) {
    switch (event.type) {
      case "text-delta":
        setRaw((prev) => prev + event.delta);
        break;
      case "qa-summary":
        setSummary({
          confidence: event.confidence,
          crossJurisdictionNote: event.crossJurisdictionNote,
          citationsByJurisdiction: event.citationsByJurisdiction,
        });
        break;
      case "error":
        setError(event.message);
        break;
      // persona-selected and done are no-ops here — the persona is always
      // qa-responder (no label needed) and the done-triggered parse
      // happens via the `done` flag set in the finally block.
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={submit}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950"
      >
        <div>
          <label htmlFor="question" className="mb-1 block text-sm font-medium">
            Your question
          </label>
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={streaming}
            rows={3}
            placeholder="e.g., Who qualifies as an accredited investor in Canada vs the US?"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="mb-1 text-sm font-medium">Jurisdictions</div>
            <div className="flex gap-3">
              <JurisdictionCheckbox
                code="CA"
                label="Canada"
                checked={jurisdictions.CA}
                disabled={streaming}
                onToggle={(v) => setJurisdictions((prev) => ({ ...prev, CA: v }))}
              />
              <JurisdictionCheckbox
                code="US"
                label="United States"
                checked={jurisdictions.US}
                disabled={streaming}
                onToggle={(v) => setJurisdictions((prev) => ({ ...prev, US: v }))}
              />
            </div>
          </div>

          <div>
            <label htmlFor="framework" className="mb-1 block text-sm font-medium">
              Framework (optional)
            </label>
            <select
              id="framework"
              value={framework}
              disabled={streaming}
              onChange={(e) => setFramework(e.target.value as Framework)}
              className="w-full rounded-md border border-neutral-300 bg-transparent px-2 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700"
            >
              <option value="none">— none —</option>
              <option value="soc2">SOC 2</option>
              <option value="gdpr">GDPR</option>
              <option value="eu-ai-act">EU AI Act</option>
              <option value="iso-27001">ISO 27001</option>
            </select>
          </div>

          <div>
            <div className="mb-1 text-sm font-medium">Audience</div>
            <div className="inline-flex rounded-md border border-neutral-300 text-xs dark:border-neutral-700">
              <AudienceButton
                active={audience === "professional"}
                disabled={streaming}
                onClick={() => setAudience("professional")}
              >
                Professional
              </AudienceButton>
              <AudienceButton
                active={audience === "public"}
                disabled={streaming}
                onClick={() => setAudience("public")}
              >
                Public
              </AudienceButton>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          {streaming ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!question.trim()}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
            >
              Ask
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {summary && <QaSummaryBar summary={summary} />}

      {(raw || streaming) && (
        <Answer
          raw={raw}
          parsed={parsed}
          streaming={streaming}
          audience={audience}
          summary={summary}
        />
      )}
    </div>
  );
}

function JurisdictionCheckbox({
  code,
  label,
  checked,
  disabled,
  onToggle,
}: {
  code: Jurisdiction;
  label: string;
  checked: boolean;
  disabled: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onToggle(e.target.checked)}
        className="accent-neutral-900 dark:accent-neutral-100"
      />
      <span className="select-none">
        <span className="font-mono text-xs text-neutral-500">{code}</span> {label}
      </span>
    </label>
  );
}

function AudienceButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-3 py-2 transition-colors ${
        active
          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
          : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
      } ${disabled ? "opacity-40" : ""}`}
    >
      {children}
    </button>
  );
}

function QaSummaryBar({ summary }: { summary: QaSummary }) {
  const pct = Math.round(summary.confidence * 100);
  const confTone = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  const totalCitations =
    summary.citationsByJurisdiction.CA.length + summary.citationsByJurisdiction.US.length;

  return (
    <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
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
        <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <strong>Cross-jurisdiction note:</strong> authorities were retrieved from both Canada and
          the United States. Scroll to the answer to see how the jurisdictions compare.
        </div>
      )}
    </div>
  );
}

function Answer({
  raw,
  parsed,
  streaming,
  audience,
  summary,
}: {
  raw: string;
  parsed: ReturnType<typeof parseModelOutput> | null;
  streaming: boolean;
  audience: Audience;
  summary: QaSummary | null;
}) {
  const citations: Citation[] = parsed?.citations ?? [];
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Answer</h2>
        {streaming && <span className="text-xs text-neutral-400">streaming…</span>}
        <span className="ml-auto text-xs text-neutral-500">
          audience:{" "}
          <span className="font-medium text-neutral-700 dark:text-neutral-300">{audience}</span>
        </span>
      </div>

      {parsed ? (
        <CitedMarkdown
          content={parsed.prose}
          citations={citations}
          hoveredCitation={hovered}
          onHoverCitation={setHovered}
        />
      ) : (
        // During streaming, just show the raw text — markdown formatting
        // may be mid-structure and CitedMarkdown would choke on a partial
        // fenced block.
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
          {raw}
        </pre>
      )}

      {parsed && citations.length > 0 && (
        <CitationPanels
          citations={citations}
          byJurisdiction={summary?.citationsByJurisdiction ?? { CA: [], US: [] }}
          hovered={hovered}
          onHover={setHovered}
        />
      )}
    </section>
  );
}

function CitationPanels({
  citations,
  byJurisdiction,
  hovered,
  onHover,
}: {
  citations: Citation[];
  byJurisdiction: { CA: string[]; US: string[] };
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  const caSet = new Set(byJurisdiction.CA);
  const usSet = new Set(byJurisdiction.US);
  const caCites = citations.filter((c) => caSet.has(c.docId));
  const usCites = citations.filter((c) => usSet.has(c.docId));
  const unscoped = citations.filter((c) => !caSet.has(c.docId) && !usSet.has(c.docId));

  return (
    <div className="mt-6 space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      {caCites.length > 0 && (
        <CitationGroup
          title="Canadian authorities"
          citations={caCites}
          hovered={hovered}
          onHover={onHover}
        />
      )}
      {usCites.length > 0 && (
        <CitationGroup
          title="US authorities"
          citations={usCites}
          hovered={hovered}
          onHover={onHover}
        />
      )}
      {unscoped.length > 0 && (
        <CitationGroup
          title="Other citations"
          citations={unscoped}
          hovered={hovered}
          onHover={onHover}
        />
      )}
    </div>
  );
}

function CitationGroup({
  title,
  citations,
  hovered,
  onHover,
}: {
  title: string;
  citations: Citation[];
  hovered: string | null;
  onHover: (id: string | null) => void;
}) {
  return (
    <details
      className="rounded-md border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
      open
    >
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400">
        {title} ({citations.length})
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
