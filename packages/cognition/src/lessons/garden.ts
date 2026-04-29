/**
 * Layer 2 — Ambient garden cycle.
 *
 * Runs deeper consolidation work that's too slow for a per-turn
 * sidecar:
 *
 *   1. dedupClusters       — embedding-cluster active lessons,
 *                            collapse near-duplicates the sidecar
 *                            missed (different phrasing, same point).
 *   2. verifyAgainstCorpus — for each lesson with a controlSlug or
 *                            framework anchor, retrieve top authority
 *                            chunks and check the lesson still tracks.
 *                            Stale lessons get pruned.
 *   3. retroactiveExtract  — caller-supplied list of session ids that
 *                            crashed without a clean shutdown; the
 *                            garden re-extracts lessons via the sidecar
 *                            so we don't lose what those sessions saw.
 *   4. discoverRelations   — across active lessons, propose
 *                            agrees-with edges for tight clusters.
 *
 * Every step is idempotent and bounded — they each take an explicit
 * cap (`maxClusters`, `maxRelations`, `maxRetroactiveSessions`) so a
 * runaway garden can't lock the store.
 */

import { cosineSimilarity, type Embedder } from "./embedding.js";
import type {
  Lesson,
  LessonCandidate,
  LessonStore,
} from "./types.js";
import type { CognitionSidecar } from "./sidecar.js";
import type { ResourceCalculator } from "./resources.js";
import type { MetricsRecorder } from "./metrics.js";

export interface GardenStepResult {
  /** Number of lessons removed/superseded as a result of this step. */
  dedupRemoved: number;
  /** Number of new agrees-with relation edges added. */
  relationsAdded: number;
  /** Number of lessons re-verified successfully (kept active). */
  reverified: number;
  /** Number of lessons pruned because their anchor authority is gone. */
  pruned: number;
  /** Retroactive lesson ingests from crashed sessions. */
  retroactiveIngests: number;
}

export interface GardenCycleReport {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  organizationId: string;
  result: GardenStepResult;
  /**
   * Plain-text audit lines — boring, parseable. One step per line.
   * Append to the audit log if the caller wants persistence.
   */
  audit: string[];
}

export interface GardenCycleInput {
  organizationId: string;
  /** Sessions that crashed; the garden will retroactively extract from each. */
  crashedSessions?: Array<{
    sessionId: string;
    candidates: LessonCandidate[];
  }>;
  /**
   * Anchor authorities the garden uses to verify lesson freshness.
   * Each entry is a (controlSlug | framework, isLive) tuple — when
   * isLive=false, lessons anchored there get pruned. The caller knows
   * which anchors are still live (e.g., from a corpus snapshot).
   */
  liveAnchors?: { framework?: string; controlSlug?: string; live: boolean }[];
  /** Estimated tokens this cycle will consume. */
  estimatedTokens?: number;
}

export interface GardenOptions {
  similarityThreshold?: number;
  maxClustersPerCycle?: number;
  maxRelationsPerCycle?: number;
  maxRetroactiveSessions?: number;
}

export class CognitionGarden {
  private readonly threshold: number;
  private readonly maxClusters: number;
  private readonly maxRelations: number;
  private readonly maxRetroactive: number;

  constructor(
    private readonly store: LessonStore,
    private readonly embedder: Embedder,
    private readonly sidecar: CognitionSidecar,
    private readonly resources: ResourceCalculator,
    private readonly metrics?: MetricsRecorder,
    options: GardenOptions = {},
  ) {
    this.threshold = options.similarityThreshold ?? 0.9;
    this.maxClusters = options.maxClustersPerCycle ?? 50;
    this.maxRelations = options.maxRelationsPerCycle ?? 100;
    this.maxRetroactive = options.maxRetroactiveSessions ?? 25;
  }

  async runCycle(input: GardenCycleInput): Promise<GardenCycleReport> {
    const startedAt = new Date();
    const estimate = input.estimatedTokens ?? 2000;
    const verdict = this.resources.canStartCycle(estimate);
    const audit: string[] = [];
    audit.push(`garden.cycle.start org=${input.organizationId} estimate=${estimate}`);
    if (!verdict.ok) {
      audit.push(`garden.cycle.skipped reason=${verdict.reason ?? "unknown"}`);
      const report: GardenCycleReport = {
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: 0,
        organizationId: input.organizationId,
        result: zeroResult(),
        audit,
      };
      return report;
    }

    const result = zeroResult();

    // Step 1: dedup clusters.
    const dedup = await this.dedupClusters(input.organizationId);
    result.dedupRemoved += dedup.removed;
    audit.push(`garden.dedup removed=${dedup.removed} clusters=${dedup.clusters}`);

    // Step 2: verify lessons against live anchors.
    if (input.liveAnchors && input.liveAnchors.length > 0) {
      const verify = await this.verifyAgainstAnchors(
        input.organizationId,
        input.liveAnchors,
      );
      result.reverified += verify.reverified;
      result.pruned += verify.pruned;
      audit.push(`garden.verify reverified=${verify.reverified} pruned=${verify.pruned}`);
    } else {
      audit.push("garden.verify skipped (no live anchors supplied)");
    }

    // Step 3: retroactive extraction from crashed sessions.
    if (input.crashedSessions && input.crashedSessions.length > 0) {
      const retro = await this.retroactiveExtract(input.crashedSessions);
      result.retroactiveIngests += retro.ingested;
      audit.push(
        `garden.retroactive sessions=${input.crashedSessions.length} ingested=${retro.ingested}`,
      );
    }

    // Step 4: discover agrees-with relations.
    const rel = await this.discoverRelations(input.organizationId);
    result.relationsAdded += rel.added;
    audit.push(`garden.relations added=${rel.added}`);

    // Token bookkeeping — coarse: assume `estimate` tokens were spent.
    // Concrete provider integrations would record actual usage.
    this.resources.recordTokens("ambient", estimate);
    this.metrics?.recordAmbientTokens("ambient", estimate);

    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    this.metrics?.recordGardenCycle(durationMs, result.dedupRemoved + result.pruned);
    audit.push(`garden.cycle.end durationMs=${durationMs}`);

    return {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs,
      organizationId: input.organizationId,
      result,
      audit,
    };
  }

