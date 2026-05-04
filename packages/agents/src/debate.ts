/**
 * Multi-voice debate.
 *
 * Runs N parallel `runAgent` calls against the SAME provider/model with
 * different system prompts ("voices"). Designed for the AMD-MI300X
 * hackathon path — a single Qwen 2.5 72B endpoint can host the whole panel —
 * but works equally well against any provider.
 *
 * Why this is separate from the drafter↔judge loop:
 *   - The loop is sequential (judge waits for drafter, drafter waits for judge).
 *   - A debate is concurrent: every voice critiques the same input simultaneously.
 *   - The judge produces a verdict token; voices produce structured prose. The
 *     downstream consumer aggregates them, not a single judge.
 *
 * Streaming model: the caller can pass `onEvent` to receive per-voice deltas
 * as they stream from the model — the UI uses this to fill voice cards in
 * real time. The Promise resolves with the final aggregated `DebateResult`.
 *
 * Failure isolation: each voice runs under Promise.allSettled — one bad
 * voice doesn't tank the whole debate. The result preserves the ordering
 * you passed in and surfaces per-voice errors so the UI can show "voice X
 * failed" without dropping the others.
 */

import type { ModelProvider } from "./run.js";
import { runAgent } from "./run.js";
import { parseModelOutput, type Citation } from "./citations.js";
import { PERSONA_SYSTEM_PROMPTS } from "./personas/index.js";
import type { AgentContext, AgentMessage, AgentUsage, PersonaId } from "./types.js";

/**
 * One participant in the debate. Two ways to specify the system prompt:
 *   - `personaId`              → load PERSONA_SYSTEM_PROMPTS[personaId] verbatim
 *   - `systemPromptOverride`   → use this string as the persona prompt
 *   - `systemPromptSuffix`     → load the persona prompt and append this
 *                                (lightweight way to add a stance to an
 *                                 existing persona, e.g. "Be especially
 *                                 skeptical of forward-looking statements.")
 *
 * `name` is the human-readable label (shown in the UI / audit trail).
 * Exactly one of {personaId, systemPromptOverride} must be set.
 */
export interface DebateVoice {
  name: string;
  personaId?: PersonaId;
  systemPromptOverride?: string;
  systemPromptSuffix?: string;
}

/**
 * Streaming events emitted via `onEvent` while a debate runs. The shape is
 * stable across mock and real providers so the UI / tests can rely on it.
 */
export type DebateEvent =
  | { type: "voice-started"; index: number; name: string }
  | { type: "voice-delta"; index: number; name: string; delta: string }
  | {
      type: "voice-completed";
      index: number;
      name: string;
      status: "ok" | "error" | "timeout";
      prose: string;
      citations: Citation[];
      usage: AgentUsage;
      error?: string;
    };

export interface RunDebateOptions {
  /** Override env-based provider resolution. Pass `"amd_vllm"` to pin the
   *  whole panel to a single self-hosted endpoint. */
  provider?: ModelProvider;
  /** Override the default model id. */
  model?: string;
  /** Override max output tokens per voice. */
  maxTokens?: number;
  /** Optional per-voice timeout. If a voice exceeds it, the result is
   *  returned with status="timeout". Default: no timeout. */
  timeoutMs?: number;
  /** Streaming callback. Fires for every voice-started / voice-delta /
   *  voice-completed event. Cheap synchronous callback; do not block. */
  onEvent?: (event: DebateEvent) => void;
  /** Cancel an in-flight panel. Voices not yet started are skipped; running
   *  voices abort their fetch and resolve with status="error". */
  signal?: AbortSignal;
}

export interface DebateVoiceResult {
  name: string;
  status: "ok" | "error" | "timeout";
  prose: string;
  citations: Citation[];
  usage: AgentUsage;
  /** Set when status !== "ok". */
  error?: string;
  /** Persona id reported by `runAgent` (the routed or forced one). */
  persona: PersonaId | null;
}

export interface DebateResult {
  voices: DebateVoiceResult[];
  /** Provider that served the panel. Useful for the audit trail. */
  provider: ModelProvider;
  /** Model id that served the panel. */
  model: string;
  /** Wall-clock duration in ms. */
  durationMs: number;
}

const DEFAULT_USAGE: AgentUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 };

