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
  | "risk-assessor"; // surfaces residual risk + compensating controls

export interface AgentContext {
  /** The control the user is reasoning about. May be null for cross-cutting questions. */
  control: Control | null;
  /** When `control` is null, restrict reasoning to these frameworks. */
  frameworkScope: FrameworkId[];
  /** Tenant id — passed through for audit-trail linkage downstream. */
  organizationId: string;
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

/** A single SSE-friendly event the route streams to the browser. */
export type AgentEvent =
  | { type: "persona-selected"; persona: PersonaId; reason: string }
  | { type: "text-delta"; delta: string }
  | { type: "done"; usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number } }
  | { type: "error"; message: string };
