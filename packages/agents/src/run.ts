/**
 * Agent runner — bridges router + persona prompts to the configured LLM.
 *
 * Yields a typed AsyncGenerator<AgentEvent> that the API route forwards as SSE.
 * Caller is responsible for SSE framing — keeps this package transport-agnostic
 * (could be reused by a CLI, a worker, a test harness).
 *
 * Provider strategy:
 *   - OpenAI for the hosted preview (`LLM_PROVIDER=openai`)
 *   - Ollama for private/local installs (`LLM_PROVIDER=ollama`)
 *   - Anthropic retained as a backwards-compatible legacy provider
 *
 * Anthropic keeps prompt caching on stable persona/control blocks. OpenAI and
 * Ollama receive the same blocks flattened into one system message.
 */

import Anthropic from "@anthropic-ai/sdk";
import { isFramework, type Control, type FrameworkId } from "@compliance-ai/frameworks";
import { PERSONA_SYSTEM_PROMPTS } from "./personas/index.js";
import { routePersona } from "./router.js";
import { CITATION_INSTRUCTION } from "./citations.js";
import type {
  AgentContext,
  AgentEvent,
  AgentMessage,
  AgentUsage,
  PersonaId,
  RetrievedSnippet,
  ReviewSubject,
} from "./types.js";

export type ModelProvider = "anthropic" | "openai" | "ollama";

export interface ModelProviderEnv {
  [key: string]: string | undefined;
  ANTHROPIC_API_KEY?: string;
  LLM_PROVIDER?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_CHAT_MODEL?: string;
  OLLAMA_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_MODEL?: string;
}

export interface ModelProviderConfig {
  provider: ModelProvider;
  model: string;
  baseUrl?: string;
}

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_OPENAI_MODEL = "gpt-5.4-mini";
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";
// Compliance reviews routinely produce 15+ citations + 5000+ tokens of cited
// prose (checklist + gap memo + risk flags + resale check + post-filing).
// The citations block alone runs ~200 tokens per citation — at 16 cites that's
// 3200 tokens of citation JSON AFTER the main body. 4096 truncated the
// ```citations fence silently; 12288 got far enough that longer marketing /
// multi-slide reviews still hit the ceiling mid-JSON. 16000 fits within
// gpt-5.4-mini's max_completion_tokens limit and gives even the most
// citation-heavy deliverables room. Route-level citation-integrity retry
// covers the remaining edge cases.
const MAX_TOKENS = 16000;

export interface RunAgentOptions {
  /** Override the heuristic router with an explicit persona. */
  forcePersona?: PersonaId;
  /** Override env-based provider resolution. */
  provider?: ModelProvider;
  /** Override the default model id. */
  model?: string;
  /** Override max output tokens. */
  maxTokens?: number;
}

function hasValue(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

function normalizeProvider(value: string | undefined): ModelProvider | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "anthropic" || normalized === "openai" || normalized === "ollama") {
    return normalized;
  }
  throw new Error(
    `Unsupported LLM_PROVIDER "${value}". Expected one of: openai, ollama, anthropic.`,
  );
}

function normalizeBaseUrl(baseUrl: string, suffix = "/v1"): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith(suffix) ? trimmed : `${trimmed}${suffix}`;
}

export function resolveModelProvider(
  env: ModelProviderEnv = process.env,
  options: Pick<RunAgentOptions, "model" | "provider"> = {},
): ModelProviderConfig {
  const provider =
    options.provider ??
    normalizeProvider(env.LLM_PROVIDER) ??
    (hasValue(env.OPENAI_API_KEY)
      ? "openai"
      : hasValue(env.ANTHROPIC_API_KEY)
        ? "anthropic"
        : "ollama");

  if (provider === "openai") {
    return {
      provider,
      model: options.model ?? env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      baseUrl: normalizeBaseUrl(env.OPENAI_BASE_URL ?? "https://api.openai.com/v1", ""),
    };
  }

  if (provider === "ollama") {
    return {
      provider,
      model: options.model ?? env.OLLAMA_MODEL ?? env.OLLAMA_CHAT_MODEL ?? DEFAULT_OLLAMA_MODEL,
      baseUrl: normalizeBaseUrl(env.OLLAMA_BASE_URL ?? "http://localhost:11434"),
    };
  }

  return {
    provider,
    model: options.model ?? DEFAULT_ANTHROPIC_MODEL,
  };
}

