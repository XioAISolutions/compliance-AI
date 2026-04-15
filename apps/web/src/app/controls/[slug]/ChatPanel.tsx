"use client";

/**
 * ChatPanel — consumes /api/chat SSE stream.
 *
 * Two execution modes:
 *   - Single mode (default)        — one assistant bubble per send. The router
 *                                    picks the persona; the bubble labels
 *                                    itself via `persona-selected`.
 *   - Loop mode (judge iterates)   — N assistant bubbles per send (drafter +
 *                                    judge per round). Verdict badges appear
 *                                    on judge bubbles; a footer summarizes
 *                                    total rounds and the final verdict.
 *
 * Stream-handling shape:
 *   - Single mode pre-creates ONE assistant bubble at send-time; events apply
 *     to "the last assistant turn".
 *   - Loop mode pre-creates ZERO assistant bubbles; each `round-started` event
 *     pushes a new bubble. Subsequent text-delta / done / verdict-final apply
 *     to the most recent assistant bubble.
 */

import { useRef, useState } from "react";

type JudgeVerdict = "READY_TO_SUBMIT" | "ITERATE" | "REWRITE";

type AgentEvent =
  | { type: "persona-selected"; persona: string; reason: string }
  | { type: "text-delta"; delta: string }
  | {
      type: "done";
      usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
    }
  | { type: "round-started"; round: number; persona: string }
  | { type: "verdict-final"; verdict: JudgeVerdict }
  | { type: "loop-done"; totalRounds: number; finalVerdict: JudgeVerdict | null }
  | { type: "error"; message: string };

type AgentUsage = Extract<AgentEvent, { type: "done" }>["usage"];

interface Turn {
  role: "user" | "assistant";
  content: string;
  persona?: string;
  personaReason?: string;
  usage?: AgentUsage;
  error?: string;
  /** Loop-mode only. The (1-based) round this assistant bubble belongs to. */
  round?: number;
  /** Loop-mode only. Set when persona === "judge" and verdict-final fires. */
  verdict?: JudgeVerdict;
  /**
   * Loop-mode only. Decorates the *user* turn after `loop-done` fires so the
   * summary visually anchors to the question that triggered the loop.
   */
  loopSummary?: { totalRounds: number; finalVerdict: JudgeVerdict | null };
}

interface Props {
  controlSlug: string;
  controlTitle: string;
}

