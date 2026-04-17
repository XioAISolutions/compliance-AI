/**
 * Review-stream helpers.
 *
 * Pure functions that the /api/matters/[id]/review route composes to produce
 * the "clean final deliverable" semantics:
 *
 *   - Track which round's text belongs to the drafter (not the judge). The
 *     judge's rationale is visible as a verdict badge, not as prose; only
 *     the drafter's output is the deliverable.
 *   - On each new drafter round, reset — when the judge says ITERATE and
 *     the drafter revises, the new draft replaces the old one. Users see
 *     the current best draft, not a transcript.
 *   - After the loop, parse the accumulated drafter output into clean prose
 *     (citation JSON fence stripped) + a structured Citation[] array.
 *
 * The underlying tools live in @compliance-ai/agents:
 *   - runAgentLoop emits AgentEvent (drafter / judge / verdict / loop-done)
 *   - parseModelOutput extracts prose + citations from a final string
 */

import { parseModelOutput, type AgentEvent, type Citation } from "@compliance-ai/agents";

/**
 * Internal state consumed by processReviewEvents().
 *
 * Exported so the review route can persist + inspect at loop end (to write
 * the final prose into the audit trail and auto-extract evidence items).
 */
export interface ReviewStreamState {
  /** Which persona is currently emitting text-delta events. */
  currentPersona: string | null;
  /** The most recent drafter round's output, reset whenever a new drafter round starts. */
  activeDrafterOutput: string;
  /**
   * The most recent judge round's output, reset when a new judge round starts.
   * Tracks the judge's rationale prose so a compliance lawyer looking at a
   * `needs-revision` or `blocked` matter can read WHY the judge rejected —
   * not just which verdict token came out. The rationale is discarded from
   * `activeDrafterOutput` (the judge's prose is not the deliverable), but it
   * IS auditor-relevant and gets surfaced in the UI as "Judge's notes."
   */
  activeJudgeOutput: string;
  /** Highest round number seen so far. */
  lastRound: number;
  /** Last verdict emitted by the judge. */
  lastVerdict: string | null;
  /** Total rounds reported by loop-done. */
  totalRounds: number;
}

export function newReviewStreamState(): ReviewStreamState {
  return {
    currentPersona: null,
    activeDrafterOutput: "",
    activeJudgeOutput: "",
    lastRound: 0,
    lastVerdict: null,
    totalRounds: 0,
  };
}

/**
 * Apply one AgentEvent to the state, mutating it in place. Returns the same
 * state object for chaining / readability. Kept pure (no I/O, no date) so
 * tests can feed synthetic event sequences.
 */
export function applyEvent(state: ReviewStreamState, event: AgentEvent): ReviewStreamState {
  switch (event.type) {
    case "round-started": {
      state.currentPersona = event.persona;
      state.lastRound = event.round;
      // If this is a drafter round (anything except judge), the previously
      // accumulated drafter output is now stale — a new draft is starting.
      // Same logic for the judge: each judge round's rationale replaces
      // the last, so we see the MOST RECENT critique in the final state.
      if (event.persona === "judge") {
        state.activeJudgeOutput = "";
      } else {
        state.activeDrafterOutput = "";
      }
      break;
    }
    case "text-delta": {
      // Drafter text goes to the deliverable. Judge text goes to the
      // rationale pane (surfaced when the matter lands at needs-revision
      // or blocked so a compliance lawyer can read WHY the judge rejected).
      if (state.currentPersona === "judge") {
        state.activeJudgeOutput += event.delta;
      } else {
        state.activeDrafterOutput += event.delta;
      }
      break;
    }
    case "verdict-final": {
      state.lastVerdict = event.verdict;
      break;
    }
    case "loop-done": {
      state.totalRounds = event.totalRounds;
      if (event.finalVerdict) state.lastVerdict = event.finalVerdict;
      break;
    }
    // Other events (persona-selected, done, error, prose-final, citations)
    // don't mutate state here — they're pass-through for streaming.
    default:
      break;
  }
  return state;
}

/**
 * After the loop exits, derive the clean prose + structured citations from
 * the drafter's final round output. The model emits a fenced ```citations
 * block at the end; parseModelOutput strips it and returns both halves.
 *
 * The returned prose is what goes into the audit trail's outputContent, into
 * evidence extraction, and (replayed via the prose-final SSE event) into the
 * UI's output pane. The citations array is what the UI shows as footnotes
 * and what the DOCX export includes as exhibits.
 */
export function finalizeReview(state: ReviewStreamState): {
  prose: string;
  citations: Citation[];
  orphanedMarkers: string[];
  unusedCitations: string[];
} {
  return parseModelOutput(state.activeDrafterOutput);
}