function buildSystemForVoice(voice: DebateVoice): string {
  if (voice.systemPromptOverride) return voice.systemPromptOverride;
  if (voice.personaId) {
    const base = PERSONA_SYSTEM_PROMPTS[voice.personaId];
    return voice.systemPromptSuffix ? `${base}\n\n${voice.systemPromptSuffix}` : base;
  }
  throw new Error(`DebateVoice "${voice.name}" must set either personaId or systemPromptOverride.`);
}

async function runOneVoice(
  index: number,
  voice: DebateVoice,
  context: AgentContext,
  history: AgentMessage[],
  userMessage: string,
  options: RunDebateOptions,
): Promise<DebateVoiceResult> {
  const systemPrompt = buildSystemForVoice(voice);
  const persona: PersonaId = voice.personaId ?? "drafter";

  options.onEvent?.({ type: "voice-started", index, name: voice.name });

  let prose = "";
  let usage: AgentUsage = { ...DEFAULT_USAGE };
  let errored: string | null = null;

  try {
    for await (const ev of runAgent(context, history, userMessage, {
      forcePersona: persona,
      systemPromptOverride: systemPrompt,
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.model ? { model: options.model } : {}),
      ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    })) {
      if (ev.type === "text-delta") {
        prose += ev.delta;
        options.onEvent?.({ type: "voice-delta", index, name: voice.name, delta: ev.delta });
      }
      if (ev.type === "done") usage = ev.usage;
      if (ev.type === "error") {
        errored = ev.message;
        break;
      }
    }
  } catch (err) {
    errored = err instanceof Error ? err.message : String(err);
  }

  const parsed = errored ? null : parseModelOutput(prose);
  const result: DebateVoiceResult = errored
    ? {
        name: voice.name,
        status: "error",
        prose,
        citations: [],
        usage,
        error: errored,
        persona,
      }
    : {
        name: voice.name,
        status: "ok",
        prose: parsed?.prose ?? prose,
        citations: parsed?.citations ?? [],
        usage,
        persona,
      };

  options.onEvent?.({
    type: "voice-completed",
    index,
    name: result.name,
    status: result.status,
    prose: result.prose,
    citations: result.citations,
    usage: result.usage,
    ...(result.error ? { error: result.error } : {}),
  });

  return result;
}

/**
 * Run N voices in parallel. Returns a result preserving the input order.
 * Errors are isolated per-voice; the panel resolves even if some voices fail.
 */
export async function runDebate(
  voices: DebateVoice[],
  context: AgentContext,
  userMessage: string,
  options: RunDebateOptions = {},
): Promise<DebateResult> {
  if (voices.length === 0) {
    throw new Error("runDebate requires at least one voice.");
  }
  for (const v of voices) {
    // Validate up-front; cheap, prevents partial panels at runtime.
    buildSystemForVoice(v);
  }

  const startedAt = Date.now();
  const history: AgentMessage[] = [];

  const wrapped = voices.map((voice, index) => {
    const call = runOneVoice(index, voice, context, history, userMessage, options);
    if (options.timeoutMs && options.timeoutMs > 0) {
      return Promise.race<DebateVoiceResult>([
        call,
        new Promise<DebateVoiceResult>((resolve) =>
          setTimeout(() => {
            const timeoutResult: DebateVoiceResult = {
              name: voice.name,
              status: "timeout",
              prose: "",
              citations: [],
              usage: { ...DEFAULT_USAGE },
              error: `Voice "${voice.name}" exceeded ${options.timeoutMs}ms.`,
              persona: voice.personaId ?? null,
            };
            options.onEvent?.({
              type: "voice-completed",
              index,
              name: voice.name,
              status: "timeout",
              prose: "",
              citations: [],
              usage: { ...DEFAULT_USAGE },
              error: timeoutResult.error,
            });
            resolve(timeoutResult);
          }, options.timeoutMs),
        ),
      ]);
    }
    return call;
  });

  const settled = await Promise.allSettled(wrapped);
  const results: DebateVoiceResult[] = settled.map((s, i) => {
    const voice = voices[i]!;
    if (s.status === "fulfilled") return s.value;
    return {
      name: voice.name,
      status: "error",
      prose: "",
      citations: [],
      usage: { ...DEFAULT_USAGE },
      error: s.reason instanceof Error ? s.reason.message : String(s.reason),
      persona: null,
    };
  });

  const { resolveModelProvider } = await import("./run.js");
  const resolved = resolveModelProvider(process.env, {
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.model ? { model: options.model } : {}),
  });

  return {
    voices: results,
    provider: resolved.provider,
    model: resolved.model,
    durationMs: Date.now() - startedAt,
  };
}

