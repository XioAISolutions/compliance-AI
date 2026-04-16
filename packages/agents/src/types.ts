/**
 * Agent contracts.
 *
 * Two-axis routing model:
 *   - Persona (TASK)         — what kind of help: drafter, reviewer, evidence-collector, risk-assessor
 *   - Framework (DOMAIN)     — which body of rules: soc2 | gdpr | eu-ai-act | iso-27001
 *
 * The TASK is selected by `routePersona()` from the user's message + control context.
 * The DOMAIN is supplied by the caller (via the typed `Control` they're chatting about),
 * so personas don't need to disambiguate. This keeps each persona's system prompt small
 * and lets us add frameworks without retraining personas.
 */

import type { Control, FrameworkId } from "@compliance-ai/frameworks";

export type PersonaId =
  | "drafter" // produces policy / procedure language
  | "reviewer" // critiques drafts against framework intent
  | "evidence-collector" // identifies what evidence satisfies a control
  | "risk-assessor" // surfaces residual risk + compensating controls
  | "judge" // verdict-only persona used by the loop coordinator
  | "om-reviewer"; // reviews offering memoranda against securities rules

/**
 * A snippet retrieved from the cognition store and injected into the agent's
 * context block. The route handler (or any orchestrator) is responsible for
 * doing the retrieval and passing the results in — this keeps `runAgent`
 * stateless and trivially testable.
 */
export interface RetrievedSnippet {
  id: string;
  title: string;
  content: string;
  source?: string;
  /** Backend-defined relevance score, surfaced to the UI for transparency. */
  score: number;
}

export interface AgentContext {
  /** The control the user is reasoning about. May be null for cross-cutting questions. */
  control: Control | null;
  /** When `control` is null, restrict reasoning to these frameworks. */
  frameworkScope: FrameworkId[];
  /** Tenant id — passed through for audit-trail linkage downstream. */
  organizationId: string;
  /** Optional cognition-store snippets to ground this turn. */
  retrievedSnippets?: RetrievedSnippet[];
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
}

/** Verdict tokens emitted by the judge persona. */
export type JudgeVerdict = "READY_TO_SUBMIT" | "ITERATE" | "REWRITE";

/**
 * SSE-friendly events emitted by `runAgent` (single-shot) and `runAgentLoop`
 * (loop coordinator). The loop adds `round-started`, `verdict-final`, and
 * `loop-done` on top of the single-shot event set.
 *
 * Per-event UI hint:
 *   round-started   → append a new assistant bubble for `persona`
 *   persona-selected → label the current bubble
 *   text-delta      → append to current bubble's content
 *   done            → close current bubble; show usage
 *   verdict-final   → decorate the most recent judge bubble with the verdict
 *   loop-done       → terminal; end the conversation
 *   error           → surface inline; loop aborts
 */
export type AgentEvent =
  | { type: "persona-selected"; persona: PersonaId; reason: string }
  | { type: "text-delta"; delta: string }
  | { type: "done"; usage: AgentUsage }
  | { type: "round-started"; round: number; persona: PersonaId }
  | { type: "verdict-final"; verdict: JudgeVerdict }
  | { type: "loop-done"; totalRounds: number; finalVerdict: JudgeVerdict | null }
  | { type: "error"; message: string };
