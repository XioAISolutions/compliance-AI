/**
 * @mention parser + router.
 *
 * Cannibalized from [bcurts/agentchattr](https://github.com/bcurts/agentchattr)
 * `router.py` — parse `@agent` tokens out of prose and route dispatches to
 * the named agent. Loop guard caps agent→agent chains (`max_agent_hops`)
 * but lets human @mentions bypass the guard since the user is in the loop.
 *
 * In our world, @mentions fire inside a multi-persona timeline:
 *   - User can @mention any participant to address a question to them
 *   - The lead persona (drafter / om-reviewer / etc.) can @mention another
 *     persona mid-draft to pull them in (e.g. drafter @risk-assessor)
 *   - The judge never @mentions — it emits verdicts, not reroutes
 */

import { isParticipantId, PARTICIPANTS } from "./registry.js";
import type { ParticipantId } from "./types.js";

const MENTION_RE = /(^|\s)@([a-zA-Z0-9_-]+)/g;

export interface ParseMentionsResult {
  /** Input text with @mentions preserved (for rendering the raw content). */
  raw: string;
  /** Input text with @mentions stripped (for model prompts that shouldn't
   *  see UI sigils). */
  cleaned: string;
  /** Deduped list of valid participant ids mentioned. */
  mentions: ParticipantId[];
  /** Tokens that looked like mentions but didn't match a known participant. */
  unknownMentions: string[];
}

export function parseMentions(text: string): ParseMentionsResult {
  const mentionsSet = new Set<ParticipantId>();
  const unknown: string[] = [];
  let cleaned = text;

  const matches = [...text.matchAll(MENTION_RE)];
  for (const m of matches) {
    const token = m[2] ?? "";
    if (isParticipantId(token)) {
      mentionsSet.add(token);
    } else {
      unknown.push(token);
    }
  }

  // Strip the @tokens from `cleaned` — model prompts are easier to reason
  // about without the routing sigil littered through the text. Collapse
  // doubled whitespace that the strip leaves behind.
  cleaned = text
    .replace(MENTION_RE, (_match, leading) => leading)
    .replace(/[ \t]{2,}/g, " ");

  return {
    raw: text,
    cleaned: cleaned.trim(),
    mentions: [...mentionsSet],
    unknownMentions: unknown,
  };
}

/**
 * The loop guard counter. Mirrors agentchattr's `max_agent_hops`.
 *
 * Increment every time an agent's @mention triggers another agent turn.
 * Reset whenever the *user* speaks (their turns are always off-budget).
 *
 * The coordinator stops adding agent↔agent hops once `hopsUsed >= maxHops`,
 * emits a `loop-guard-paused` event, and waits for the user to either
 * `/continue` (resets the counter) or submit a new turn.
 */
export interface LoopGuard {
  readonly maxHops: number;
  hopsUsed: number;
}

export function createLoopGuard(maxHops = 6): LoopGuard {
  return { maxHops, hopsUsed: 0 };
}

export function guardBumpAgentHop(guard: LoopGuard): { paused: boolean } {
  guard.hopsUsed++;
  return { paused: guard.hopsUsed >= guard.maxHops };
}

export function guardResetOnUserTurn(guard: LoopGuard): void {
  guard.hopsUsed = 0;
}

/** Render a participant label for a mention token. Used by the prompt
 *  synthesizer when the lead persona hands off to a mentioned peer. */
export function describeMention(id: ParticipantId): string {
  const p = PARTICIPANTS[id];
  return `@${p.id} (${p.name}) — ${p.description}`;
}
