"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEBATE_TEMPLATES, type DebateTemplate, type DebateVoice } from "@compliance-ai/agents";
import { DEBATE_SAMPLES } from "./samples";

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
  latencyMs: number;
  sample: string;
  outputTokens?: number;
  tokensPerSec?: number;
  modelInfo?: {
    id: string;
    maxContextTokens: number | null;
    ownedBy: string | null;
  };
  engineMetrics?: {
    requestsRunning: number;
    requestsWaiting: number;
    promptTokensTotal: number;
    generationTokensTotal: number;
    gpuCacheUsage: number | null;
    engineSleepState: "awake" | "weights_offloaded" | "discard_all" | null;
  };
}

interface DebateMeta {
  provider: string;
  model: string;
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

interface FollowupState {
  name: string;
  status: "pending" | "running" | "ok" | "error";
  stance: "defended" | "updated" | "conceded" | "unclear";
  prose: string;
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
  const [enableFollowup, setEnableFollowup] = useState(false);
  const [followups, setFollowups] = useState<Array<FollowupState | null>>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ping, setPing] = useState<PingResult | null>(null);
  const [expandedVoices, setExpandedVoices] = useState<Set<number>>(new Set());

  // Live throughput tracking: every voice-delta event bumps this counter
  // with a timestamp. We compute tokens/sec over a sliding window. The GPU
  // story is "this is how fast the MI300X is right now" — judges see it
  // live, not as a single ping number.
  const [liveTps, setLiveTps] = useState<{ tokensPerSec: number; totalChars: number } | null>(null);
  const tpsRef = useRef<{ start: number; chars: number } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Mirror voiceStates into a ref so the followup-done handler can reason about
  // total voice count without depending on stale closures.
  const voiceStatesRef = useRef<VoiceState[]>([]);
  useEffect(() => {
    voiceStatesRef.current = voiceStates;
  }, [voiceStates]);

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

  const firstRender = useRef(true);
  const preserveHashPromptOnce = useRef(false);
  const autoSampleOnFirstVisit = useRef(false);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      // First-render permalink hydration: if the URL has #q=... use it as
      // the prompt, and #t=<id> selects the template. Encoded as base64
      // utf-8 so prompts with special chars survive a round-trip through
      // the URL bar. New: #r=<base64-json> hydrates a full RESULT
      // (verdict + voices + optional round-2 stances) so a shared link
      // shows a debate that already happened — no inference cost on the
      // recipient's side.
      let hadResultParam = false;
      try {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const t = hash.get("t");
        const q = hash.get("q");
        const r = hash.get("r");
        if (t && TEMPLATES.some((tpl) => tpl.id === t)) setTemplateId(t);
        if (q) {
          const decoded = decodeURIComponent(escape(window.atob(q)));
          if (decoded.length > 0 && decoded.length < 8000) {
            setPrompt(decoded);
            preserveHashPromptOnce.current = Boolean(t);
          }
        }
        if (r) {
          hadResultParam = applyResultHash(r);
        }
      } catch {
        /* malformed hash → ignore */
      }