/**
 * Render the typed Control into a markdown context block the model can reason over.
 * Keep this stable across turns — it's part of the cached system prefix.
 */
function renderControlContext(control: Control | null, frameworkScope: FrameworkId[]): string {
  if (!control) {
    return `## Scope\nUser is asking about the following frameworks: ${frameworkScope.join(", ")}.\nNo specific control is in focus — answer in framework-agnostic terms or ask which control to anchor to.`;
  }

  const lines: string[] = [
    `## Control in focus`,
    `- **Framework**: ${control.framework}`,
    `- **Code**: ${control.code}`,
    `- **Title**: ${control.title}`,
    `- **Description**: ${control.description}`,
  ];

  // Framework-specific extras — using the discriminator from frameworks/control.ts
  if (isFramework(control, "soc2")) {
    lines.push(`- **Trust Service Criterion**: ${control.tsc}`);
    lines.push(`- **Audit period**: ${control.auditPeriod}`);
    if (control.pointsOfFocus.length > 0) {
      lines.push(`- **Points of focus**:`);
      for (const p of control.pointsOfFocus) lines.push(`  - ${p}`);
    }
  } else if (isFramework(control, "gdpr")) {
    lines.push(`- **Article**: ${control.article}`);
    lines.push(`- **Chapter**: ${control.chapter}`);
    if (control.lawfulBasis?.length) {
      lines.push(`- **Lawful bases**: ${control.lawfulBasis.join(", ")}`);
    }
    if (control.dataSubjectRight) {
      lines.push(`- **Data subject right**: ${control.dataSubjectRight}`);
    }
  } else if (isFramework(control, "eu-ai-act")) {
    lines.push(`- **Article**: ${control.article}`);
    lines.push(`- **Risk tier**: ${control.riskTier}`);
    if (control.annex) lines.push(`- **Annex**: ${control.annex}`);
  } else if (isFramework(control, "iso-27001")) {
    lines.push(`- **Annex A reference**: ${control.annexA}`);
    lines.push(`- **Domain**: ${control.domain}`);
  }

  return lines.join("\n");
}

/**
 * Render retrieved cognition snippets into a (non-cached) context block.
 *
 * Why non-cached: snippets are query-dependent and change every turn. Caching
 * them would invalidate the prefix more often than it would hit. Place this
 * block AFTER the cached persona + control blocks so the cache cut-point sits
 * on stable content.
 *
 * Citation rule mirrors ASI-Evolve's grounding instruction in
 * `pipeline/researcher.jinja2`: tell the model to cite by title and to prefer
 * the framework when a snippet contradicts it. Compliance-grade hallucination
 * resistance > stylistic fidelity.
 */
/**
 * Render the document under review into its own context block.
 *
 * Non-cached (changes per matter). Placed BEFORE the cognition context so the
 * model sees the subject first, then the rules used to evaluate it. Each
 * chunk carries its id so the reviewer can cite "OM § [chunkId] fails to
 * disclose X" and the UI can link back to the source.
 *
 * Budget: this block dominates token usage for long OMs. The caller should
 * pre-truncate `chunks` if total chunk content exceeds ~30k tokens.
 */
function renderReviewSubject(subject: ReviewSubject | undefined): string {
  if (!subject || subject.chunks.length === 0) return "";
  const lines: string[] = [
    `## Document under review`,
    `You are reviewing the ${subject.documentType} titled "${subject.title}" (docId: ${subject.documentId}). The document is split into chunks below, each labeled with a chunkId. When you cite a specific passage FROM THE SUBJECT DOCUMENT in your review, reference it by chunkId the same way you cite authorities: emit a \`[cN]\` marker and include a matching entry in the citations array with this chunkId and the docId above.`,
    ``,
  ];
  for (const chunk of subject.chunks) {
    const pageLabel = chunk.page !== undefined ? `, p.${chunk.page}` : "";
    lines.push(`### [chunkId: ${chunk.chunkId}${pageLabel}, ordinal ${chunk.ordinal}]`);
    lines.push(chunk.content);
    lines.push(``);
  }
  return lines.join("\n");
}