/**
 * Synthesize a debate panel into one decision-grade summary.
 *
 * Takes the per-voice prose and asks the SAME model to surface where the
 * voices agreed, where they disagreed, and what a human reader should take
 * away. This is the "killer feature" for a non-expert viewer: three blobs
 * of dense text become one paragraph of "here's what to do."
 *
 * Returns parsed structured fields. We ask the model for a fenced JSON
 * block because conversation prose is unreliable to parse downstream.
 */
export interface DebateSynthesis {
  agreed: string[];
  disagreed: string[];
  verdict: string;
  rawText: string;
}

const SYNTHESIS_PROMPT = (userMessage: string, voices: DebateVoiceResult[]): string => {
  const voicesBlock = voices
    .filter((v) => v.status === "ok")
    .map((v) => `### ${v.name}\n${v.prose.trim().slice(0, 1800)}`)
    .join("\n\n");
  return `You are an editor synthesizing three independent expert critiques of the same prompt. Your job is to produce ONE crisp summary the reader can act on.

Original prompt:
"""
${userMessage.slice(0, 1200)}
"""

Voices:

${voicesBlock}

Output exactly this fenced JSON block, nothing else:
\`\`\`json
{
  "agreed": ["short phrase", "short phrase", "..."],
  "disagreed": ["short phrase", "..."],
  "verdict": "one sentence — what the reader should do or believe"
}
\`\`\`
Rules:
- Each "agreed" / "disagreed" item: a short phrase (5-12 words), NOT a paragraph.
- "agreed" = a finding or conclusion that ALL voices reached, even if worded differently.
- "disagreed" = a real divergence in stance, recommendation, or risk-level.
- "verdict" = the practical takeaway. If voices fundamentally disagreed, say so plainly.
- Output the fenced JSON only. No preamble. No commentary after.`;
};

/**
 * Round-2 follow-up. After synthesis identifies divergences, ask each voice:
 * "Given the synthesis and the other voices, do you defend or update your
 * position?" This produces a SECOND wave of inference on the same single
 * GPU — a literal demonstration of MI300X memory headroom and the value of
 * multi-pass deliberation in a way a non-expert viewer can read.
 *
 * Why a separate function (not just another runDebate call):
 *   - Each voice sees its OWN prior round-1 prose + the synthesis as
 *     context. Different voices get different rendered prompts.
 *   - The output is a "stance update" — short by design (≤300 tokens) so
 *     all three updates fit on one screen below round-1.
 *
 * Returns one update per ok-status round-1 voice, in input order. Voices
 * that errored in round 1 are skipped (no point asking them to defend a
 * non-answer).
 */
export interface VoiceFollowup {
  index: number;
  name: string;
  status: "ok" | "error" | "timeout";
  /** "defended" | "updated" | "conceded" — extracted from the model's response. */
  stance: "defended" | "updated" | "conceded" | "unclear";
  prose: string;
  usage: AgentUsage;
  error?: string;
}

const FOLLOWUP_PROMPT = (
  voiceName: string,
  voicePriorProse: string,
  otherVoices: { name: string; prose: string }[],
  synthesis: DebateSynthesis,
  userMessage: string,
): string => {
  const others = otherVoices
    .map((v) => `### ${v.name} said:\n${v.prose.trim().slice(0, 1200)}`)
    .join("\n\n");
  return `You previously gave the critique below. Now you've seen the other voices and an editor's synthesis. Decide whether you DEFEND, UPDATE, or CONCEDE — and explain in 2-4 short sentences. Be concrete: cite what changed your mind or what you still hold to.

Original prompt:
"""
${userMessage.slice(0, 800)}
"""

Your prior critique (as ${voiceName}):
"""
${voicePriorProse.trim().slice(0, 1500)}
"""

What the other voices said:

${others}

Editor's synthesis:
- Verdict: ${synthesis.verdict}
- All voices agreed: ${synthesis.agreed.join("; ") || "(none)"}
- Voices diverged on: ${synthesis.disagreed.join("; ") || "(none)"}

Output exactly this fenced JSON block, nothing else:
\`\`\`json
{
  "stance": "DEFENDED" | "UPDATED" | "CONCEDED",
  "prose": "2-4 sentences explaining your stance. Quote specifics."
}
\`\`\`
Rules:
- "DEFENDED" — you stand by your prior critique unchanged.
- "UPDATED"  — you're refining your position based on what the others said.
- "CONCEDED" — you now think one of the other voices had it more right than you.
- Output ONLY the fenced JSON. No commentary outside it.`;
};

