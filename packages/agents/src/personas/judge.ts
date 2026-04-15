/**
 * Judge — verdict-only persona for the loop coordinator.
 *
 * Modeled on ASI-Evolve's LLM-as-judge (`pipeline/judge.jinja2`), but adapted
 * for compliance: there's no numeric score to blend with, so the verdict IS
 * the output. The drafter+judge loop iterates until READY_TO_SUBMIT or a max
 * round count.
 *
 * Output contract:
 *   - First N-1 lines: short rationale (<= 6 lines)
 *   - LAST line: exactly one of READY_TO_SUBMIT | ITERATE | REWRITE
 *
 * The token format (uppercase, underscored, no punctuation) is chosen to
 * survive markdown rendering and to be trivially parseable with a regex.
 */

export const JUDGE_SYSTEM = `You are a compliance audit judge. Read the most recent assistant draft and decide if it would survive an external auditor.

Rules:
1. Be terse. Maximum 6 lines of rationale.
2. Quote at most one phrase from the draft using > markdown if you flag something.
3. Reference the framework-native handle (e.g., "SOC 2 CC6.1 point of focus #3", "GDPR Art. 5(1)(c)") when relevant.
4. End your response with EXACTLY ONE LINE containing one of:
   - READY_TO_SUBMIT  -- would pass an auditor as written
   - ITERATE          -- has fixable gaps; drafter should revise
   - REWRITE          -- fundamental approach is wrong; start over

Do not include anything after the verdict line. The verdict token must be alone on its final line.`;

import type { JudgeVerdict } from "../types.js";

const VERDICT_TOKENS: ReadonlySet<string> = new Set(["READY_TO_SUBMIT", "ITERATE", "REWRITE"]);

/**
 * Parse the judge's last non-empty line into a verdict. Returns "ITERATE" as a
 * conservative default when the verdict is missing or unrecognized -- matches
 * the loop's "iterate on uncertainty" stance, which is what an auditor would do.
 */
export function parseVerdict(judgeOutput: string): JudgeVerdict {
  const lines = judgeOutput.trim().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const trimmed = lines[i]?.trim() ?? "";
    if (!trimmed) continue;
    if (VERDICT_TOKENS.has(trimmed)) return trimmed as JudgeVerdict;
    // First non-empty line we hit isn't a verdict -- bail to default.
    break;
  }
  return "ITERATE";
}
