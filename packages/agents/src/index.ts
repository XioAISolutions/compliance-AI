/**
 * Public surface of @compliance-ai/agents.
 *
 * Two entry points for the API route / orchestrators:
 *   - `runAgent`     — single-shot streaming run (router picks persona).
 *   - `runAgentLoop` — drafter ↔ judge tight loop (cannibalized from ASI-Evolve).
 *
 * Plus the building blocks for callers who want to compose differently:
 *   - `routePersona`               — heuristic persona router.
 *   - `parseVerdict`               — judge-output parser (defensive).
 *   - `ucb1Pick`, `islandPick`     — sampling primitives for cognition stores.
 *   - `PERSONA_SYSTEM_PROMPTS`     — persona prompt registry.
 */

export * from "./types.js";
export { routePersona, type RoutingDecision } from "./router.js";
export {
  renderCognitionContext,
  resolveModelProvider,
  runAgent,
  type ModelProvider,
  type ModelProviderConfig,
  type ModelProviderEnv,
  type RunAgentOptions,
} from "./run.js";
export { runAgentLoop, type RunAgentLoopOptions } from "./loop.js";
export { PERSONA_SYSTEM_PROMPTS, PERSONA_LABELS, parseVerdict } from "./personas/index.js";
export { OM_REVIEWER_RETRIEVAL_PLAN } from "./personas/om-reviewer.js";
export { KYC_REVIEWER_RETRIEVAL_PLAN } from "./personas/kyc-reviewer.js";
export { MARKETING_REVIEWER_RETRIEVAL_PLAN } from "./personas/marketing-reviewer.js";
export { RESPONSE_MEMO_DRAFTER_RETRIEVAL_PLAN } from "./personas/response-memo-drafter.js";
export { COURT_AI_DISCLOSURE_DRAFTER_RETRIEVAL_PLAN } from "./personas/court-ai-disclosure-drafter.js";
export {
  getRetrievalPlan,
  listPlanTaskTypes,
  type RetrievalPlanTaskType,
} from "./retrieval-plans.js";
export {
  parseModelOutput,
  validateCitations,
  CITATION_INSTRUCTION,
  type Citation,
  type ParsedOutput,
} from "./citations.js";
export {
  ucb1Score,
  ucb1Pick,
  islandPick,
  type SamplerCandidate,
  type UCB1Options,
  type IslandSamplerOptions,
} from "./sampler.js";
