/**
 * Chat-structure — types shared between registry, mentions, transcript,
 * and the tool-call layer.
 *
 * Cannibalized from [bcurts/agentchattr](https://github.com/bcurts/agentchattr)
 * patterns (registry.py, store.py, router.py) and adapted to our in-process
 * TS + SSE model instead of MCP terminal bridges.
 *
 * The key insight kept: agents + the user are first-class identities with a
 * registry, a color, and a status — not implicit roles. Conversations are
 * JSONL-persisted linear timelines with reply-threading, loop-guarded so
 * agent↔agent chains can't run away.
 */

/**
 * Identity as it flows through the timeline. `user` is the human; the rest
 * mirror the PersonaId union from @compliance-ai/agents.
 */
export type ParticipantId =
  | "user"
  | "drafter"
  | "reviewer"
  | "evidence-collector"
  | "risk-assessor"
  | "judge"
  | "om-reviewer"
  | "kyc-reviewer"
  | "marketing-reviewer"
  | "response-drafter";

/** Visual + descriptive metadata used by the timeline UI. */
export interface Participant {
  id: ParticipantId;
  name: string;
  /** Tailwind token e.g. "blue", "amber", "teal" — the UI layer maps this
   *  to bg/text utility classes. Keeps color choices centralized. */
  color: ParticipantColor;
  initials: string;
  description: string;
}

export type ParticipantColor =
  | "blue"
  | "amber"
  | "teal"
  | "green"
  | "red"
  | "purple"
  | "orange"
  | "slate"
  | "violet"
  | "pink";

/** Runtime status pill surfaced next to a participant's name in the UI. */
export type ParticipantStatus = "online" | "working" | "offline";

/**
 * A single persisted turn in the timeline. Structurally JSONL-compatible:
 * every turn fits on one line of a `.jsonl` file so replay is trivial.
 * Mirrors agentchattr's store.py record shape.
 */
export interface TranscriptTurn {
  id: string;
  matterId: string;
  /** Monotonic per-matter; useful for stable ordering and UCB1-style picks. */
  seq: number;
  /** ISO timestamp. */
  createdAt: string;
  /** Who emitted this turn. */
  from: ParticipantId;
  /** The participant this turn is addressed to (e.g. judge replying to drafter). */
  to?: ParticipantId;
  /** Previous-turn id that this turn replies to; enables reply threading. */
  replyTo?: string;
  /** Loop round number (1-based). Omitted for free-form user turns. */
  round?: number;
  /** Free-form markdown body. */
  content: string;
  /** Inline structured tool calls (cite_authority, flag_gap, etc.). */
  toolCalls?: ToolCallRecord[];
  /** @mentions parsed from `content`. */
  mentions?: ParticipantId[];
  /** Turn kind — used to style the bubble and drive layout decisions. */
  kind: TurnKind;
  /** Verdict attached to this turn (judge turns only). */
  verdict?: "READY_TO_SUBMIT" | "ITERATE" | "REWRITE";
}

export type TurnKind =
  | "user-message"
  | "agent-draft"
  | "judge-verdict"
  | "agent-reply"
  | "tool-call"
  | "system-note";

/**
 * Structured tool call record. Agents emit tool calls as typed chips the UI
 * can render distinctly from free-form prose (mirrors agentchattr's MCP
 * bridge `chat_send` / `chat_read` / `chat_claim` paradigm, adapted for
 * compliance-grade structured outputs).
 */
export interface ToolCallRecord {
  id: string;
  tool: ToolName;
  args: Record<string, unknown>;
  /** Result payload, if the tool was executed. */
  result?: unknown;
}

export type ToolName =
  | "cite_authority"
  | "flag_gap"
  | "request_review"
  | "hand_off";
