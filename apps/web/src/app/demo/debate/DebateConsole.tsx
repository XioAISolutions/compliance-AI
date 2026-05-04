"use client";

import { useEffect, useState } from "react";

interface DebateStartedEvent {
  type: "debate-started";
  provider: string;
  model: string;
  baseUrl?: string;
  voiceCount: number;
  voiceNames: string[];
}

interface VoiceCompletedEvent {
  type: "voice-completed";
  index: number;
  name: string;
  status: "ok" | "error" | "timeout";
  prose: string;
  citations: Array<{ id: string; authorityId: string; quote?: string }>;
  usage: { inputTokens: number; outputTokens: number };
  error?: string;
}

interface DebateDoneEvent {
  type: "debate-done";
  durationMs: number;
  wallClockMs: number;
}

interface ErrorEvent {
  type: "error";
  message: string;
}

type DebateEvent = DebateStartedEvent | VoiceCompletedEvent | DebateDoneEvent | ErrorEvent;

interface VoiceState {
  name: string;
  status: "pending" | "ok" | "error" | "timeout";
  prose: string;
  citations: VoiceCompletedEvent["citations"];
  error?: string;
  outputTokens: number;
}

interface PingResult {
  ok: boolean;
  provider: string;
  model: string;
  baseUrl?: string;
  latencyMs: number;
  sample: string;
}

const DEFAULT_PROMPT = `Review this offering memorandum excerpt against Ontario NI 45-106 and surface the top 3 disclosure gaps a compliance reviewer should raise:

"The issuer offers Class A units to accredited investors only. Past performance has consistently exceeded benchmarks. Subscription proceeds will be applied to general working capital. Risk factors are listed in Schedule B."`;

export function DebateConsole() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [running, setRunning] = useState(false);
  const [voices, setVoices] = useState<VoiceState[]>([]);
  const [meta, setMeta] = useState<DebateStartedEvent | null>(null);
  const [done, setDone] = useState<DebateDoneEvent | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ping, setPing] = useState<PingResult | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/healthcheck/llm")
      .then((r) => r.json())
      .then((data: PingResult) => {
        if (!cancelled) setPing(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setPingError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run() {
    setRunning(true);
    setVoices([]);
    setMeta(null);
    setDone(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMessage: prompt }),
      });
      if (!res.ok || !res.body) {
        throw new Error(`/api/debate returned ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split(/\r?\n\r?\n/);
        buffer = frames.pop() ?? "";
        for (const frame of frames) {
          for (const line of frame.split(/\r?\n/)) {
            const data = line.startsWith("data:") ? line.slice(5).trim() : null;
            if (!data) continue;
            try {
              const event = JSON.parse(data) as DebateEvent;
              if (event.type === "debate-started") {
                setMeta(event);
                setVoices(
                  event.voiceNames.map((name) => ({
                    name,
                    status: "pending",
                    prose: "",
                    citations: [],
                    outputTokens: 0,
                  })),
                );
              } else if (event.type === "voice-completed") {
                setVoices((prev) => {
                  const next = [...prev];
                  next[event.index] = {
                    name: event.name,
                    status: event.status,
                    prose: event.prose,
                    citations: event.citations,
                    ...(event.error ? { error: event.error } : {}),
                    outputTokens: event.usage?.outputTokens ?? 0,
                  };
                  return next;
                });
              } else if (event.type === "debate-done") {
                setDone(event);
              } else if (event.type === "error") {
                setErrorMsg(event.message);
              }
            } catch {
              // ignore non-JSON frames
            }
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <ProviderBar ping={ping} pingError={pingError} meta={meta} />

      <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
        <label className="text-xs font-medium uppercase text-neutral-500">Compliance prompt</label>
        <textarea
          className="mt-2 w-full rounded-md border border-neutral-300 bg-transparent p-3 font-mono text-sm leading-relaxed dark:border-neutral-700"
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={running || !prompt.trim()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
          >
            {running ? "Running debate…" : "Run debate"}
          </button>
          {done && (
            <span className="text-xs text-neutral-500">
              {voices.filter((v) => v.status === "ok").length}/{voices.length} voices in{" "}
              {(done.wallClockMs / 1000).toFixed(1)}s wall, server{" "}
              {(done.durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {errorMsg && <span className="text-xs text-red-600 dark:text-red-400">{errorMsg}</span>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {voices.length === 0 && !running && (
          <div className="col-span-3 rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
            Click <strong>Run debate</strong> to send the prompt to all three voices on the
            configured model.
          </div>
        )}
        {voices.map((voice) => (
          <VoiceCard key={voice.name} voice={voice} />
        ))}
      </div>
    </div>
  );
}

function ProviderBar({
  ping,
  pingError,
  meta,
}: {
  ping: PingResult | null;
  pingError: string | null;
  meta: DebateStartedEvent | null;
}) {
  const provider = meta?.provider ?? ping?.provider;
  const model = meta?.model ?? ping?.model;
  const baseUrl = meta?.baseUrl ?? ping?.baseUrl;
  const ok = ping?.ok ?? null;

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3">
        <span
          className={
            ok === true
              ? "inline-block h-2 w-2 rounded-full bg-emerald-500"
              : ok === false
                ? "inline-block h-2 w-2 rounded-full bg-red-500"
                : "inline-block h-2 w-2 animate-pulse rounded-full bg-yellow-500"
          }
        />
        <span className="font-medium text-neutral-700 dark:text-neutral-200">
          {provider ?? "?"}
        </span>
        <span className="text-neutral-500">→</span>
        <span className="font-mono text-neutral-700 dark:text-neutral-200">{model ?? "?"}</span>
        {baseUrl && (
          <span className="ml-2 truncate text-neutral-500" title={baseUrl}>
            {baseUrl}
          </span>
        )}
        {ping && ping.ok && (
          <span className="ml-auto text-neutral-500">
            ping {ping.latencyMs}ms · sample “{ping.sample.trim()}”
          </span>
        )}
      </div>
      {pingError && (
        <div className="mt-2 text-red-600 dark:text-red-400">/api/healthcheck/llm: {pingError}</div>
      )}
    </div>
  );
}

function VoiceCard({ voice }: { voice: VoiceState }) {
  const colorClass =
    voice.status === "ok"
      ? "border-emerald-300 dark:border-emerald-700"
      : voice.status === "error"
        ? "border-red-300 dark:border-red-700"
        : voice.status === "timeout"
          ? "border-amber-300 dark:border-amber-700"
          : "border-neutral-300 dark:border-neutral-700";

  return (
    <article className={`rounded-lg border ${colorClass} p-4`}>
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{voice.name}</h3>
        <StatusPill status={voice.status} />
      </header>
      {voice.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{voice.error}</p>}
      <div className="mt-3 max-h-96 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
        {voice.status === "pending" ? (
          <span className="italic text-neutral-500">awaiting…</span>
        ) : (
          voice.prose || <span className="italic text-neutral-500">empty</span>
        )}
      </div>
      {voice.citations.length > 0 && (
        <div className="mt-3 border-t border-neutral-200 pt-2 text-xs text-neutral-500 dark:border-neutral-800">
          {voice.citations.length} citation
          {voice.citations.length === 1 ? "" : "s"} · {voice.outputTokens} output tokens
        </div>
      )}
    </article>
  );
}

function StatusPill({ status }: { status: VoiceState["status"] }) {
  const styles: Record<VoiceState["status"], string> = {
    pending: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    timeout: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${styles[status]}`}
    >
      {status === "pending" ? "running" : status}
    </span>
  );
}
