/**
 * Classical priority optimizer.
 *
 * Intentionally deterministic and dependency-free. Lifted from the demo layer
 * and generalized: same scoring contract, now applicable to matters + evidence
 * signals instead of framework controls.
 *
 * This is the seam for a future QPanda/OriginQ QUBO/QAOA sidecar — the
 * optimizer should stay a pure function so the quantum backend can be
 * swapped in without touching any caller.
 */

export type RiskLevel = "critical" | "high" | "medium" | "low";
export type EvidenceStatus = "missing" | "requested" | "stale" | "present" | "approved";

const RISK_WEIGHT: Record<RiskLevel, number> = {
  critical: 100,
  high: 75,
  medium: 45,
  low: 20,
};

const EVIDENCE_WEIGHT: Record<EvidenceStatus, number> = {
  missing: 30,
  requested: 20,
  stale: 18,
  present: 6,
  approved: 0,
};

export interface PrioritySignals {
  /** Overall risk of the matter's current deliverable. */
  riskLevel: RiskLevel;
  /** Worst evidence status across the matter's evidence items. */
  evidenceStatus: EvidenceStatus;
  /** Days until target deadline (30+ collapses to low pressure). */
  dueInDays: number;
  /** Client uses AI → regulatory exposure under EU AI Act + OSC AI guidance. */
  aiExposure?: boolean;
  /** Client processes personal data → GDPR / PIPEDA exposure. */
  personalDataExposure?: boolean;
  /** Known regulator attention (pending exam, deficiency letter). */
  regulatorExposure?: boolean;
}

/**
 * Compute the priority score. Higher = more deserving of attention today.
 *
 * Score = risk + evidence gap + deadline pressure + exposure multipliers.
 * Max possible is ~200 (critical risk + missing evidence + imminent deadline
 * + all exposure flags).
 */
export function calculatePriorityScore(signals: PrioritySignals): number {
  const deadlinePressure = Math.max(0, 30 - Math.min(signals.dueInDays, 30));
  const exposure =
    (signals.aiExposure ? 12 : 0) +
    (signals.personalDataExposure ? 10 : 0) +
    (signals.regulatorExposure ? 14 : 0);

  return Math.round(
    RISK_WEIGHT[signals.riskLevel] +
      EVIDENCE_WEIGHT[signals.evidenceStatus] +
      deadlinePressure +
      exposure,
  );
}

export interface PrioritizedItem<T> {
  item: T;
  score: number;
  signals: PrioritySignals;
}

/**
 * Rank items by priority score. Stable on ties — preserves input order for
 * deterministic results across reloads.
 */
export function prioritize<T>(
  items: Array<{ item: T; signals: PrioritySignals }>,
): PrioritizedItem<T>[] {
  return items
    .map(({ item, signals }, idx) => ({
      item,
      signals,
      score: calculatePriorityScore(signals),
      idx,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.idx - b.idx;
    })
    .map(({ item, signals, score }) => ({ item, signals, score }));
}

export const OPTIMIZER_NOTES = [
  "Deterministic classical scoring — reproducible, no infra required.",
  "Compatible with a QUBO/QAOA-style optimizer sidecar; same inputs, same outputs.",
  "Prefer to leave quantum optimization as an opt-in sidecar, not a core dependency.",
];
