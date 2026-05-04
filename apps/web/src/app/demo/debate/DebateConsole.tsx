"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEBATE_TEMPLATES, type DebateTemplate, type DebateVoice } from "@compliance-ai/agents";

type VoiceStatus = "pending" | "running" | "ok" | "error" | "timeout";

interface VoiceState {
  name: string;
  status: VoiceStatus;
  prose: string;
  error?: string;
  outputTokens: number;
  citationCount: number;
}

interface PingResult {
  ok: boolean;
  provider: string;
  model: string;
  baseUrl?: string;
  latencyMs: number;
  sample: string;
}

interface DebateMeta {
  provider: string;
  model: string;
  baseUrl?: string;
  retrievedSnippets: number;
}

interface DoneInfo {
  wallClockMs: number;
}

interface SynthesisInfo {
  agreed: string[];
  disagreed: string[];
  verdict: string;
}

const TEMPLATES: DebateTemplate[] = DEBATE_TEMPLATES;

export function DebateConsole() {
  const [templateId, setTemplateId] = useState<string>(TEMPLATES[0]!.id);
  const template = useMemo(
    () => TEMPLATES.find((t) => t.id === templateId) ?? TEMPLATES[0]!,
    [templateId],
  );
  const [prompt, setPrompt] = useState(template.prompt);
  const [voices, setVoices] = useState<DebateVoice[]>(template.voices);
  const [editingVoices, setEditingVoices] = useState(false);

  const [running, setRunning] = useState(false);
  const [voiceStates, setVoiceStates] = useState<VoiceState[]>([]);
  const [meta, setMeta] = useState<DebateMeta | null>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [synthesis, setSynthesis] = useState<SynthesisInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ping, setPing] = useState<PingResult | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Live ping on mount so the status bar shows the configured provider.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/healthcheck/llm")
      .then((r) => r.json())
      .then((data: PingResult) => {
        if (!cancelled) setPing(data);
      })
      .catch(() => {
        /* status bar shows "?" if ping fails */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Switching templates resets prompt + voices to the template defaults.
  // Skip during the initial render to avoid clobbering local edits on hot reload.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPrompt(template.prompt);
    setVoices(template.voices);
    setVoiceStates([]);
    setMeta(null);
    setDone(null);
  }, [template]);

  async function run() {
    setRunning(true);
    setVoiceStates(
      voices.map((v) => ({
        name: v.name,
        status: "pending",
        prose: "",
        outputTokens: 0,
        citationCount: 0,
      })),
    );
    setMeta(null);
    setDone(null);
    setSynthesis(null);
    setErrorMsg(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: prompt,
          voices,
          // Compliance template uses retrieved authorities; universal templates do not.
          retrieveAuthorities: templateId === "compliance",
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`/api/debate returned ${res.status}`);

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
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            try {
              applyEvent(JSON.parse(data));
            } catch {
              /* non-JSON frames are tolerated */
            }
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // Stop button — leave whatever streamed in place, mark unfinished
        // voices as cancelled.
        setVoiceStates((prev) =>
          prev.map((v) =>
            v.status === "pending" || v.status === "running"
              ? { ...v, status: "error", error: "stopped" }
              : v,
          ),
        );
      } else {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }

  function applyEvent(event: Record<string, unknown>) {
    if (event.type === "debate-started") {
      setMeta({
        provider: String(event.provider ?? ""),
        model: String(event.model ?? ""),
        ...(event.baseUrl ? { baseUrl: String(event.baseUrl) } : {}),
        retrievedSnippets: Number(event.retrievedSnippets ?? 0),
      });
    } else if (event.type === "voice-started") {
      const i = Number(event.index);
      setVoiceStates((prev) => {
        const next = [...prev];
        if (next[i]) next[i] = { ...next[i], status: "running" };
        return next;
      });
    } else if (event.type === "voice-delta") {
      const i = Number(event.index);
      const delta = String(event.delta ?? "");
      setVoiceStates((prev) => {
        const next = [...prev];
        if (next[i]) next[i] = { ...next[i], prose: next[i].prose + delta };
        return next;
      });
    } else if (event.type === "voice-completed") {
      const i = Number(event.index);
      const status = (event.status as VoiceStatus) ?? "ok";
      const usage = (event.usage as { outputTokens?: number } | undefined) ?? {};
      const citations = Array.isArray(event.citations) ? event.citations.length : 0;
      setVoiceStates((prev) => {
        const next = [...prev];
        if (next[i]) {
          next[i] = {
            ...next[i],
            status,
            prose: String(event.prose ?? next[i].prose),
            outputTokens: usage.outputTokens ?? 0,
            citationCount: citations,
            ...(event.error ? { error: String(event.error) } : {}),
          };
        }
        return next;
      });
    } else if (event.type === "synthesis") {
      setSynthesis({
        agreed: Array.isArray(event.agreed) ? event.agreed.map(String) : [],
        disagreed: Array.isArray(event.disagreed) ? event.disagreed.map(String) : [],
        verdict: String(event.verdict ?? ""),
      });
    } else if (event.type === "debate-done") {
      setDone({ wallClockMs: Number(event.wallClockMs ?? 0) });
    } else if (event.type === "error") {
      setErrorMsg(String(event.message ?? "unknown error"));
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function updateVoice(index: number, patch: Partial<DebateVoice>) {
    setVoices((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  }

  function addVoice() {
    setVoices((prev) => [
      ...prev,
      {
        name: `Voice ${prev.length + 1}`,
        systemPromptOverride:
          "You are a contrarian voice. Take a position the others would not take, and argue it concretely.",
      },
    ]);
  }

  function removeVoice(index: number) {
    setVoices((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-5">
      <ProviderBar ping={ping} meta={meta} />

      {/* Use-case template chips */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-xs uppercase text-neutral-500">Use case:</span>
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTemplateId(t.id)}
            disabled={running}
            title={t.useWhen}
            className={`rounded-full border px-3 py-1 text-xs ${
              t.id === templateId
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                : "border-neutral-300 text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="-mt-2 text-xs text-neutral-500">
        <span className="text-neutral-700 dark:text-neutral-300">{template.description}</span>{" "}
        <span className="text-neutral-500">· Use when: {template.useWhen}</span>
      </p>

      {/* Prompt textarea */}
      <div>
        <textarea
          className="w-full rounded-md border border-neutral-300 bg-transparent p-3 font-mono text-sm leading-relaxed dark:border-neutral-700"
          rows={6}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
          placeholder="Drop a prompt — code, contract, OM excerpt, business question…"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {!running ? (
            <button
              type="button"
              onClick={run}
              disabled={!prompt.trim() || voices.length === 0}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              Run debate
            </button>
          ) : (
            <button
              type="button"
              onClick={stop}
              className="rounded-md border border-red-500 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              Stop
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditingVoices((v) => !v)}
            disabled={running}
            className="text-xs text-neutral-500 underline-offset-4 hover:underline disabled:opacity-50"
          >
            {editingVoices ? "hide voices" : `edit voices (${voices.length})`}
          </button>
          {done && (
            <span className="text-xs text-neutral-500">
              {voiceStates.filter((v) => v.status === "ok").length}/{voiceStates.length} voices in{" "}
              {(done.wallClockMs / 1000).toFixed(1)}s
            </span>
          )}
          {errorMsg && (
            <span className="text-xs text-red-600 dark:text-red-400">{errorMsg}</span>
          )}
        </div>
      </div>

      {/* Editable voice panel */}
      {editingVoices && (
        <div className="rounded-lg border border-dashed border-neutral-300 p-4 dark:border-neutral-700">
          <div className="space-y-3">
            {voices.map((voice, i) => (
              <div key={i} className="grid gap-2 lg:grid-cols-[180px_1fr_auto]">
                <input
                  type="text"
                  value={voice.name}
                  onChange={(e) => updateVoice(i, { name: e.target.value })}
                  className="rounded border border-neutral-300 bg-transparent px-2 py-1 text-sm dark:border-neutral-700"
                  placeholder="Voice name"
                />
                <textarea
                  rows={2}
                  value={voice.systemPromptOverride ?? voice.systemPromptSuffix ?? ""}
                  onChange={(e) =>
                    updateVoice(i, voice.personaId
                      ? { systemPromptSuffix: e.target.value }
                      : { systemPromptOverride: e.target.value })
                  }
                  className="rounded border border-neutral-300 bg-transparent px-2 py-1 font-mono text-xs dark:border-neutral-700"
                  placeholder="System prompt or suffix"
                />
                <button
                  type="button"
                  onClick={() => removeVoice(i)}
                  disabled={voices.length <= 1}
                  className="text-xs text-neutral-500 hover:text-red-600 disabled:opacity-30"
                >
                  remove
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addVoice}
            className="mt-3 text-xs text-neutral-700 underline-offset-4 hover:underline dark:text-neutral-300"
          >
            + add voice
          </button>
        </div>
      )}

      {/* Synthesis — the headline takeaway. Shown above the cards once
          all voices land so a viewer reads the conclusion before the raw
          critique. The "still synthesizing…" placeholder appears while
          the post-debate model call is in flight. */}
      {(synthesis || (done && !synthesis && !errorMsg)) && (
        <SynthesisCard synthesis={synthesis} />
      )}

      {/* Voice cards grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {voiceStates.length === 0 && !running && (
          <div className="col-span-3 rounded-lg border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
            Click <strong>Run debate</strong> to send the prompt to all{" "}
            {voices.length} voices on the configured model.
          </div>
        )}
        {voiceStates.map((voice, i) => (
          <VoiceCard key={`${voice.name}-${i}`} voice={voice} />
        ))}
      </div>
    </div>
  );
}

function SynthesisCard({ synthesis }: { synthesis: SynthesisInfo | null }) {
  if (!synthesis) {
    return (
      <div className="rounded-lg border-2 border-dashed border-neutral-300 p-5 text-sm text-neutral-500 dark:border-neutral-700">
        <span className="italic">Synthesizing — reading all three voices to surface where they agree and diverge…</span>
      </div>
    );
  }
  return (
    <div className="rounded-lg border-2 border-neutral-900 bg-neutral-50 p-5 dark:border-white dark:bg-neutral-900">
      <p className="text-xs font-medium uppercase text-neutral-500">The takeaway</p>
      <p className="mt-2 text-base font-medium leading-relaxed text-neutral-900 dark:text-white">
        {synthesis.verdict || "—"}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">
            All voices agreed
          </p>
          {synthesis.agreed.length === 0 ? (
            <p className="mt-1 text-xs text-neutral-500">No common ground — read the cards.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
              {synthesis.agreed.map((a, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-emerald-500" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-amber-700 dark:text-amber-400">
            Voices diverged
          </p>
          {synthesis.disagreed.length === 0 ? (
            <p className="mt-1 text-xs text-neutral-500">Voices were aligned.</p>
          ) : (
            <ul className="mt-1 space-y-1 text-sm text-neutral-700 dark:text-neutral-300">
              {synthesis.disagreed.map((d, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 inline-block h-1.5 w-1.5 flex-none rounded-full bg-amber-500" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function ProviderBar({ ping, meta }: { ping: PingResult | null; meta: DebateMeta | null }) {
  const provider = meta?.provider ?? ping?.provider ?? "?";
  const model = meta?.model ?? ping?.model ?? "?";
  const baseUrl = meta?.baseUrl ?? ping?.baseUrl;
  const ok = ping?.ok ?? null;

  const dotClass =
    ok === true
      ? "bg-emerald-500"
      : ok === false
        ? "bg-red-500"
        : "bg-yellow-500 animate-pulse";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
      <span className="font-medium text-neutral-700 dark:text-neutral-200">{provider}</span>
      <span className="text-neutral-500">→</span>
      <span className="font-mono text-neutral-700 dark:text-neutral-200">{model}</span>
      {baseUrl && (
        <span className="truncate text-neutral-500" title={baseUrl}>
          {baseUrl}
        </span>
      )}
      <span className="ml-auto text-neutral-500">
        {ping?.ok ? `${ping.latencyMs}ms · "${ping.sample.trim()}"` : "checking…"}
      </span>
      {meta && meta.retrievedSnippets > 0 && (
        <span className="text-neutral-500">· {meta.retrievedSnippets} authorities retrieved</span>
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
          : voice.status === "running"
            ? "border-blue-400 dark:border-blue-600"
            : "border-neutral-300 dark:border-neutral-700";

  function copyMarkdown() {
    const text = `## ${voice.name}\n\n${voice.prose.trim()}\n`;
    navigator.clipboard?.writeText(text).catch(() => {
      /* clipboard might be denied; silent */
    });
  }

  return (
    <article className={`flex flex-col rounded-lg border ${colorClass} p-4`}>
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{voice.name}</h3>
        <div className="flex items-center gap-2">
          <StatusPill status={voice.status} />
          {(voice.status === "ok" || voice.status === "error") && voice.prose && (
            <button
              type="button"
              onClick={copyMarkdown}
              title="Copy as markdown"
              className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              copy
            </button>
          )}
        </div>
      </header>
      {voice.error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{voice.error}</p>
      )}
      <div className="mt-3 max-h-96 flex-1 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
        {voice.status === "pending" ? (
          <span className="italic text-neutral-500">awaiting…</span>
        ) : voice.prose ? (
          <>
            {voice.prose}
            {voice.status === "running" && (
              <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-neutral-400 align-baseline dark:bg-neutral-500" />
            )}
          </>
        ) : (
          <span className="italic text-neutral-500">streaming…</span>
        )}
      </div>
      <footer className="mt-3 border-t border-neutral-200 pt-2 text-xs text-neutral-500 dark:border-neutral-800">
        {voice.outputTokens > 0
          ? `${voice.outputTokens} output tokens${voice.citationCount > 0 ? ` · ${voice.citationCount} citation${voice.citationCount === 1 ? "" : "s"}` : ""}`
          : voice.status === "running"
            ? "streaming"
            : voice.status === "pending"
              ? "queued"
              : "—"}
      </footer>
    </article>
  );
}

function StatusPill({ status }: { status: VoiceStatus }) {
  const styles: Record<VoiceStatus, string> = {
    pending: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
    running: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    ok: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    timeout: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${styles[status]}`}
    >
      {status}
    </span>
  );
}