function parseStance(raw: string): { stance: VoiceFollowup["stance"]; prose: string } {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fence ? fence[1]!.trim() : raw.trim();
  try {
    const parsed = JSON.parse(text) as { stance?: string; prose?: string };
    const tag = (parsed.stance ?? "").toString().toUpperCase();
    const stance: VoiceFollowup["stance"] =
      tag === "DEFENDED"
        ? "defended"
        : tag === "UPDATED"
          ? "updated"
          : tag === "CONCEDED"
            ? "conceded"
            : "unclear";
    return {
      stance,
      prose: typeof parsed.prose === "string" ? parsed.prose.slice(0, 800) : "",
    };
  } catch {
    return { stance: "unclear", prose: raw.slice(0, 800) };
  }
}

export async function runFollowup(
  result: DebateResult,
  synthesis: DebateSynthesis,
  userMessage: string,
  context: AgentContext,
  options: Pick<RunDebateOptions, "provider" | "model" | "maxTokens" | "signal" | "onEvent"> & {
    onFollowupEvent?: (event: {
      type: "followup-started" | "followup-delta" | "followup-completed";
      index: number;
      name: string;
      delta?: string;
      stance?: VoiceFollowup["stance"];
      prose?: string;
    }) => void;
  } = {},
): Promise<VoiceFollowup[]> {
  const okVoices = result.voices.map((v, i) => ({ v, i })).filter(({ v }) => v.status === "ok");
  if (okVoices.length < 2) return [];

  const callOne = async ({ v, i }: { v: DebateVoiceResult; i: number }): Promise<VoiceFollowup> => {
    const others = okVoices
      .filter((x) => x.i !== i)
      .map(({ v: ov }) => ({ name: ov.name, prose: ov.prose }));
    const prompt = FOLLOWUP_PROMPT(v.name, v.prose, others, synthesis, userMessage);

    options.onFollowupEvent?.({ type: "followup-started", index: i, name: v.name });

    let buffer = "";
    let usage: AgentUsage = { ...DEFAULT_USAGE };
    let errored: string | null = null;

    try {
      for await (const ev of runAgent(context, [], prompt, {
        forcePersona: "drafter",
        systemPromptOverride:
          "You are a debate participant defending or updating your stance. Output ONLY the requested fenced JSON. No preamble. No commentary outside.",
        ...(options.provider ? { provider: options.provider } : {}),
        ...(options.model ? { model: options.model } : {}),
        maxTokens: options.maxTokens ?? 320,
        ...(options.signal ? { signal: options.signal } : {}),
      })) {
        if (ev.type === "text-delta") {
          buffer += ev.delta;
          options.onFollowupEvent?.({
            type: "followup-delta",
            index: i,
            name: v.name,
            delta: ev.delta,
          });
        }
        if (ev.type === "done") usage = ev.usage;
        if (ev.type === "error") {
          errored = ev.message;
          break;
        }
      }
    } catch (err) {
      errored = err instanceof Error ? err.message : String(err);
    }

    if (errored) {
      const result: VoiceFollowup = {
        index: i,
        name: v.name,
        status: "error",
        stance: "unclear",
        prose: "",
        usage,
        error: errored,
      };
      options.onFollowupEvent?.({
        type: "followup-completed",
        index: i,
        name: v.name,
        stance: "unclear",
        prose: "",
      });
      return result;
    }

    const { stance, prose } = parseStance(buffer);
    const result: VoiceFollowup = {
      index: i,
      name: v.name,
      status: "ok",
      stance,
      prose,
      usage,
    };
    options.onFollowupEvent?.({
      type: "followup-completed",
      index: i,
      name: v.name,
      stance,
      prose,
    });
    return result;
  };

  const settled = await Promise.allSettled(okVoices.map(callOne));
  return settled.map((s, idx) => {
    if (s.status === "fulfilled") return s.value;
    const v = okVoices[idx]!;
    return {
      index: v.i,
      name: v.v.name,
      status: "error",
      stance: "unclear",
      prose: "",
      usage: { ...DEFAULT_USAGE },
      error: s.reason instanceof Error ? s.reason.message : String(s.reason),
    };
  });
}

