/**
 * Matter risk queue — combines matter metadata + evidence counts into the
 * PrioritySignals the optimizer consumes, then applies UCB1 diversity from
 * @compliance-ai/agents so the queue isn't all OM reviews every day.
 */

import { islandPick, type SamplerCandidate } from "@compliance-ai/agents";
import { prioritize, type PrioritizedItem, type PrioritySignals, type EvidenceStatus, type RiskLevel } from "./optimizer.js";

export interface MatterSummary {
  id: string;
  title: string;
  taskType: string;
  status: string;
  jurisdiction: string;
  registrationCategory: string;
  /** Days since last activity on this matter (-1 if never touched). */
  lastActivityDaysAgo: number;
  /** Evidence items by status count. */
  evidenceCounts: Record<EvidenceStatus, number>;
  /** Number of times this matter has surfaced in a queue recommendation. */
  surfaceCount: number;
  /** Days until any regulatory deadline for this matter. */
  dueInDays?: number;
  /** Known regulator inquiry pending. */
  regulatorExposure?: boolean;
}

/**
 * Derive PrioritySignals from matter summary state.
 *
 * Risk level heuristic: open matters with missing evidence and old activity
 * are higher risk. Complete/approved matters are lower risk.
 */
export function signalsFromMatter(matter: MatterSummary): PrioritySignals {
  const riskLevel = deriveRiskLevel(matter);
  const evidenceStatus = worstEvidenceStatus(matter.evidenceCounts);
  return {
    riskLevel,
    evidenceStatus,
    dueInDays: matter.dueInDays ?? 30,
    regulatorExposure: matter.regulatorExposure ?? false,
    // Keep AI/personal-data flags out of matter-level scoring — they're
    // organization-level attributes, not per-matter. Layer 4 onboarding
    // captures these.
  };
}

function deriveRiskLevel(matter: MatterSummary): RiskLevel {
  if (matter.regulatorExposure) return "critical";
  if (matter.status === "complete" || matter.status === "archived") return "low";
  const missing = matter.evidenceCounts.missing ?? 0;
  const stale = matter.evidenceCounts.stale ?? 0;
  if (missing >= 5 || matter.lastActivityDaysAgo > 30) return "high";
  if (missing >= 2 || stale > 0) return "medium";
  return "low";
}

function worstEvidenceStatus(counts: Record<EvidenceStatus, number>): EvidenceStatus {
  if ((counts.missing ?? 0) > 0) return "missing";
  if ((counts.stale ?? 0) > 0) return "stale";
  if ((counts.requested ?? 0) > 0) return "requested";
  if ((counts.present ?? 0) > 0) return "present";
  return "approved";
}

export type QueueItem = PrioritizedItem<MatterSummary>;

/**
 * Build the prioritized queue with UCB1 island diversity. Partitions matters
 * by taskType so the queue includes a mix of OM/KYC/marketing/response rather
 * than stacking a single type.
 */
export function buildRiskQueue(
  matters: MatterSummary[],
  options: { topN?: number; diverseBy?: "taskType" | "jurisdiction" } = {},
): QueueItem[] {
  if (matters.length === 0) return [];

  const topN = options.topN ?? matters.length;
  const diverseBy = options.diverseBy ?? "taskType";

  // Step 1: classical priority scoring.
  const withSignals = matters.map((m) => ({ item: m, signals: signalsFromMatter(m) }));
  const prioritized = prioritize(withSignals);

  // Step 2: UCB1 diversity pass so the queue mixes task types.
  // Convert each prioritized matter into a SamplerCandidate — urgencyScore
  // comes from the optimizer's score; surfaceCount from matter metadata.
  const candidates: SamplerCandidate<QueueItem>[] = prioritized.map((q) => ({
    item: q,
    urgencyScore: q.score,
    surfaceCount: q.item.surfaceCount,
  }));

  // Deterministic random so the queue is stable across reloads for the same
  // matter set. Use a hash-based PRNG seeded from matter IDs.
  const seed = matters.map((m) => m.id).join("|");
  const rng = mulberry32(hashString(seed));

  return islandPick(candidates, topN, {
    islandOf: (q) => {
      const m = q.item;
      return diverseBy === "taskType" ? m.taskType : m.jurisdiction;
    },
    migrationRate: 0.2,
    random: rng,
  });
}

// --- Deterministic PRNG helpers -------------------------------------------
// mulberry32 is a 32-bit hash-seeded PRNG; stable across runs for same seed.

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
