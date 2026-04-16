/**
 * Drafter ↔ Judge loop coordinator.
 *
 * Cannibalized from ASI-Evolve's `pipeline/evolve.py` Researcher→Engineer→Analyzer
 * loop, simplified to a two-role tight loop: the drafter produces, the judge
 * verdicts, and the drafter revises until the judge says READY_TO_SUBMIT or we
 * hit `maxRounds`. The same `AgentEvent` stream shape as `runAgent()` plus
 * three loop-specific events: `round-started`, `verdict-final`, `loop-done`.
 *
 * Why a tight loop instead of n-persona orchestration:
 *   - Compliance drafts are short. Token budget is not the binding constraint;
 *     auditor-survivability is.
 *   - The judge's verdict is binary-ish (3-state). That's enough signal to
 *     either ship, revise, or restart — no need for a separate analyzer step.
 *   - We can layer reviewer/risk-assessor in later as named "review modes"
 *     without changing this file's shape.
 *
 * State ownership: the loop owns the `AgentMessage[]` history. Each call to
 * `runAgent` is stateless — it sees the full history we hand it. This keeps
 * the lower-level runner trivially testable.
 *
 * Verdict feedback loop:
 *   - ITERATE  → next user message includes the judge's critique and asks for
 *                a focused revision. Prior draft stays in history.
 *   - REWRITE  → next user message asks for a fresh approach but keeps the
 *                prior attempt visible (so the drafter avoids the same trap).
 *   - READY    → loop terminates immediately.
 *
 * Error handling: if either persona errors mid-stream, the underlying
 * `runAgent` yields an `error` event. We forward it and terminate the loop
 * with `loop-done` so the UI can close the bubble cleanly.
 */

import { runAgent } from "./run.js";
import { parseVerdict } from "./personas/judge.js";
import type { AgentContext, AgentEvent, AgentMessage, JudgeVerdict, PersonaId } from "./types.js";

export interface RunAgentLoopOptions {
  /**
   * Maximum number of (drafter+judge) rounds. Default 4: empirically enough
   * for the judge to extract most fixable gaps; beyond that we tend to see
   * either convergence or a fundamental REWRITE.
   */
  maxRounds?: number;
  /** Override default model id (passed through to runAgent). */
  model?: string;
  /** Override max output tokens (passed through to runAgent). */
  maxTokens?: number;
  /**
   * Which persona takes the "drafter" slot in the loop. Defaults to
   * "drafter" for backwards compatibility, but callers running specialized
   * task reviews (OM, KYC, marketing, response memo) should pass the
   * corresponding persona so the judge audits THEIR output.
   */
  drafterPersona?: PersonaId;
}

/**
 * Drafter ↔ Judge loop. Yields the same event union as `runAgent` plus the
 * three loop-specific events declared in `types.ts`.
 *
 * Termination conditions (in order of precedence):
 *   1. Judge emits READY_TO_SUBMIT.
 *   2. A persona errors (we forward the `error` event then `loop-done`).
 *   3. `maxRounds` reached without READY_TO_SUBMIT — `loop-done` carries the
 *      last verdict so the UI can show the most recent state.
 */
export async function* runAgentLoop(
  context: AgentContext,
  initialUserMessage: string,
  options: RunAgentLoopOptions = {},
): AsyncGenerator<AgentEvent> {
  const maxRounds = options.maxRounds ?? 4;
  const drafterPersona: PersonaId = options.drafterPersona ?? "drafter";

  const history: AgentMessage[] = [];
  let pendingUserMessage = initialUserMessage;
  let lastVerdict: JudgeVerdict | null = null;
  let round = 0;

  while (round < maxRounds) {
    round++;

    // -------- DRAFTER round --------
    yield { type: "round-started", round, persona: drafterPersona };
    let draftBuffer = "";
    let drafterErrored = false;
    for await (const ev of runAgent(context, history, pendingUserMessage, {
      forcePersona: drafterPersona,
      model: options.model,
      maxTokens: options.maxTokens,
    })) {
      if (ev.type === "text-delta") draftBuffer += ev.delta;
      if (ev.type === "error") drafterErrored = true;
      yield ev;
    }
    if (drafterErrored) {
      yield { type: "loop-done", totalRounds: round, finalVerdict: lastVerdict };
      return;
    }

    // Persist the just-completed exchange so the judge — and the next drafter
    // round — see the prior draft.
    history.push({ role: "user", content: pendingUserMessage });
    history.push({ role: "assistant", content: draftBuffer });

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

    // Persist the judge turn so subsequent drafter rounds see what was flagged
    // (the judge prompt and verdict are now part of the conversational record).
    history.push({ role: "user", content: judgePrompt });
    history.push({ role: "assistant", content: judgeBuffer });

    // Build the next drafter prompt from the verdict.
    pendingUserMessage =
      verdict === "ITERATE"
        ? `The compliance audit judge raised the following concerns about your draft:\n\n${judgeBuffer}\n\nRevise the draft to address each point. Preserve what's working; fix only what's flagged. Output the full revised draft, not just the diff.`
        : // REWRITE
          `The compliance audit judge concluded the fundamental approach is wrong:\n\n${judgeBuffer}\n\nStart over with a different approach. Do not iterate on the prior draft. Output the full new draft.`;
  }

  // Hit the round cap without READY_TO_SUBMIT. Surface the last verdict so the
  // UI can decide whether to show the latest draft as "best effort" or to
  // prompt the user to extend the loop.
  yield { type: "loop-done", totalRounds: round, finalVerdict: lastVerdict };
}