export async function synthesizeDebate(
  result: DebateResult,
  userMessage: string,
  context: AgentContext,
  options: Pick<RunDebateOptions, "provider" | "model" | "maxTokens" | "signal"> = {},
): Promise<DebateSynthesis | null> {
  const okVoices = result.voices.filter((v) => v.status === "ok");
  if (okVoices.length < 2) return null;

  const prompt = SYNTHESIS_PROMPT(userMessage, okVoices);
  let buffer = "";
  try {
    for await (const ev of runAgent(context, [], prompt, {
      forcePersona: "drafter",
      systemPromptOverride:
        "You are a precise editor. Output ONLY the requested fenced JSON block. No preamble. No trailing commentary.",
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.model ? { model: options.model } : {}),
      maxTokens: options.maxTokens ?? 512,
      ...(options.signal ? { signal: options.signal } : {}),
    })) {
      if (ev.type === "text-delta") buffer += ev.delta;
      if (ev.type === "error") return null;
    }
  } catch {
    return null;
  }

  const fence = buffer.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fence ? fence[1]!.trim() : buffer.trim();
  try {
    const parsed = JSON.parse(jsonText) as Partial<DebateSynthesis>;
    return {
      agreed: Array.isArray(parsed.agreed) ? parsed.agreed.map(String).slice(0, 6) : [],
      disagreed: Array.isArray(parsed.disagreed) ? parsed.disagreed.map(String).slice(0, 6) : [],
      verdict: typeof parsed.verdict === "string" ? parsed.verdict.slice(0, 400) : "",
      rawText: buffer,
    };
  } catch {
    return null;
  }
}

/**
 * Universal use-case templates. Each ships its own prompt and voice set.
 * Intentionally generic — debate is a pattern (parallel critique against a
 * single endpoint), not a vertical. The compliance trio is the default
 * because that's the calling app's primary use case, but the same
 * machinery serves code review, decision making, and document critique.
 *
 * `useWhen`: a one-line answer to "when would I use this?" — surfaced as a
 * hint on the chip. Without this, a judge looking at the chips has no way
 * to map a label to their own situation.
 */
export interface DebateTemplate {
  id: string;
  label: string;
  description: string;
  /** Plain-English answer to "when would I use this?" */
  useWhen: string;
  prompt: string;
  voices: DebateVoice[];
}

export const DEFAULT_COMPLIANCE_VOICES: DebateVoice[] = [
  {
    name: "Skeptical reviewer",
    personaId: "om-reviewer",
    systemPromptSuffix:
      "STANCE: Be the most cautious voice. When in doubt, downgrade FOUND → PARTIAL and PARTIAL → MISSING. Flag anything that could draw a regulator's eye, even if technically defensible.",
  },
  {
    name: "Permissive reviewer",
    personaId: "om-reviewer",
    systemPromptSuffix:
      "STANCE: Take the issuer's side within the rules. Where language is conventional for Canadian private placements, mark FOUND. Reserve PARTIAL/MISSING for genuine, citable gaps — not stylistic preferences.",
  },
  {
    name: "Regulator voice",
    personaId: "om-reviewer",
    systemPromptSuffix:
      "STANCE: Read this OM as an OSC reviewer on a 45-106 deficiency review. Focus on investor protections: rights of action, withdrawal rights, marketing-claim substantiation. If you'd write a deficiency letter on a point, mark it MISSING.",
  },
];

