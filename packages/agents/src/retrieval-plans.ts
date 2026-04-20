/**
 * Retrieval plan registry — taskType → multi-query plan.
 *
 * Each plan is a list of short, targeted BM25 queries, one per authority
 * cluster the corresponding persona's output structure cites. The review
 * coordinator runs the plan, unions + dedupes results by id, and passes
 * the merged authority deck to the persona.
 *
 * The plan dispatch is keyed on taskType, not persona id, because the
 * matter's `taskType` is what the API route already has in hand. Adding a
 * new task type means: write the persona prompt, write the plan, register
 * here. Personas without a registered plan fall back to the legacy
 * single-pass retrieval over document content.
 */

import { OM_REVIEWER_RETRIEVAL_PLAN } from "./personas/om-reviewer.js";
import { KYC_REVIEWER_RETRIEVAL_PLAN } from "./personas/kyc-reviewer.js";
import { MARKETING_REVIEWER_RETRIEVAL_PLAN } from "./personas/marketing-reviewer.js";
import { RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN } from "./personas/response-memo-drafter.js";
import { COURT_AI_DISCLOSURE_DRAFTER_RETRIEVAL_PLAN } from "./personas/court-ai-disclosure-drafter.js";

/**
 * Stable taskType identifiers used by /api/matters and the matter wizard.
 * Keep in sync with the TASK_TYPES array in apps/web/src/app/matters/new/page.tsx.
 */
export type RetrievalPlanTaskType =
  | "om-review"
  | "kyc-gap-check"
  | "marketing-signoff"
  | "response-memo"
  | "court-ai-disclosure";

const REGISTRY: Record<RetrievalPlanTaskType, readonly string[]> = {
  "om-review": OM_REVIEWER_RETRIEVAL_PLAN,
  "kyc-gap-check": KYC_REVIEWER_RETRIEVAL_PLAN,
  "marketing-signoff": MARKETING_REVIEWER_RETRIEVAL_PLAN,
  "response-memo": RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN,
  "court-ai-disclosure": COURT_AI_DISCLOSURE_DRAFTER_RETRIEVAL_PLAN,
};

/**
 * Look up the retrieval plan for a task type. Returns `null` for unknown or
 * unregistered task types — callers should fall back to legacy single-pass
 * retrieval when this returns null.
 */
export function getRetrievalPlan(taskType: string): readonly string[] | null {
  if (taskType in REGISTRY) {
    return REGISTRY[taskType as RetrievalPlanTaskType];
  }
  return null;
}

/**
 * All registered task types — useful for tests and debugging.
 */
export function listPlanTaskTypes(): RetrievalPlanTaskType[] {
  return Object.keys(REGISTRY) as RetrievalPlanTaskType[];
}
