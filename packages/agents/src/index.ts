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
export { runAgent, type RunAgentOptions } from "./run.js";
export { runAgentLoop, type RunAgentLoopOptions } from "./loop.js";
export { PERSONA_SYSTEM_PROMPTS, PERSONA_LABELS, parseVerdict } from "./personas/index.js";
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