export function ChatPanel({ controlSlug, controlTitle }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [loopMode, setLoopMode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function send() {
    const message = draft.trim();
    if (!message || streaming) return;

    setDraft("");
    setStreaming(true);

    const userTurn: Turn = { role: "user", content: message };
    // Single mode pre-creates the assistant bubble. Loop mode waits for
    // `round-started` to push bubbles per round.
    const seedTurns: Turn[] = loopMode
      ? [userTurn]
      : [userTurn, { role: "assistant", content: "" }];
    setTurns((prev) => [...prev, ...seedTurns]);
    const userTurnIndex = turns.length + (seedTurns.length - 1) - (loopMode ? 0 : 1);

    abortRef.current = new AbortController();

    try {
      const history = turns.map((t) => ({ role: t.role, content: t.content }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          controlSlug,
          history,
          message,
          mode: loopMode ? "loop" : "single",
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by blank lines (\n\n).
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");

          if (!raw.startsWith("data: ")) continue;
          let event: AgentEvent;
          try {
            event = JSON.parse(raw.slice(6)) as AgentEvent;
          } catch {
            continue; // skip malformed
          }
          applyEvent(event, userTurnIndex);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          last.error = message;
        } else {
          // Loop mode may have no assistant bubble yet at the time of error.
          next.push({ role: "assistant", content: "", error: message });
        }
        return next;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  /**
   * Apply one SSE event to the turn list. `userTurnIndex` is the index of the
   * user message that triggered the current send — used by `loop-done` to
   * attach the summary to the right turn even if more turns were pushed since.
   */
  function applyEvent(event: AgentEvent, userTurnIndex: number) {
    setTurns((prev) => {
      const next = [...prev];

      switch (event.type) {
        case "round-started": {
          // Loop mode: push a new assistant bubble for this round/persona.
          next.push({
            role: "assistant",
            content: "",
            persona: event.persona,
            round: event.round,
          });
          break;
        }
        case "persona-selected": {
          const last = next[next.length - 1];
          if (last && last.role === "assistant") {
            // In loop mode, round-started already labeled this bubble — keep
            // that label but capture the reason for the tooltip.
            last.persona = last.persona ?? event.persona;
            last.personaReason = event.reason;
          }
          break;
        }
        case "text-delta": {
          const last = next[next.length - 1];
          if (last && last.role === "assistant") last.content += event.delta;
          break;
        }
        case "done": {
          const last = next[next.length - 1];
          if (last && last.role === "assistant") last.usage = event.usage;
          break;
        }
        case "verdict-final": {
          // Decorate the most recent judge bubble. Walk backwards to be safe
          // even if a future event interleaves things.
          for (let i = next.length - 1; i >= 0; i--) {
            const t = next[i];
            if (!t) continue;
            if (t.role === "assistant" && t.persona === "judge") {
              t.verdict = event.verdict;
              break;
            }
          }
          break;
        }
        case "loop-done": {
          const userTurn = next[userTurnIndex];
          if (userTurn && userTurn.role === "user") {
            userTurn.loopSummary = {
              totalRounds: event.totalRounds,
              finalVerdict: event.finalVerdict,
            };
          }
          break;
        }
        case "error": {
          const last = next[next.length - 1];
          if (last && last.role === "assistant") last.error = event.message;
          break;
        }
      }
      return next;
    });
  }

  function stop() {
    abortRef.current?.abort();
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <header className="mb-3 border-b border-neutral-100 pb-3 dark:border-neutral-900">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Ask the compliance agent</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Anchored to <span className="font-medium">{controlTitle}</span>.{" "}
              {loopMode
                ? "Loop mode: drafter writes, judge audits, drafter revises until READY_TO_SUBMIT."
                : "The router picks a persona (drafter, reviewer, evidence-collector, risk-assessor) from your message."}
            </p>
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={loopMode}
              disabled={streaming}
              onChange={(e) => setLoopMode(e.target.checked)}
              className="accent-amber-600"
            />
            <span className="select-none">Iterate with judge</span>
          </label>
        </div>
      </header>

      <div className="max-h-[480px] space-y-4 overflow-y-auto">
        {turns.length === 0 && (
          <p className="text-sm text-neutral-500">
            Try: <em>&ldquo;Draft a policy statement for this control.&rdquo;</em> or{" "}
            <em>&ldquo;What evidence proves this is operating?&rdquo;</em>
          </p>
        )}
        {turns.map((turn, i) => (
          <TurnView key={i} turn={turn} />
        ))}
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={streaming}
          placeholder={loopMode ? "Ask for a draft to iterate on…" : "Ask about this control…"}
          className="flex-1 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none dark:border-neutral-700"
        />
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
            disabled={!draft.trim()}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm text-white hover:bg-neutral-700 disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}

/** Color theme for persona pills + verdict badges. Centralized so the */
/* badge in the loop summary stays consistent with the per-bubble badge.   */
const PERSONA_PILL_CLASS: Record<string, string> = {
  drafter: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  judge: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  reviewer: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  "evidence-collector": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "risk-assessor": "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

const VERDICT_BADGE_CLASS: Record<JudgeVerdict, string> = {
  READY_TO_SUBMIT: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  ITERATE: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  REWRITE: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function personaPillClass(persona?: string): string {
  if (!persona) return "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300";
  return (
    PERSONA_PILL_CLASS[persona] ??
    "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
  );
}

function TurnView({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="space-y-2">
        <div className="rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
          {turn.content}
        </div>
        {turn.loopSummary && (
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>
              Loop converged in <strong>{turn.loopSummary.totalRounds}</strong> round
              {turn.loopSummary.totalRounds === 1 ? "" : "s"} →
            </span>
            {turn.loopSummary.finalVerdict ? (
              <span
                className={`rounded-full px-2 py-0.5 font-medium ${VERDICT_BADGE_CLASS[turn.loopSummary.finalVerdict]}`}
              >
                {turn.loopSummary.finalVerdict}
              </span>
            ) : (
              <span className="italic">no verdict</span>
            )}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2 text-xs">
        {turn.round !== undefined && (
          <span className="rounded-full bg-neutral-200 px-2 py-0.5 font-mono text-[10px] text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            R{turn.round}
          </span>
        )}
        {turn.persona && (
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${personaPillClass(turn.persona)}`}
          >
            {turn.persona}
          </span>
        )}
        {turn.verdict && (
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${VERDICT_BADGE_CLASS[turn.verdict]}`}
            title="Verdict parsed from judge output"
          >
            {turn.verdict}
          </span>
        )}
        {turn.personaReason && !turn.round && (
          <span className="text-neutral-500">{turn.personaReason}</span>
        )}
      </div>
      <div className="whitespace-pre-wrap leading-relaxed text-neutral-800 dark:text-neutral-200">
        {turn.content || (turn.error ? "" : <span className="text-neutral-400">…</span>)}
      </div>
      {turn.error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {turn.error}
        </div>
      )}
      {turn.usage && (
        <div className="text-xs text-neutral-400">
          {turn.usage.inputTokens} in / {turn.usage.outputTokens} out
          {turn.usage.cacheReadTokens > 0 && ` (${turn.usage.cacheReadTokens} from cache)`}
        </div>
      )}
    </div>
  );
}
