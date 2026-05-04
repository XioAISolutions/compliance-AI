/**
 * Multi-voice debate.
 *
 * Runs N parallel `runAgent` calls against the SAME provider/model with
 * different system-prompt overrides ("voices"). Designed for the AMD-MI300X
 * hackathon path — a single Qwen 2.5 72B endpoint can host the whole panel —
 * but works equally well against any provider.
 *
 * Why this is separate from the drafter↔judge loop:
 *   - The loop is sequential (judge waits for drafter, drafter waits for judge).
 *   - A debate is concurrent: every voice critiques the same input simultaneously.
 *   - The judge produces a verdict token; voices produce structured prose. The
 *     downstream consumer aggregates them, not a single judge.
 *
 * Streaming model: rather than interleave deltas across N voices (which would
 * require N-way SSE multiplexing in the route), this returns each voice's
 * COMPLETE result. The caller decides how to surface — e.g., one bubble per
 * voice that fills in as each call resolves. If interleaved streaming is ever
 * required, switch to `runDebateStream()` (not yet implemented).
 *
 * Failure isolation: each voice runs under Promise.allSettled — one bad voice
 * doesn't tank the whole debate. The result preserves the ordering you passed
 * in and surfaces per-voice errors so the UI can show "voice X failed" without
 * dropping the others.
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
  voice: DebateVoice,
  context: AgentContext,
  history: AgentMessage[],
  userMessage: string,
  options: RunDebateOptions,
): Promise<DebateVoiceResult> {
  // Voices that supply a custom system prompt route through a synthetic
  // persona slot. We piggyback on `forcePersona` + a temporary patch of the
  // PERSONA_SYSTEM_PROMPTS registry so `runAgent` doesn't need to grow a
  // systemPromptOverride parameter.
  const synthSlot: PersonaId = (voice.personaId ?? "drafter") as PersonaId;
  const customPrompt = voice.systemPromptOverride
    ? voice.systemPromptOverride
    : voice.systemPromptSuffix
      ? `${PERSONA_SYSTEM_PROMPTS[synthSlot]}\n\n${voice.systemPromptSuffix}`
      : null;

  const restore = customPrompt ? PERSONA_SYSTEM_PROMPTS[synthSlot] : null;
  if (customPrompt) {
    PERSONA_SYSTEM_PROMPTS[synthSlot] = customPrompt;
  }

  let prose = "";
  let usage: AgentUsage = { ...DEFAULT_USAGE };
  let errored: string | null = null;
  let persona: PersonaId | null = null;

  try {
    for await (const ev of runAgent(context, history, userMessage, {
      forcePersona: synthSlot,
      ...(options.provider ? { provider: options.provider } : {}),
      ...(options.model ? { model: options.model } : {}),
      ...(options.maxTokens !== undefined ? { maxTokens: options.maxTokens } : {}),
    })) {
      if (ev.type === "persona-selected") persona = ev.persona;
      if (ev.type === "text-delta") prose += ev.delta;
      if (ev.type === "done") usage = ev.usage;
      if (ev.type === "error") {
        errored = ev.message;
        break;
      }
    }
  } finally {
    if (restore !== null) {
      PERSONA_SYSTEM_PROMPTS[synthSlot] = restore;
    }
  }

  if (errored) {
    return {
      name: voice.name,
      status: "error",
      prose,
      citations: [],
      usage,
      error: errored,
      persona,
    };
  }

  const parsed = parseModelOutput(prose);
  return {
    name: voice.name,
    status: "ok",
    prose: parsed.prose,
    citations: parsed.citations,
    usage,
    persona,
  };
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

  const wrapped = voices.map((voice) => {
    const call = runOneVoice(voice, context, history, userMessage, options);
    if (options.timeoutMs && options.timeoutMs > 0) {
      return Promise.race<DebateVoiceResult>([
        call,
        new Promise<DebateVoiceResult>((resolve) =>
          setTimeout(
            () =>
              resolve({
                name: voice.name,
                status: "timeout",
                prose: "",
                citations: [],
                usage: { ...DEFAULT_USAGE },
                error: `Voice "${voice.name}" exceeded ${options.timeoutMs}ms.`,
                persona: null,
              }),
            options.timeoutMs,
          ),
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
 * A starter set of compliance-review voices. Tuned for securities-review
 * tasks (OM, KYC, marketing). Refine the suffixes to match your firm's
 * review style — they're the lightest-weight knob in this whole pipeline.
 *
 * NOTE: these are intentionally short. The base persona prompt does the
 * heavy lifting; the suffix nudges stance.
 */
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
