/**
 * Agent runner — bridges router + persona prompts to the Anthropic API.
 *
 * Yields a typed AsyncGenerator<AgentEvent> that the API route forwards as SSE.
 * Caller is responsible for SSE framing — keeps this package transport-agnostic
 * (could be reused by a CLI, a worker, a test harness).
 *
 * Caching strategy: persona prompt + control context are marked `cache_control:
 * ephemeral`. The user message is NOT cached (it changes every turn). This means
 * turn 2+ in a session pays ~10% of the system-prompt tokens.
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
  PersonaId,
  RetrievedSnippet,
} from "./types.js";

/**
 * Default model. Sonnet 4.6 balances streaming latency against compliance-grade
 * accuracy. Swap to `claude-opus-4-6` for high-stakes drafting if needed.
 */
const DEFAULT_MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

export interface RunAgentOptions {
  /** Override the heuristic router with an explicit persona. */
  forcePersona?: PersonaId;
  /** Override the default model id. */
  model?: string;
  /** Override max output tokens. */
  maxTokens?: number;
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
function renderCognitionContext(snippets: RetrievedSnippet[]): string {
  if (snippets.length === 0) return "";
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
  const cognitionContext = renderCognitionContext(context.retrievedSnippets ?? []);

  // Two cacheable blocks (persona + control) followed by an optional non-cached
  // cognition block. Anthropic caches up to the LAST block marked with
  // cache_control, so the cache cut-point stays on the stable prefix even when
  // retrieved snippets vary turn-to-turn.
  const systemBlocks: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }> = [
    { type: "text", text: personaPrompt, cache_control: { type: "ephemeral" } },
    { type: "text", text: controlContext, cache_control: { type: "ephemeral" } },
  ];
  if (cognitionContext) {
    systemBlocks.push({ type: "text", text: cognitionContext });
  }

  try {
    const stream = client().messages.stream({
      model: options.model ?? DEFAULT_MODEL,
      max_tokens: options.maxTokens ?? MAX_TOKENS,
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    yield { type: "error", message };
  }
}