/**
 * Render retrieved cognition snippets into the system-prompt context block.
 * Exported for unit-testing: the empty-snippet path emits an explicit
 * RETRIEVAL-GAP directive (telling the model not to fabricate [cN] markers
 * and to flag the gap in its output) — this is load-bearing behaviour that
 * a regression would silently hide.
 */
export function renderCognitionContext(snippets: RetrievedSnippet[]): string {
  // When retrieval returns empty, we still emit a context block — telling the
  // model "no authorities came back, do not fabricate [cN] markers, and flag
  // this gap in your output" is strictly better than dropping the citation
  // instruction entirely and letting the persona's default citation habit
  // produce orphan markers that audit can't reconcile.
  if (snippets.length === 0) {
    return [
      `## Retrieved tenant context`,
      `**No authorities were retrieved for this matter.** The tenant's compliance corpus either has no items that matched the retrieval query, or the retrieval layer is not yet seeded for this tenant.`,
      ``,
      `In this case you MUST NOT fabricate [cN] citation markers or pretend to have an authority to back your findings. Instead:`,
      `- Lead your output with an explicit "RETRIEVAL GAP" notice naming what you would have cited.`,
      `- State each finding in plain terms, clearly labeled as uncited, and defer any rule-specific assertion to follow-up.`,
      `- Do not emit a \`\`\`citations fence at all — an empty array is acceptable and expected here.`,
      ``,
      `If a human reader asks why a finding isn't cited, the honest answer is "the retrieval layer returned zero authorities for this query" — surface that fact rather than hiding it.`,
    ].join("\n");
  }
  const lines: string[] = [
    `## Retrieved tenant context`,
    `The following snippets are drawn from this tenant's compliance corpus (authority rules, prior approved language, auditor letters, internal policy excerpts). Use them to ground your answer. If a snippet conflicts with the framework requirement, prefer the framework and flag the conflict.`,
    ``,
  ];
  for (const s of snippets) {
    lines.push(`### ${s.title}  [docId: ${s.id}]  _(relevance ${s.score.toFixed(2)})_`);
    if (s.source) lines.push(`*source:* ${s.source}`);
    lines.push(s.content);
    lines.push(``);
  }
  lines.push(``);
  lines.push(CITATION_INSTRUCTION);
  return lines.join("\n");
}

let cachedClient: Anthropic | null = null;
function client(): Anthropic {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your environment before calling runAgent().",
    );
  }
  cachedClient = new Anthropic({ apiKey });
  return cachedClient;
}

function renderSystemPrompt(blocks: Array<{ text: string }>): string {
  return blocks
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

function openAiCompatibleAuthHeaders(config: ModelProviderConfig): Record<string, string> {
  if (config.provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to your environment or set LLM_PROVIDER=ollama for local review.",
      );
    }
    return { Authorization: `Bearer ${apiKey}` };
  }

  const apiKey = process.env.OLLAMA_API_KEY;
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function parseOpenAiUsage(usage: unknown): AgentUsage | null {
  if (!usage || typeof usage !== "object") return null;
  const record = usage as Record<string, unknown>;
  return {
    inputTokens: typeof record.prompt_tokens === "number" ? record.prompt_tokens : 0,
    outputTokens: typeof record.completion_tokens === "number" ? record.completion_tokens : 0,
    cacheReadTokens: 0,
  };
}

async function* readOpenAiCompatibleStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let usage: AgentUsage | null = null;

  function* parseFrame(frame: string): Generator<AgentEvent> {
    const dataLines = frame
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        if (line.startsWith("data:")) return line.slice(5).trim();
        if (line.startsWith("{")) return line;
        return "";
      })
      .filter(Boolean);

    for (const data of dataLines) {
      if (data === "[DONE]") continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue;
      }
      const record = parsed as Record<string, unknown>;
      const parsedUsage = parseOpenAiUsage(record.usage);
      if (parsedUsage) usage = parsedUsage;

      const choices = record.choices;
      if (!Array.isArray(choices) || choices.length === 0) continue;
      const choice = choices[0] as Record<string, unknown>;
      const delta =
        choice.delta && typeof choice.delta === "object"
          ? (choice.delta as Record<string, unknown>)
          : null;
      const content =
        delta?.content ?? (choice.message as Record<string, unknown> | undefined)?.content;
      if (typeof content === "string" && content.length > 0) {
        yield { type: "text-delta", delta: content };
      }
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      yield* parseFrame(frame);
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    yield* parseFrame(buffer);
  }

  yield {
    type: "done",
    usage: usage ?? { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 },
  };
}