export const DEBATE_TEMPLATES: DebateTemplate[] = [
  {
    id: "compliance",
    label: "Compliance review",
    description: "OM disclosure check with three regulator stances.",
    useWhen:
      "You're reviewing a legal/regulatory document and want to catch what one reviewer would miss.",
    prompt:
      'Review this offering memorandum excerpt against Ontario NI 45-106 and surface the top 3 disclosure gaps a compliance reviewer should raise:\n\n"The issuer offers Class A units to accredited investors only. Past performance has consistently exceeded benchmarks. Subscription proceeds will be applied to general working capital. Risk factors are listed in Schedule B."',
    voices: DEFAULT_COMPLIANCE_VOICES,
  },
  {
    id: "code-review",
    label: "Code review",
    description: "Engineer · Security · Performance critique the same diff.",
    useWhen: "You're shipping a PR and want senior, security, and performance reads in one shot.",
    prompt:
      'Review this TypeScript snippet. Surface what you would request changes on, request style, and what ships.\n\n```ts\nasync function fetchUserOrders(userId: string) {\n  const orders = [];\n  const ids = await db.query("SELECT order_id FROM orders WHERE user_id = " + userId);\n  for (const id of ids) {\n    const order = await db.query(`SELECT * FROM orders WHERE id = ${id}`);\n    orders.push(order);\n  }\n  return JSON.stringify(orders);\n}\n```',
    voices: [
      {
        name: "Senior engineer",
        systemPromptOverride:
          "You are a senior software engineer doing a code review. Focus on correctness, readability, idiomatic style, and maintainability. Be direct: tell the author what to change and why. Cite specific lines.",
      },
      {
        name: "Security auditor",
        systemPromptOverride:
          "You are a security engineer reviewing this code as if it shipped to production. Identify injection risks, auth/authorization mistakes, secret leakage, unsafe deserialization, missing input validation, and any pattern listed in OWASP Top 10. Rate severity per finding.",
      },
      {
        name: "Performance hawk",
        systemPromptOverride:
          "You are a performance engineer. Identify N+1 queries, unnecessary allocations, blocking I/O on hot paths, missing caching, and any quadratic-or-worse algorithmic complexity. Suggest the cheapest practical fix per finding.",
      },
    ],
  },
  {
    id: "decision",
    label: "Decision making",
    description: "Optimist · Skeptic · Devil's advocate weigh the same call.",
    useWhen:
      "You're stuck between two options and want the case for each, plus the one you haven't considered.",
    prompt:
      "Should our 12-person SaaS startup take a $3M seed round at a $20M post-money valuation from a top-tier VC, or bootstrap with $400K ARR growing at 25% MoM? Argue the case in 3-5 punchy bullets and end with an explicit recommendation.",
    voices: [
      {
        name: "Optimist",
        systemPromptOverride:
          "You are a strategic optimist. Argue for the path with the highest expected upside. Surface the asymmetric bets where the downside is small and the upside is large. Be specific about WHY the optimistic case is realistic, not just possible.",
      },
      {
        name: "Skeptic",
        systemPromptOverride:
          "You are a strategic skeptic. Argue for the path with the lowest catastrophic-failure risk. Surface the second-order effects most teams underweight: dilution, control, founder fatigue, customer concentration. Recommend the boring, robust answer when it's right.",
      },
      {
        name: "Devil's advocate",
        systemPromptOverride:
          "You are a devil's advocate. Take whichever position the founders are LEAST likely to consider seriously, and argue it as if it's the obvious right call. Your goal is to stress-test the other voices' assumptions, not to be balanced.",
      },
    ],
  },
  {
    id: "doc-critique",
    label: "Document critique",
    description: "Editor · Skeptical reader · Subject expert read the same paragraph.",
    useWhen:
      "You wrote something (landing page, memo, pitch) and want three brutal-but-fair edits.",
    prompt:
      'Critique this paragraph from a startup\'s landing page. Output: 3 specific edits each, with the rationale.\n\n"Our AI-powered platform leverages cutting-edge machine learning algorithms to deliver unprecedented insights and drive transformative outcomes for forward-thinking enterprises. We empower decision-makers to harness the full potential of their data and unlock new opportunities for growth."',
    voices: [
      {
        name: "Strict editor",
        systemPromptOverride:
          "You are a strict copy editor in the style of Strunk & White and David Ogilvy. Cut every empty word. Replace abstractions with concrete claims. Demand verbs that mean something. Quote the original text and propose a tight rewrite.",
      },
      {
        name: "Confused reader",
        systemPromptOverride:
          "You are a smart but skeptical first-time reader. After every sentence, ask 'wait, what does that actually mean?' Note where the prose loses you, what assumptions it makes, and what concrete question would make you trust the writer.",
      },
      {
        name: "Subject expert",
        systemPromptOverride:
          "You are an expert in the relevant domain (sales, marketing, ML — pick whichever the prose claims). Flag every claim that is technically wrong, vague, or could not survive a hostile customer call. Suggest replacement claims that are specific and falsifiable.",
      },
    ],
  },
];
