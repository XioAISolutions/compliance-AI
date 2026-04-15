"use client";

/**
 * ChatPanel — consumes /api/chat SSE stream.
 *
 * Renders, in order: persona badge (which agent answered), streaming markdown
 * text (raw text for now; a markdown renderer is Day 3+), and a per-turn
 * usage line so we can eyeball token + cache-hit behavior in dev.
 */

import { useRef, useState } from "react";

type AgentEvent =
  | { type: "persona-selected"; persona: string; reason: string }
  | { type: "text-delta"; delta: string }
  | {
      type: "done";
      usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number };
    }
  | { type: "error"; message: string };

type AgentUsage = Extract<AgentEvent, { type: "done" }>["usage"];

interface Turn {
  role: "user" | "assistant";
  content: string;
  persona?: string;
  personaReason?: string;
  usage?: AgentUsage;
  error?: string;
}

interface Props {
  controlSlug: string;
  controlTitle: string;
}

export function ChatPanel({ controlSlug, controlTitle }: Props) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function send() {
    const message = draft.trim();
    if (!message || streaming) return;

    setDraft("");
    setStreaming(true);

    const userTurn: Turn = { role: "user", content: message };
    const assistantTurn: Turn = { role: "assistant", content: "" };
    setTurns((prev) => [...prev, userTurn, assistantTurn]);

    abortRef.current = new AbortController();

    try {
      const history = turns.map((t) => ({ role: t.role, content: t.content }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlSlug, history, message }),
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
          applyEvent(event);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTurns((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          last.error = message;
        }
        return next;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function applyEvent(event: AgentEvent) {
    setTurns((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (!last || last.role !== "assistant") return prev;

      switch (event.type) {
        case "persona-selected":
          last.persona = event.persona;
          last.personaReason = event.reason;
          break;
        case "text-delta":
          last.content += event.delta;
          break;
        case "done":
          last.usage = event.usage;
          break;
        case "error":
          last.error = event.message;
          break;
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
        <h2 className="text-sm font-semibold">Ask the compliance agent</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Anchored to <span className="font-medium">{controlTitle}</span>. The router picks a
          persona (drafter, reviewer, evidence-collector, risk-assessor) from your message.
        </p>
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
          placeholder="Ask about this control…"
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

function TurnView({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="rounded-md bg-neutral-100 p-3 text-sm dark:bg-neutral-900">
        {turn.content}
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      {turn.persona && (
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            {turn.persona}
          </span>
          <span className="text-neutral-500">{turn.personaReason}</span>
        </div>
      )}
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
