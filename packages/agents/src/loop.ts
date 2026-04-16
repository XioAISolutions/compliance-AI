/**
 * Multi-persona loop coordinator (drafter ↔ judge, plus @mention fan-out).
 *
 * Cannibalized from ASI-Evolve's `pipeline/evolve.py` (drafter/judge loop)
 * and [bcurts/agentchattr](https://github.com/bcurts/agentchattr)'s
 * @mention-driven routing + loop guard.
 *
 * Shape of a round:
 *   1. round-started { persona: leadPersona }
 *   2. runAgent streams text-delta / done events for the lead
 *   3. Lead output is parsed for:
 *        - fenced ```citations block    → `citations` event
 *        - {{tool:...}} calls            → `tool-call` events (one per call)
 *        - @mention tokens               → `mention` events (one per target)
 *   4. If a `hand_off` tool call is present OR an @mention lands on a
 *      valid persona, dispatch a FOLLOWUP round for that persona before
 *      advancing to the judge. Followup rounds count against `maxAgentHops`
 *      (not `maxRounds`).
 *   5. Judge round runs as before, yielding `verdict-final`.
 *   6. Based on verdict: READY → terminate; ITERATE/REWRITE → build next
 *      lead prompt and continue.
 *
 * State ownership: the loop owns the `AgentMessage[]` history. Each call
 * to `runAgent` is stateless — it sees the full history we hand it.
 */

import { runAgent } from "./run.js";
import { parseVerdict } from "./personas/judge.js";
import { parseModelOutput, validateCitations } from "./citations.js";
import type { AgentContext, AgentEvent, AgentMessage, JudgeVerdict, PersonaId } from "./types.js";
import {
  parseMentions,
  parseToolCalls,
  createLoopGuard,
  guardBumpAgentHop,
  isParticipantId,
  type LoopGuard,
  type ParticipantId,
} from "@compliance-ai/chat-structure";

export interface RunAgentLoopOptions {
  /** Max drafter+judge rounds. Default 4. */
  maxRounds?: number;
  /** Override default model id (passed through to runAgent). */
  model?: string;
  /** Override max output tokens (passed through to runAgent). */
  maxTokens?: number;
  /**
   * Leading persona for the drafter-position of the loop. Defaults to
   * "drafter"; override with "om-reviewer" / "kyc-reviewer" /
   * "marketing-reviewer" / "response-drafter" to fan out by task type.
   */
  leadPersona?: PersonaId;
  /**
   * Max agent→agent hops via @mentions or hand_off tool calls. Default 4.
   * Separate from `maxRounds` so a chatty loop can't exhaust the budget in
   * a single round.
   */
  maxAgentHops?: number;
}

/**
 * Convert a `ParticipantId` from the chat-structure registry to a PersonaId,
 * if it corresponds to an agent (not the `user`).
 */
function toPersonaId(id: ParticipantId): PersonaId | null {
  if (id === "user") return null;
  return id as PersonaId;
}

