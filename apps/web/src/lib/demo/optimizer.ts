import type { DemoControlFinding, DemoEvidenceStatus, DemoRiskLevel } from "./types";

const RISK_WEIGHT: Record<DemoRiskLevel, number> = {
  critical: 100,
  high: 75,
  medium: 45,
  low: 20,
};

const EVIDENCE_WEIGHT: Record<DemoEvidenceStatus, number> = {
  missing: 30,
  stale: 18,
  present: 6,
  approved: 0,
};

export interface PrioritySignals {
  riskLevel: DemoRiskLevel;
  evidenceStatus: DemoEvidenceStatus;
  dueInDays: number;
  aiExposure?: boolean;
  personalDataExposure?: boolean;
  regulatorExposure?: boolean;
}

/**
 * Classical optimizer used for the launch demo.
 *
 * This is intentionally deterministic and dependency-free. It is shaped as an
 * adapter seam so a future QPanda/OriginQ sidecar can optimize the same inputs
 * without changing the UI or control-finding contract.
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

export function prioritizeFindings(findings: DemoControlFinding[]): DemoControlFinding[] {
  return [...findings].sort((a, b) => b.priorityScore - a.priorityScore);
}

export const OPTIMIZER_NOTES = [
  "Demo uses deterministic classical scoring so it works anywhere.",
  "The scoring contract is compatible with a later QUBO/QAOA-style optimizer sidecar.",
  "QPanda/OriginQ should be added only as an optional optimizer service, not as the core LLM or product dependency.",
];
