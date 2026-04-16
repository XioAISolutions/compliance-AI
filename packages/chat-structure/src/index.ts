/**
 * @compliance-ai/chat-structure — agent identities, @mention routing,
 * JSONL transcript, and typed tool calls.
 *
 * Cannibalized from the agentchattr multi-agent terminal chat project
 * (bcurts/agentchattr) — same architectural primitives, ported to our
 * in-process TypeScript model.
 */

export * from "./types.js";
export {
  AGENT_REGISTRY,
  PARTICIPANTS,
  getParticipant,
  isParticipantId,
  toStatusView,
} from "./registry.js";
export {
  MAX_AGENT_HOPS,
  parseMentions,
  createLoopGuard,
  guardBumpAgentHop,
  guardResetOnUserTurn,
  describeMention,
  type ParseMentionsResult,
  type LoopGuard,
} from "./mentions.js";
export {
  parseToolCalls,
  TOOL_INSTRUCTION,
  type CiteAuthorityArgs,
  type FlagGapArgs,
  type RequestReviewArgs,
  type HandOffArgs,
  type ParsedToolCallsResult,
} from "./tools.js";
export {
  InMemoryTranscriptStore,
  getDefaultTranscriptStore,
  setDefaultTranscriptStore,
  toJsonl,
  type AppendInput,
  type TranscriptStore,
} from "./transcript.js";
