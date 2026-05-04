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
  throw new Error(
    `DebateVoice "${voice.name}" must set either personaId or systemPromptOverride.`,
  );
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
 * Universal use-case templates. Each ships its own prompt and voice set.
 * Intentionally generic — debate is a pattern (parallel critique against a
 * single endpoint), not a vertical. The compliance trio is the default
 * because that's the calling app's primary use case, but the same
 * machinery serves code review, decision making, and document critique.
 */
export interface DebateTemplate {
  id: string;
  label: string;
  description: string;
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
    prompt:
      'Review this offering memorandum excerpt against Ontario NI 45-106 and surface the top 3 disclosure gaps a compliance reviewer should raise:\n\n"The issuer offers Class A units to accredited investors only. Past performance has consistently exceeded benchmarks. Subscription proceeds will be applied to general working capital. Risk factors are listed in Schedule B."',
    voices: DEFAULT_COMPLIANCE_VOICES,
  },
  {
    id: "code-review",
    label: "Code review",
    description: "Engineer · Security · Performance critique the same diff.",
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
