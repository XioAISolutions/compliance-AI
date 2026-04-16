/**
 * Matter recommender — "what should I work on next?"
 *
 * Wires the UCB1 + island primitives from `@compliance-ai/agents` (which
 * were ported from ASI-Evolve) into the matter store. The output is a
 * ranked top-N with human-readable reasoning pills the UI surfaces.
 *
 * Urgency score (what UCB1 treats as exploitation value):
 *   +  0.0  baseline for any open matter
 *   +  0.4  if status is "in-review" (user has started but not finished)
 *   + 0.05/day since `updatedAt` (staleness)
 *   + 0.03/day since `createdAt` (age — weaker signal than staleness)
 *   +  0.2  if matter has uploaded documents but no transcript (user
 *            uploaded and walked away — a finishing nudge)
 *   +  0.3  if matter has a judge verdict of ITERATE or REWRITE (the
 *            judge said it's not done)
 *   -  1.0  if status is "complete" or "archived" — drops them out of the
 *            ranking entirely
 *
 * Surface counts are tracked in-process. Each recommend() increments the
 * counts for the matters it returns, so the ranking naturally drifts
 * away from already-surfaced matters and picks up never-seen ones on the
 * next call. Resets when the server restarts — acceptable for the
 * in-memory preview.
 *
 * Island sampling groups matters by `taskType` so one kind of task
 * doesn't dominate the top 5.
 */

import {
  ucb1Pick,
  islandPick,
  type SamplerCandidate,
} from "@compliance-ai/agents";
import type { Matter, TaskType } from "./matter-store";
import { getDefaultMatterStore } from "./matter-store";
import { getDefaultAuditStore } from "./audit-store";
import { getDefaultTranscriptStore } from "@compliance-ai/chat-structure";

const MS_PER_DAY = 86_400_000;

// Persistent-ish state inside the server process. Day 3+ migrates this
// into the db layer with a `matter_surfaces` table.
const surfaceCount = new Map<string, number>();

export function bumpSurface(matterId: string, by = 1): void {
  surfaceCount.set(matterId, (surfaceCount.get(matterId) ?? 0) + by);
}

export function getSurfaceCount(matterId: string): number {
  return surfaceCount.get(matterId) ?? 0;
}

/** Reset the surface counters — exposed for tests. */
export function resetRecommenderState(): void {
  surfaceCount.clear();
}

export interface MatterRecommendation {
  matter: Matter;
  urgencyScore: number;
  reasons: string[];
  surfaceCount: number;
  score: number;
}

export interface RecommendOptions {
  organizationId?: string;
  /** Top N. Default 5. */
  topK?: number;
  /** If true, use island sampling by taskType (default false). */
  balanceByTaskType?: boolean;
  /** Inject a random function (tests). */
  random?: () => number;
  /** If false, don't increment surface counters. Default true. */
  recordSurface?: boolean;
}

/** Compute the urgency score + reasons for a single matter. */
export function scoreMatter(
  matter: Matter,
  opts: {
    hasDocs: boolean;
    transcriptLength: number;
    lastJudgeVerdict?: string | null;
    now?: Date;
  },
): { urgencyScore: number; reasons: string[] } {
  if (matter.status === "complete" || matter.status === "archived") {
    return { urgencyScore: -1, reasons: ["status = " + matter.status] };
  }

  const now = opts.now ?? new Date();
  const reasons: string[] = [];
  let score = 0;

  if (matter.status === "in-review") {
    score += 0.4;
    reasons.push("in review");
  }

  const staleDays = Math.max(
    0,
    (now.getTime() - new Date(matter.updatedAt).getTime()) / MS_PER_DAY,
  );
  if (staleDays >= 1) {
    const bonus = Math.min(0.5, staleDays * 0.05);
    score += bonus;
    reasons.push(`${Math.floor(staleDays)}d since update`);
  }

  const ageDays = Math.max(
    0,
    (now.getTime() - new Date(matter.createdAt).getTime()) / MS_PER_DAY,
  );
  if (ageDays >= 7) {
    const bonus = Math.min(0.3, ageDays * 0.03);
    score += bonus;
    reasons.push(`${Math.floor(ageDays)}d old`);
  }

  if (opts.hasDocs && opts.transcriptLength === 0) {
    score += 0.2;
    reasons.push("docs uploaded, no review yet");
  }

  if (opts.lastJudgeVerdict === "ITERATE" || opts.lastJudgeVerdict === "REWRITE") {
    score += 0.3;
    reasons.push(`judge said ${opts.lastJudgeVerdict}`);
  }

  if (reasons.length === 0) reasons.push("open matter");

  return { urgencyScore: score, reasons };
}

/**
 * Produce the top-N matter recommendations. The caller decides whether
 * to record the surface (UI vs. analytics-preview requests).
 */
export function recommendMatters(options: RecommendOptions = {}): MatterRecommendation[] {
  const organizationId = options.organizationId ?? "preview";
  const topK = options.topK ?? 5;
  const recordSurface = options.recordSurface ?? true;

  const matterStore = getDefaultMatterStore();
  const auditStore = getDefaultAuditStore();
  const transcriptStore = getDefaultTranscriptStore();
  const now = new Date();

  const candidates: Array<
    SamplerCandidate<Matter> & { reasons: string[]; _score: number }
  > = [];

  for (const matter of matterStore.list(organizationId)) {
    if (matter.status === "complete" || matter.status === "archived") continue;
    const docs = matterStore.getDocuments(matter.id);
    const transcriptTurns = transcriptStore.getByMatter(matter.id);
    const auditRows = auditStore.getByMatter(matter.id);
    const lastVerdict = [...auditRows]
      .reverse()
      .find((r) => r.judgeVerdict)?.judgeVerdict;
    const { urgencyScore, reasons } = scoreMatter(matter, {
      hasDocs: docs.length > 0,
      transcriptLength: transcriptTurns.length,
      lastJudgeVerdict: lastVerdict,
      now,
    });
    candidates.push({
      item: matter,
      urgencyScore,
      surfaceCount: getSurfaceCount(matter.id),
      reasons,
      _score: urgencyScore,
    });
  }

  if (candidates.length === 0) return [];

  // Rank via UCB1, optionally through the island sampler.
  const ranked = options.balanceByTaskType
    ? islandPick<Matter>(candidates, topK, {
        islandOf: (m) => m.taskType as TaskType,
        random: options.random,
      })
    : ucb1Pick<Matter>(candidates, topK);

  const byId = new Map(candidates.map((c) => [c.item.id, c]));
  const picked: MatterRecommendation[] = [];
  for (const m of ranked) {
    const c = byId.get(m.id);
    if (!c) continue;
    picked.push({
      matter: c.item,
      urgencyScore: c.urgencyScore,
      reasons: c.reasons,
      surfaceCount: c.surfaceCount,
      score: c.urgencyScore,
    });
    if (recordSurface) bumpSurface(m.id);
  }
  return picked;
}