      // First-visit auto-sample: a judge / first-time visitor sees the
      // page populated with rich content INSTANTLY, with no API call and
      // no GPU cost. Only fires when (a) no prior visit recorded,
      // (b) no prompt + result were hydrated from the URL hash. Uses
      // localStorage as a once-flag.
      if (!hadResultParam) {
        try {
          const seen = window.localStorage.getItem("compliance-ai:debate-visited");
          if (!seen) {
            window.localStorage.setItem("compliance-ai:debate-visited", new Date().toISOString());
            autoSampleOnFirstVisit.current = true;
          }
        } catch {
          /* localStorage unavailable (private window, etc.) — silently skip */
        }
      }
      return;
    }
    if (preserveHashPromptOnce.current) {
      preserveHashPromptOnce.current = false;
    } else {
      setPrompt(template.prompt);
    }
    setVoices(template.voices);
    setVoiceStates([]);
    setMeta(null);
    setDone(null);
    setSynthesis(null);
    setExpandedVoices(new Set());
    setLiveTps(null);
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
    setFollowups([]);
    setErrorMsg(null);
    setExpandedVoices(new Set());
    setLiveTps(null);
    tpsRef.current = null;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: prompt,
          voices,
          retrieveAuthorities: templateId === "compliance",
          followup: enableFollowup,
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
              /* non-JSON frames tolerated */
            }
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
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
      // Live throughput: chars/sec is an approximation of tokens/sec
      // (rule of thumb: ~4 chars per token in English). We compute it on
      // a 3-second sliding window so the number doesn't jump around per
      // delta. Surfacing this makes the AMD MI300X horsepower visible.
      const now = Date.now();
      if (!tpsRef.current) tpsRef.current = { start: now, chars: 0 };
      tpsRef.current.chars += delta.length;
      const elapsed = (now - tpsRef.current.start) / 1000;
      if (elapsed > 0.5) {
        const charsPerSec = tpsRef.current.chars / elapsed;
        setLiveTps({
          tokensPerSec: Math.round(charsPerSec / 4),
          totalChars: tpsRef.current.chars,
        });
      }
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
    } else if (event.type === "followup-started") {
      const i = Number(event.index);
      const name = String(event.name ?? "");
      setFollowups((prev) => {
        const next = [...prev];
        const idx = next.findIndex((f) => f?.name === name);
        const entry: FollowupState = {
          name,
          status: "running",
          stance: "unclear",
          prose: "",
        };
        if (idx >= 0) next[idx] = entry;
        else next[i] = entry;
        return next;
      });
    } else if (event.type === "followup-delta") {
      const i = Number(event.index);
      const delta = String(event.delta ?? "");
      setFollowups((prev) => {
        const next = [...prev];
        if (next[i]) next[i] = { ...next[i], prose: next[i].prose + delta };
        return next;
      });
    } else if (event.type === "followup-completed") {
      const i = Number(event.index);
      setFollowups((prev) => {
        const next = [...prev];
        const current = next[i];
        if (current) {
          next[i] = {
            ...current,
            status: "ok",
            stance: (event.stance as FollowupState["stance"]) ?? "unclear",
            prose: String(event.prose ?? current.prose),
          };
        }
        return next;
      });
    } else if (event.type === "followup-done") {
      // Place each follow-up at its ORIGINAL voice index, not at its position in
      // the response array. When a round-1 voice errors it gets skipped from the
      // follow-up batch — packing the response array dense would shift voices
      // into the wrong card. Using f.index keeps the visual mapping honest.
      const arr = Array.isArray(event.followups) ? event.followups : [];
      setFollowups((prev) => {
        const totalSlots = Math.max(prev.length, voiceStatesRef.current.length);
        const next: Array<FollowupState | null> = new Array(totalSlots).fill(null);
        for (let i = 0; i < prev.length; i++) {
          const p = prev[i];
          if (p) next[i] = p;
        }
        for (const f of arr) {
          const o = f as Record<string, unknown>;
          const idx = Number(o.index);
          if (!Number.isFinite(idx)) continue;
          next[idx] = {
            name: String(o.name ?? ""),
            status: (o.status as FollowupState["status"]) ?? "ok",
            stance: (o.stance as FollowupState["stance"]) ?? "unclear",
            prose: String(o.prose ?? ""),
          };
        }
        return next;
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

  function resetToExample() {
    setPrompt(template.prompt);
    setVoices(template.voices);
  }

  function toggleVoiceExpanded(i: number) {
    setExpandedVoices((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function copyFullReport() {
    if (!synthesis && voiceStates.length === 0) return;
    const lines: string[] = [];
    if (synthesis?.verdict) lines.push(`# Verdict\n\n${synthesis.verdict}\n`);
    if (synthesis && synthesis.agreed.length > 0) {
      lines.push("\n## All voices agreed\n");
      for (const a of synthesis.agreed) lines.push(`- ${a}`);
    }
    if (synthesis && synthesis.disagreed.length > 0) {
      lines.push("\n## Voices diverged\n");
      for (const d of synthesis.disagreed) lines.push(`- ${d}`);
    }
    for (const v of voiceStates) {
      lines.push(`\n## ${v.name}\n\n${v.prose.trim()}\n`);
    }
    navigator.clipboard?.writeText(lines.join("\n")).catch(() => {});
  }

  function copyVerdictOnly() {
    if (!synthesis?.verdict) return;
    navigator.clipboard?.writeText(synthesis.verdict).catch(() => {});
  }

  // Decode a result hash (#r=<base64-json>) into the cockpit's result
  // panels. Returns true when the hash held something we used. Defensive:
  // any parse error or shape mismatch returns false so we fall through to
  // the auto-sample / template default.
  function applyResultHash(rb64: string): boolean {
    try {
      const json = JSON.parse(decodeURIComponent(escape(window.atob(rb64))));
      if (!json || typeof json !== "object") return false;
      const j = json as Record<string, unknown>;
      const voices = Array.isArray(j.voices) ? (j.voices as Array<Record<string, unknown>>) : [];
      if (voices.length === 0) return false;
      setVoiceStates(
        voices.map((v) => ({
          name: typeof v.name === "string" ? v.name : "Voice",
          status: "ok",
          prose: typeof v.prose === "string" ? v.prose : "",
          outputTokens: typeof v.outputTokens === "number" ? v.outputTokens : 0,
          citationCount: 0,
        })),
      );
      const synth = j.synthesis as Record<string, unknown> | undefined;
      if (synth) {
        setSynthesis({
          agreed: Array.isArray(synth.agreed) ? synth.agreed.map(String) : [],
          disagreed: Array.isArray(synth.disagreed) ? synth.disagreed.map(String) : [],
          verdict: typeof synth.verdict === "string" ? synth.verdict : "",
        });
      }
      const followups = Array.isArray(j.followups)
        ? (j.followups as Array<Record<string, unknown>>)
        : [];
      if (followups.length > 0) {
        setFollowups(
          followups.map((f) => ({
            name: typeof f.name === "string" ? f.name : "",
            status: "ok",
            stance: (f.stance as FollowupState["stance"]) ?? "unclear",
            prose: typeof f.prose === "string" ? f.prose : "",
          })),
        );
      }
      const wallClockMs = typeof j.wallClockMs === "number" ? j.wallClockMs : 0;
      setDone({ wallClockMs });
      setMeta({
        provider: typeof j.provider === "string" ? j.provider : "amd_vllm",
        model: typeof j.model === "string" ? j.model : "Qwen/Qwen2.5-72B-Instruct",
        retrievedSnippets: 0,
      });
      return true;
    } catch {
      return false;
    }
  }

  // Auto-fire the sample debate AFTER first render once the template and
  // dependent state are in place. Triggered from the firstRender effect
  // via the autoSampleOnFirstVisit ref. Pure local state hydration — no
  // network, no GPU, no AMD-credit cost. The viewer can click "view
  // sample" again later or run a real debate any time. Inlined (rather
  // than calling viewSample()) so the effect's dependency array stays
  // honest under react-hooks/exhaustive-deps.
  useEffect(() => {
    if (!autoSampleOnFirstVisit.current) return;
    autoSampleOnFirstVisit.current = false;
    const sample = DEBATE_SAMPLES[templateId];
    if (!sample) return;
    setRunning(false);
    setErrorMsg(null);
    setLiveTps(null);
    tpsRef.current = null;
    setPrompt(sample.prompt);
    setVoiceStates(
      sample.voices.map((v) => ({
        name: v.name,
        status: "ok",
        prose: v.prose,
        outputTokens: Math.round(v.prose.length / 4),
        citationCount: 0,
      })),
    );
    setMeta({
      provider: sample.recordedProvider,
      model: sample.recordedModel,
      retrievedSnippets: 0,
    });
    setSynthesis({
      agreed: sample.synthesis.agreed,
      disagreed: sample.synthesis.disagreed,
      verdict: sample.synthesis.verdict,
    });
    setDone({ wallClockMs: sample.recordedWallClockMs });
    setExpandedVoices(new Set());
    if (sample.followups) {
      setFollowups(
        sample.voices.map((v) => {
          const found = sample.followups?.find((f) => f.name === v.name);
          if (!found) return { name: v.name, status: "ok", stance: "unclear", prose: "" };
          return { name: found.name, status: "ok", stance: found.stance, prose: found.prose };
        }),
      );
    } else {
      setFollowups([]);
    }
  }, [templateId]);

  function viewSample() {
    // Hydrate the cockpit from a pre-recorded sample for the active template.
    // Useful when the GPU droplet is offline OR when a viewer wants to see
    // realistic output before paying ~30s of inference latency. We also use
    // it as a "before" state for screenshots/screencasts.
    const sample = DEBATE_SAMPLES[templateId];
    if (!sample) return;

    setRunning(false);
    abortRef.current?.abort();
    abortRef.current = null;
    setErrorMsg(null);
    setLiveTps(null);
    tpsRef.current = null;

    setPrompt(sample.prompt);
    setVoiceStates(
      sample.voices.map((v) => ({
        name: v.name,
        status: "ok",
        prose: v.prose,
        outputTokens: Math.round(v.prose.length / 4),
        citationCount: 0,
      })),
    );
    setMeta({
      provider: sample.recordedProvider,
      model: sample.recordedModel,
      retrievedSnippets: 0,
    });
    setSynthesis({
      agreed: sample.synthesis.agreed,
      disagreed: sample.synthesis.disagreed,
      verdict: sample.synthesis.verdict,
    });
    setDone({ wallClockMs: sample.recordedWallClockMs });
    setExpandedVoices(new Set());
    if (sample.followups) {
      const fu: Array<FollowupState | null> = sample.voices.map((v) => {
        const found = sample.followups?.find((f) => f.name === v.name);
        if (!found) return { name: v.name, status: "ok", stance: "unclear", prose: "" };
        return {
          name: found.name,
          status: "ok",
          stance: found.stance,
          prose: found.prose,
        };
      });
      setFollowups(fu);
    } else {
      setFollowups([]);
    }
  }

  function copyShareLink() {
    // Encode prompt + template in the URL hash. UTF-8-safe base64 so prompts
    // with Unicode round-trip cleanly; #q=<base64>&t=<id>. Hash means it
    // never hits the server (safe for confidential prompts) and the URL
    // can be pasted into Slack / chat.
    let q = "";
    try {
      q = window.btoa(unescape(encodeURIComponent(prompt)));
    } catch {
      q = "";
    }
    const url = new URL(window.location.href);
    url.hash = `t=${encodeURIComponent(templateId)}&q=${q}`;
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
  }

  function copyShareLinkWithResults() {
    // Permalink-with-results: encode the full debate result (synthesis,
    // voices, optional round-2) into the URL hash so the recipient sees
    // exactly what we saw — no inference cost on their side, no DB. Use
    // case: paste into Slack as proof, or share with a colleague who
    // doesn't have the AMD endpoint. Resulting URLs are large (~5–15 KB)
    // but still well under browser hash limits (most browsers cap ~2 MB).
    if (!synthesis && voiceStates.length === 0) return;
    const payload = {
      template: templateId,
      provider: meta?.provider ?? "amd_vllm",
      model: meta?.model ?? "Qwen/Qwen2.5-72B-Instruct",
      wallClockMs: done?.wallClockMs ?? 0,
      voices: voiceStates.map((v) => ({
        name: v.name,
        prose: v.prose,
        outputTokens: v.outputTokens,
      })),
      synthesis: synthesis ?? null,
      followups:
        followups.filter((f): f is FollowupState => Boolean(f)).length > 0
          ? followups
              .filter((f): f is FollowupState => Boolean(f))
              .map((f) => ({ name: f.name, stance: f.stance, prose: f.prose }))
          : null,
    };
    let r = "";
    try {
      r = window.btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    } catch {
      return;
    }
    let q = "";
    try {
      q = window.btoa(unescape(encodeURIComponent(prompt)));
    } catch {
      q = "";
    }
    const url = new URL(window.location.href);
    url.hash = `t=${encodeURIComponent(templateId)}&q=${q}&r=${r}`;
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
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

  const promptDirty = prompt !== template.prompt || voices !== template.voices;
  const completedCount = voiceStates.filter(
    (v) => v.status === "ok" || v.status === "error" || v.status === "timeout",
  ).length;
  const totalVoices = voiceStates.length;

  return (
    <div className="space-y-5">
      <ProviderBar ping={ping} meta={meta} />

      {/* Use-case template chips */}
      <div className="space-y-1">
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
        <p className="text-xs text-neutral-500">
          <span className="text-neutral-700 dark:text-neutral-300">
            Use when: {template.useWhen}
          </span>
        </p>
      </div>

      {/* INPUT — prominently labelled */}
      <section>
        <div className="mb-1 flex items-baseline justify-between">
          <label className="text-xs font-semibold uppercase text-neutral-700 dark:text-neutral-300">
            Your input
          </label>
          {promptDirty && !running && (
            <button
              type="button"
              onClick={resetToExample}
              className="text-xs text-neutral-500 underline-offset-4 hover:underline"
            >
              reset to example
            </button>
          )}
        </div>
        <textarea
          className="w-full rounded-md border border-neutral-300 bg-transparent p-3 font-mono text-sm leading-relaxed dark:border-neutral-700"
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={running}
          placeholder="Drop a question, code snippet, contract clause, OM excerpt, decision…"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {!running ? (
            <button
              type="button"
              onClick={run}
              disabled={!prompt.trim() || voices.length === 0}
              className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
            >
              Run debate · {voices.length} voice{voices.length === 1 ? "" : "s"}
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
          {running && totalVoices > 0 && (
            <span className="text-xs text-neutral-500">
              {completedCount}/{totalVoices} voices done
              {synthesis
                ? " · synthesis ready"
                : completedCount === totalVoices
                  ? " · synthesizing…"
                  : ""}
            </span>
          )}
          {running && liveTps && liveTps.tokensPerSec > 0 && (
            <span
              className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
              title="Aggregate tokens/sec across all voices streaming concurrently — measured from the live SSE stream."
            >
              ~{liveTps.tokensPerSec} tok/s
            </span>
          )}
          <button
            type="button"
            onClick={copyShareLink}
            disabled={running || !prompt.trim()}
            title="Copy a permalink to this exact prompt + template"
            className="text-xs text-neutral-500 underline-offset-4 hover:underline disabled:opacity-50"
          >
            share
          </button>
          {DEBATE_SAMPLES[templateId] && !running && (
            <button
              type="button"
              onClick={viewSample}
              title="Load a pre-recorded sample debate for this template — instant, no API calls."
              className="text-xs text-neutral-500 underline-offset-4 hover:underline"
            >
              view sample
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
          <label
            className="flex items-center gap-1.5 text-xs text-neutral-500"
            title="After synthesis, ask each voice to defend, update, or concede their stance given the others. One extra parallel GPU batch."
          >
            <input
              type="checkbox"
              checked={enableFollowup}
              onChange={(e) => setEnableFollowup(e.target.checked)}
              disabled={running}
              className="h-3 w-3"
            />
            round 2
          </label>
          {done && !running && (
            <span className="text-xs text-neutral-500">
              {voiceStates.filter((v) => v.status === "ok").length}/{voiceStates.length} voices in{" "}
              {(done.wallClockMs / 1000).toFixed(1)}s
            </span>
          )}
          {errorMsg && <span className="text-xs text-red-600 dark:text-red-400">{errorMsg}</span>}
        </div>
      </section>

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
                    updateVoice(
                      i,
                      voice.personaId
                        ? { systemPromptSuffix: e.target.value }
                        : { systemPromptOverride: e.target.value },
                    )
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

      {/* OUTPUT section */}
      {(voiceStates.length > 0 || done) && (
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <label className="text-xs font-semibold uppercase text-neutral-700 dark:text-neutral-300">
              Result
            </label>
            {(synthesis || done) && (
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={copyVerdictOnly}
                  disabled={!synthesis?.verdict}
                  className="text-neutral-600 underline-offset-4 hover:underline disabled:opacity-30 dark:text-neutral-400"
                >
                  copy verdict
                </button>
                <button
                  type="button"
                  onClick={copyFullReport}
                  className="text-neutral-600 underline-offset-4 hover:underline dark:text-neutral-400"
                >
                  copy full report
                </button>
                <button
                  type="button"
                  onClick={copyShareLinkWithResults}
                  disabled={!synthesis && voiceStates.length === 0}
                  title="Copy a permalink that includes the prompt AND the full result (verdict + voices + round-2). Paste into Slack — recipients see what you saw, no API call needed."
                  className="text-neutral-600 underline-offset-4 hover:underline disabled:opacity-30 dark:text-neutral-400"
                >
                  share result
                </button>
              </div>
            )}
          </div>

          {/* Synthesis (output #1 — what to read first) */}
          {(synthesis || (done && !synthesis && !errorMsg)) && (
            <SynthesisCard synthesis={synthesis} />
          )}

          {/* Voice cards (output #2 — supporting detail, collapsed by default) */}
          <div className="grid gap-3 lg:grid-cols-3">
            {voiceStates.map((voice, i) => (
              <VoiceCard
                key={`${voice.name}-${i}`}
                voice={voice}
                expanded={
                  expandedVoices.has(i) || voice.status === "running" || voice.status === "pending"
                }
                onToggle={() => toggleVoiceExpanded(i)}
              />
            ))}
          </div>

          {/* Round-2 follow-up (output #3 — appears only when round-2 enabled) */}
          {followups.length > 0 && (
            <FollowupSection followups={followups} voiceStates={voiceStates} />
          )}
        </section>
      )}
    </div>
  );
}

function FollowupSection({
  followups,
  voiceStates,
}: {
  followups: Array<FollowupState | null>;
  voiceStates: VoiceState[];
}) {
  const stanceCounts = followups.reduce(
    (acc, f) => {
      if (!f) return acc;
      if (f.stance === "defended") acc.defended++;
      else if (f.stance === "updated") acc.updated++;
      else if (f.stance === "conceded") acc.conceded++;
      return acc;
    },
    { defended: 0, updated: 0, conceded: 0 },
  );
  const summary =
    [
      stanceCounts.defended > 0 && `${stanceCounts.defended} defended`,
      stanceCounts.updated > 0 && `${stanceCounts.updated} updated`,
      stanceCounts.conceded > 0 && `${stanceCounts.conceded} conceded`,
    ]
      .filter(Boolean)
      .join(" · ") || "running…";

  return (
    <div className="rounded-lg border border-neutral-300 bg-neutral-50/50 p-4 dark:border-neutral-700 dark:bg-neutral-900/40">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase text-neutral-700 dark:text-neutral-300">
          Round 2 — voices respond to each other
        </p>
        <span className="text-xs text-neutral-500">{summary}</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {followups.map((f, i) => {
          const voiceStatus = voiceStates[i]?.status;
          if (!f && voiceStatus !== "ok") return <div key={i} />;
          if (!f) return <div key={i} />;
          return <FollowupCard key={`${f.name}-${i}`} followup={f} />;
        })}
      </div>
    </div>
  );
}

function FollowupCard({ followup }: { followup: FollowupState }) {
  const stanceColor: Record<FollowupState["stance"], string> = {
    defended: "border-blue-300 dark:border-blue-700",
    updated: "border-amber-300 dark:border-amber-700",
    conceded: "border-emerald-300 dark:border-emerald-700",
    unclear: "border-neutral-300 dark:border-neutral-700",
  };
  const stancePillColor: Record<FollowupState["stance"], string> = {
    defended: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    updated: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    conceded: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
    unclear: "bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  };
  return (
    <article className={`rounded-lg border ${stanceColor[followup.stance]} p-3`}>
      <header className="flex items-center justify-between">
        <span className="text-xs font-semibold">{followup.name}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${stancePillColor[followup.stance]}`}
        >
          {followup.status === "running" ? "thinking" : followup.stance}
        </span>
      </header>
      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
        {followup.prose || <span className="italic text-neutral-500">streaming…</span>}
      </p>
    </article>
  );
}

function ProviderBar({ ping, meta }: { ping: PingResult | null; meta: DebateMeta | null }) {
  const provider = meta?.provider ?? ping?.provider ?? "?";
  const model = meta?.model ?? ping?.model ?? "?";
  const ok = ping?.ok ?? null;
  const ctx = ping?.modelInfo?.maxContextTokens ?? null;
  const ctxLabel =
    ctx !== null ? (ctx >= 1000 ? `${Math.round(ctx / 1024)}K ctx` : `${ctx} ctx`) : null;

  const dotClass =
    ok === true ? "bg-emerald-500" : ok === false ? "bg-red-500" : "bg-yellow-500 animate-pulse";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs dark:border-neutral-800 dark:bg-neutral-900">
      <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} />
      <span className="font-medium text-neutral-700 dark:text-neutral-200">{provider}</span>
      <span className="text-neutral-500">→</span>
      <span className="font-mono text-neutral-700 dark:text-neutral-200">{model}</span>
      {ctxLabel && (
        <span
          className="rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] uppercase text-neutral-500 dark:border-neutral-700"
          title={`Maximum context window the model accepts (${ctx?.toLocaleString()} tokens).`}
        >
          {ctxLabel}
        </span>
      )}
      {ping?.engineMetrics && (
        <span
          className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${
            ping.engineMetrics.requestsRunning > 0
              ? "border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-200"
              : "border-neutral-300 text-neutral-500 dark:border-neutral-700"
          }`}
          title={`Lifetime: ${ping.engineMetrics.promptTokensTotal.toLocaleString()} prompt tokens · ${ping.engineMetrics.generationTokensTotal.toLocaleString()} generation tokens served by this engine.${
            ping.engineMetrics.gpuCacheUsage !== null
              ? ` GPU KV cache: ${(ping.engineMetrics.gpuCacheUsage * 100).toFixed(1)}%.`
              : ""
          }`}
        >
          {ping.engineMetrics.requestsRunning > 0
            ? `🔥 ${ping.engineMetrics.requestsRunning} running${
                ping.engineMetrics.requestsWaiting > 0
                  ? ` · ${ping.engineMetrics.requestsWaiting} queued`
                  : ""
              }`
            : "GPU idle"}
        </span>
      )}
      <span className="ml-auto text-neutral-500">
        {ping?.ok ? (
          <>
            {ping.latencyMs}ms
            {ping.tokensPerSec && ping.tokensPerSec > 0 && (
              <span className="font-mono text-emerald-700 dark:text-emerald-400">
                {" "}
                · {ping.tokensPerSec} tok/s
              </span>
            )}{" "}
            · &ldquo;{ping.sample.trim()}&rdquo;
          </>
        ) : (
          "checking…"
        )}
      </span>
    </div>
  );
}

function SynthesisCard({ synthesis }: { synthesis: SynthesisInfo | null }) {
  if (!synthesis) {
    return (
      <div className="rounded-lg border-2 border-dashed border-neutral-300 p-5 text-sm text-neutral-500 dark:border-neutral-700">
        <span className="italic">
          Synthesizing — reading all three voices to surface where they agree and diverge…
        </span>
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

function VoiceCard({
  voice,
  expanded,
  onToggle,
}: {
  voice: VoiceState;
  expanded: boolean;
  onToggle: () => void;
}) {
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
    navigator.clipboard?.writeText(text).catch(() => {});
  }

  // Show first ~3 lines as a preview when collapsed.
  const preview = useMemo(() => {
    const lines = voice.prose.split(/\n+/).filter((l) => l.trim().length > 0);
    return lines.slice(0, 2).join(" · ").slice(0, 220);
  }, [voice.prose]);

  return (
    <article className={`flex flex-col rounded-lg border ${colorClass} p-3`}>
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
      {voice.error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{voice.error}</p>}

      {expanded ? (
        <div className="mt-2 max-h-80 flex-1 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
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
      ) : (
        <p className="mt-2 line-clamp-3 text-xs italic leading-relaxed text-neutral-500">
          {preview || "—"}
        </p>
      )}

      {voice.status !== "pending" && voice.status !== "running" && voice.prose && (
        <button
          type="button"
          onClick={onToggle}
          className="mt-2 self-start text-xs text-neutral-500 underline-offset-4 hover:underline"
        >
          {expanded ? "show less" : "expand full critique"}
        </button>
      )}
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
