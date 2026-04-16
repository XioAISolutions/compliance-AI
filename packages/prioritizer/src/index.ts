/**
 * @compliance-ai/prioritizer — matter priority scoring + UCB1 diversity queue.
 *
 * Two entry points:
 *   - `calculatePriorityScore` / `prioritize` — classical deterministic
 *     scoring (risk × evidence gap × deadline × exposure).
 *   - `buildRiskQueue` — applies the scorer across matters and adds a UCB1
 *     diversity pass so the queue isn't all one task type.
 *
 * Designed so a quantum optimizer sidecar (QPanda / OriginQ QUBO) can
 * replace `calculatePriorityScore` without touching callers.
 */

export {
  calculatePriorityScore,
  prioritize,
  OPTIMIZER_NOTES,
  type PrioritySignals,
  type PrioritizedItem,
  type RiskLevel,
  type EvidenceStatus,
} from "./optimizer.js";

export {
  buildRiskQueue,
  signalsFromMatter,
  type MatterSummary,
  type QueueItem,
} from "./risk-queue.js";
