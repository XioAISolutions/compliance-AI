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
import type { Citation } from "./citations.js";

export type PersonaId =
  | "drafter" // produces policy / procedure language
  | "reviewer" // critiques drafts against framework intent
  | "evidence-collector" // identifies what evidence satisfies a control
  | "risk-assessor" // surfaces residual risk + compensating controls
  | "judge" // verdict-only persona used by the loop coordinator
  | "om-reviewer" // reviews offering memoranda against securities rules
  | "kyc-reviewer" // reviews client KYC files for NI 31-103 / FINTRAC gaps
  | "marketing-reviewer" // reviews marketing materials for NI 81-102 / 13.18
  | "response-memo-drafter" // drafts responses to regulator inquiries
  | "court-ai-disclosure-drafter" // drafts AI-use disclosure memos for court filings
  | "qa-responder"; // answers jurisdictional Q&A via /api/ask — never routed, only force-selected

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

/**
 * A chunk of the document that the reviewer is REVIEWING (not retrieving for
 * grounding — this is the subject of the review). The reviewer persona cites
 * back to these chunks by `chunkId` the same way it cites retrieved authority
 * snippets, but the semantic role is different: the subject is the target of
 * the review, authorities are the rules used to evaluate it.
 */
export interface ReviewSubjectChunk {
  chunkId: string;
  ordinal: number;
  /** 1-indexed page number if the source is paged (PDF). */
  page?: number;
  content: string;
}

export interface ReviewSubject {
  documentId: string;
  documentType: string;
  title: string;
  /** Document chunks in ordinal order. */
  chunks: ReviewSubjectChunk[];
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
  /**
   * Optional document under review. When set, the reviewer persona inspects
   * these chunks against the retrieved authority snippets. Use this for OM
   * review, KYC gap checks, marketing sign-off — any task where there's a
   * concrete document being evaluated.
   */
  reviewSubject?: ReviewSubject;
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
 * `loop-done` on top of the single-shot event set. Task-runners emit
 * `prose-final` and `citations` after the loop terminates.
 *
 * Per-event UI hint:
 *   persona-selected → label the current bubble
 *   round-started    → (loop) new round begins; UI should reset output
 *                      when a drafter round starts after round 1
 *   text-delta       → append to current bubble's content
 *   verdict-final    → decorate the most recent judge bubble with the verdict
 *   prose-final      → REPLACE the accumulated output with the clean final
 *                      prose (citations fence stripped). Emitted once,
 *                      after the loop exits and model output is parsed.
 *   citations        → the structured Citation[] extracted from the final
 *                      output. UI renders footnote panel + interactive
 *                      superscripts. Export route uses this for exhibits.
 *   done             → close current bubble; show usage
 *   loop-done        → terminal; end the conversation
 *   error            → surface inline; loop aborts
 */
export type AgentEvent =
  | { type: "persona-selected"; persona: PersonaId; reason: string }
  | { type: "text-delta"; delta: string }
  | { type: "done"; usage: AgentUsage }
  | { type: "round-started"; round: number; persona: PersonaId }
  | {
      type: "citations";
      citations: Citation[];
      orphanedMarkers: string[];
      unusedCitations: string[];
    }
  | { type: "verdict-final"; verdict: JudgeVerdict }
  | { type: "prose-final"; prose: string }
  | { type: "citations"; citations: Citation[] }
  | { type: "loop-done"; totalRounds: number; finalVerdict: JudgeVerdict | null }
  | { type: "error"; message: string };