async function* runOpenAiCompatible(
  config: ModelProviderConfig,
  systemPrompt: string,
  history: AgentMessage[],
  userMessage: string,
  maxTokens: number,
): AsyncGenerator<AgentEvent> {
  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  const payload: Record<string, unknown> = {
    model: config.model,
    messages: [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: userMessage },
    ],
    stream: true,
  };

  if (config.provider === "openai") {
    payload.max_completion_tokens = maxTokens;
    payload.stream_options = { include_usage: true };
  } else {
    payload.max_tokens = maxTokens;
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...openAiCompatibleAuthHeaders(config),
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const details = await res.text().catch(() => "");
    throw new Error(
      `${config.provider} chat completion failed (${res.status}): ${details.slice(0, 500)}`,
    );
  }
  if (!res.body) {
    throw new Error(`${config.provider} chat completion returned an empty stream.`);
  }

  yield* readOpenAiCompatibleStream(res.body);
}

async function* runAnthropic(
  systemBlocks: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }>,
  history: AgentMessage[],
  userMessage: string,
  model: string,
  maxTokens: number,
): AsyncGenerator<AgentEvent> {
  const stream = client().messages.stream({
    model,
    max_tokens: maxTokens,
    system: systemBlocks as unknown as Anthropic.Messages.TextBlockParam[],
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: userMessage },
    ],
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "text-delta", delta: event.delta.text };
    }
  }

  const finalMessage = await stream.finalMessage();
  yield {
    type: "done",
    usage: {
      inputTokens: finalMessage.usage.input_tokens,
      outputTokens: finalMessage.usage.output_tokens,
      cacheReadTokens:
        (finalMessage.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
    },
  };
}

export async function* runAgent(
  context: AgentContext,
  history: AgentMessage[],
  userMessage: string,
  options: RunAgentOptions = {},
): AsyncGenerator<AgentEvent> {
  const decision = options.forcePersona
    ? { persona: options.forcePersona, reason: "Persona explicitly forced by caller." }
    : routePersona(userMessage);

  yield { type: "persona-selected", persona: decision.persona, reason: decision.reason };

  const personaPrompt = PERSONA_SYSTEM_PROMPTS[decision.persona];
  const controlContext = renderControlContext(context.control, context.frameworkScope);
  const reviewSubjectContext = renderReviewSubject(context.reviewSubject);
  const cognitionContext = renderCognitionContext(context.retrievedSnippets ?? []);

  // Cache strategy: persona + control are stable across turns (ephemeral cache).
  // Review subject and cognition blocks are non-cached — they change per matter
  // / per query. Order: persona → control → subject (what we're reviewing) →
  // authorities (what we're reviewing it against). Anthropic caches up to the
  // LAST block marked with cache_control, so the cut-point stays on the stable
  // prefix even when the subject or retrieved snippets vary.
  const systemBlocks: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }> = [
    { type: "text", text: personaPrompt, cache_control: { type: "ephemeral" } },
    { type: "text", text: controlContext, cache_control: { type: "ephemeral" } },
  ];
  if (reviewSubjectContext) {
    systemBlocks.push({ type: "text", text: reviewSubjectContext });
  }
  if (cognitionContext) {
    systemBlocks.push({ type: "text", text: cognitionContext });
  }

  try {
    const provider = resolveModelProvider(process.env, {
      model: options.model,
      provider: options.provider,
    });
    if (provider.provider === "anthropic") {
      yield* runAnthropic(
        systemBlocks,
        history,
        userMessage,
        provider.model,
        options.maxTokens ?? MAX_TOKENS,
      );
    } else {
      yield* runOpenAiCompatible(
        provider,
        renderSystemPrompt(systemBlocks),
        history,
        userMessage,
        options.maxTokens ?? MAX_TOKENS,
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { type: "error", message };
  }
}