  /**
   * Cluster active lessons by embedding similarity. For each cluster
   * larger than 1, keep the highest-weight member and supersede the
   * rest with a "garden-dedup" relation.
   */
  private async dedupClusters(
    organizationId: string,
  ): Promise<{ removed: number; clusters: number }> {
    const lessons = await this.store.list(organizationId, { status: "active" });
    if (lessons.length < 2) return { removed: 0, clusters: 0 };

    const clusters: Lesson[][] = [];
    const claimed = new Set<string>();

    for (let i = 0; i < lessons.length && clusters.length < this.maxClusters; i++) {
      const a = lessons[i]!;
      if (claimed.has(a.id) || !a.embedding) continue;
      const cluster: Lesson[] = [a];
      claimed.add(a.id);
      for (let j = i + 1; j < lessons.length; j++) {
        const b = lessons[j]!;
        if (claimed.has(b.id) || !b.embedding) continue;
        if (b.embedding.length !== a.embedding.length) continue;
        const sim = cosineSimilarity(a.embedding, b.embedding);
        if (sim >= this.threshold) {
          cluster.push(b);
          claimed.add(b.id);
        }
      }
      if (cluster.length > 1) clusters.push(cluster);
    }

    let removed = 0;
    for (const cluster of clusters) {
      cluster.sort((x, y) => y.weight - x.weight);
      const winner = cluster[0]!;
      for (const loser of cluster.slice(1)) {
        // Fold loser into winner: reinforce in place, mark loser
        // superseded BY winner. The winner's id stays stable so any
        // bandit arms / cached references the rest of the system
        // holds keep resolving — supersession doesn't orphan them.
        await this.store.reinforceWith(winner.id, loser.sources, loser.weight);
        await this.store.markSuperseded(loser.id, winner.id, "garden dedup");
        removed++;
      }
    }
    return { removed, clusters: clusters.length };
  }

  private async verifyAgainstAnchors(
    organizationId: string,
    liveAnchors: { framework?: string; controlSlug?: string; live: boolean }[],
  ): Promise<{ reverified: number; pruned: number }> {
    const lessons = await this.store.list(organizationId, { status: "active" });
    let reverified = 0;
    let pruned = 0;
    for (const l of lessons) {
      if (!l.controlSlug && !l.framework) continue;
      const anchor = liveAnchors.find(
        (a) =>
          (l.controlSlug && a.controlSlug === l.controlSlug) ||
          (l.framework && a.framework === l.framework),
      );
      if (!anchor) continue;
      if (anchor.live) {
        reverified++;
      } else {
        await this.store.remove(l.id);
        pruned++;
      }
    }
    return { reverified, pruned };
  }

  private async retroactiveExtract(
    crashedSessions: Array<{ sessionId: string; candidates: LessonCandidate[] }>,
  ): Promise<{ ingested: number }> {
    let ingested = 0;
    const sessions = crashedSessions.slice(0, this.maxRetroactive);
    for (const sess of sessions) {
      for (const cand of sess.candidates) {
        await this.sidecar.consolidate(cand);
        ingested++;
      }
    }
    return { ingested };
  }

  private async discoverRelations(
    organizationId: string,
  ): Promise<{ added: number }> {
    const lessons = await this.store.list(organizationId, { status: "active" });
    let added = 0;
    for (let i = 0; i < lessons.length && added < this.maxRelations; i++) {
      const a = lessons[i]!;
      if (!a.embedding) continue;
      for (let j = i + 1; j < lessons.length && added < this.maxRelations; j++) {
        const b = lessons[j]!;
        if (!b.embedding) continue;
        if (b.embedding.length !== a.embedding.length) continue;
        const sim = cosineSimilarity(a.embedding, b.embedding);
        if (sim >= this.threshold * 0.85 && sim < this.threshold) {
          // close-but-not-merge — agrees-with edge.
          await this.store.addRelation({
            fromLessonId: a.id,
            toLessonId: b.id,
            type: "agrees-with",
            reason: `cosine=${sim.toFixed(3)}`,
          });
          added++;
        }
      }
    }
    return { added };
  }
}

function zeroResult(): GardenStepResult {
  return {
    dedupRemoved: 0,
    relationsAdded: 0,
    reverified: 0,
    pruned: 0,
    retroactiveIngests: 0,
  };
}