export async function* runAgentLoop(
  context: AgentContext,
  initialUserMessage: string,
  options: RunAgentLoopOptions = {},
): AsyncGenerator<AgentEvent> {
  const maxRounds = options.maxRounds ?? 4;
  const leadPersona: PersonaId = options.leadPersona ?? "drafter";
  const guard: LoopGuard = createLoopGuard(options.maxAgentHops ?? 4);

  const validChunkIds = new Set<string>(
    (context.retrievedSnippets ?? []).map((s) => s.id).filter(Boolean),
  );

  const history: AgentMessage[] = [];
  let pendingUserMessage = initialUserMessage;
  let lastVerdict: JudgeVerdict | null = null;
  let round = 0;

  while (round < maxRounds) {
    round++;

    // -------- LEAD round --------
    const leadBuffer = yield* streamPersonaRound(
      context,
      history,
      pendingUserMessage,
      leadPersona,
      round,
      options,
      validChunkIds,
    );
    if (leadBuffer === null) {
      yield { type: "loop-done", totalRounds: round, finalVerdict: lastVerdict };
      return;
    }

    // Persist the lead exchange for both judge and subsequent rounds.
    history.push({ role: "user", content: pendingUserMessage });
    history.push({ role: "assistant", content: leadBuffer });

    // -------- FOLLOWUP rounds (from @mentions / hand_off) --------
    // Pull mention + hand_off signals out of the lead's output (parsed
    // once, shared across the guard and followup dispatch).
    const mentions = parseMentions(leadBuffer).mentions;
    const { toolCalls } = parseToolCalls(leadBuffer);
    const handOffTargets: ParticipantId[] = toolCalls
      .filter((tc) => tc.tool === "hand_off")
      .map((tc) => (tc.args as { to?: string }).to ?? "")
      .filter(isParticipantId);
    const followupQueue: PersonaId[] = [];
    for (const m of [...mentions, ...handOffTargets]) {
      const p = toPersonaId(m);
      if (!p) continue;
      if (p === "judge") continue; // judge is reserved for the structured verdict
      if (p === leadPersona) continue;
      if (followupQueue.includes(p)) continue;
      followupQueue.push(p);
    }

    for (const followup of followupQueue) {
      const { paused } = guardBumpAgentHop(guard);
      if (paused) {
        yield {
          type: "mention",
          from: leadPersona,
          to: followup,
          context: `agent-hop guard paused at ${guard.hopsUsed}/${guard.maxHops}; ignored follow-up`,
        };
        break;
      }
      yield { type: "mention", from: leadPersona, to: followup, context: pendingUserMessage };

      const followupPrompt = `The lead ${leadPersona} has requested your input with this mention/hand-off. Read the lead's latest draft above and respond concisely. Focus strictly on the element that invoked you — do not rewrite the draft.`;
      const followupBuffer = yield* streamPersonaRound(
        context,
        history,
        followupPrompt,
        followup,
        round,
        options,
        validChunkIds,
      );
      if (followupBuffer === null) {
        // Error — abort the loop gracefully.
        yield { type: "loop-done", totalRounds: round, finalVerdict: lastVerdict };
        return;
      }
      history.push({ role: "user", content: followupPrompt });
      history.push({ role: "assistant", content: followupBuffer });
    }

    // -------- JUDGE round --------
    yield { type: "round-started", round, persona: "judge" };
    const judgePrompt =
      "Render your verdict on the most recent draft above. Follow the verdict format exactly: short rationale, then one verdict token alone on the final line.";
    let judgeBuffer = "";
    let judgeErrored = false;
    for await (const ev of runAgent(context, history, judgePrompt, {
      forcePersona: "judge",
      model: options.model,
      maxTokens: options.maxTokens,
    })) {
      if (ev.type === "text-delta") judgeBuffer += ev.delta;
      if (ev.type === "error") judgeErrored = true;
      yield ev;
    }
    if (judgeErrored) {
      yield { type: "loop-done", totalRounds: round, finalVerdict: lastVerdict };
      return;
    }

    const verdict = parseVerdict(judgeBuffer);
    lastVerdict = verdict;
    yield { type: "verdict-final", verdict };

    if (verdict === "READY_TO_SUBMIT") {
      yield { type: "loop-done", totalRounds: round, finalVerdict: verdict };
      return;
    }

    history.push({ role: "user", content: judgePrompt });
    history.push({ role: "assistant", content: judgeBuffer });

    pendingUserMessage =
      verdict === "ITERATE"
        ? `The compliance audit judge raised the following concerns about your draft:\n\n${judgeBuffer}\n\nRevise the draft to address each point. Preserve what's working; fix only what's flagged. Output the full revised draft, not just the diff.`
        : `The compliance audit judge concluded the fundamental approach is wrong:\n\n${judgeBuffer}\n\nStart over with a different approach. Do not iterate on the prior draft. Output the full new draft.`;
  }

  yield { type: "loop-done", totalRounds: round, finalVerdict: lastVerdict };
}

/**
 * Stream one round for a non-judge persona. Yields:
 *   - round-started
 *   - all text-delta / done / error events from runAgent
 *   - a `citations` event once the round ends (always, even if no citations)
 *   - `tool-call` events for each parsed `{{tool:...}}` block
 *   - `mention` events for each @mention the persona emitted (fan-out done
 *     by the caller, not this helper)
 *
 * Returns the raw buffered output, or `null` if the persona errored.
 */
async function* streamPersonaRound(
  context: AgentContext,
  history: AgentMessage[],
  userPrompt: string,
  persona: PersonaId,
  round: number,
  options: RunAgentLoopOptions,
  validChunkIds: Set<string>,
): AsyncGenerator<AgentEvent, string | null, unknown> {
  yield { type: "round-started", round, persona };

  let buffer = "";
  let errored = false;
  for await (const ev of runAgent(context, history, userPrompt, {
    forcePersona: persona,
    model: options.model,
    maxTokens: options.maxTokens,
  })) {
    if (ev.type === "text-delta") buffer += ev.delta;
    if (ev.type === "error") errored = true;
    yield ev;
  }
  if (errored) return null;

  // Parse citations.
  const parsed = parseModelOutput(buffer);
  let citations = parsed.citations;
  if (validChunkIds.size > 0) {
    const { valid } = validateCitations(citations, validChunkIds);
    citations = valid;
  }

  // Parse tool calls — emit one event per call.
  const { toolCalls, redactedText: toolRedacted } = parseToolCalls(parsed.prose);
  for (const tc of toolCalls) {
    yield { type: "tool-call", persona, tool: tc.tool, args: tc.args };
  }

  yield {
    type: "citations",
    persona,
    citations,
    orphanedMarkers: parsed.orphanedMarkers,
    unusedCitations: parsed.unusedCitations,
    redactedText: toolRedacted,
  };

  return buffer;
}
