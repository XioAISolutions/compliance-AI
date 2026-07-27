/**
 * Layer 1 — Sidecar consolidation.
 *
 * Runs on every lesson candidate (typically on CRUMB receive at the end
 * of an agent turn). Decides one of three actions and applies it to
 * the LessonStore:
 *
 *   - REINFORCE  existing lesson if a near-duplicate exists and the
 *                content agrees.
 *   - SUPERSEDE  the older lesson if a near-duplicate exists but the
 *                content contradicts (negation flip, threshold change).
 *                Marks the old lesson superseded, links via relation
 *                edge, inserts the new one with `supersedes` set.
 *   - INSERT     fresh lesson when no candidate clears the similarity
 *                threshold.
 *
 * Latency budget: < 200ms per call. Guarded with a soft deadline
 * (we still complete the write but emit a Metric warning when over).
 */

import type { Embedder } from "./embedding.js";
import type { LessonCandidate, LessonSource, LessonStore, Lesson } from "./types.js";
import { detectContradiction } from "./contradiction.js";
import type { MetricsRecorder } from "./metrics.js";

export type SidecarAction = "inserted" | "reinforced" | "superseded";

export interface SidecarResult {
  action: SidecarAction;
  lesson: Lesson;
  /** Lesson id that was matched, when action !== "inserted". */
  matched?: string;
  /** Cosine similarity that drove the decision, when action !== "inserted". */
  similarity?: number;
  durationMs: number;
}

export interface SidecarOptions {
  /**
   * Cosine similarity above which two lessons are considered the same
   * subject. 0.85 is conservative for the deterministic embedder; for
   * OpenAI text-embedding-3-small you'd typically dial this to ~0.78.
   */
  similarityThreshold?: number;
  /** topK candidates to inspect from the store. */
  topK?: number;
  /** Soft latency budget for one consolidate() call. */
  maxLatencyMs?: number;
  /** Optional metrics sink. */
  metrics?: MetricsRecorder;
}

export class CognitionSidecar {
  private readonly threshold: number;
  private readonly topK: number;
  private readonly maxLatencyMs: number;
  private readonly metrics?: MetricsRecorder;

  constructor(
    private readonly store: LessonStore,
    private readonly embedder: Embedder,
    options: SidecarOptions = {},
  ) {
    this.threshold = options.similarityThreshold ?? 0.85;
    this.topK = options.topK ?? 5;
    this.maxLatencyMs = options.maxLatencyMs ?? 200;
    this.metrics = options.metrics;
  }

  async consolidate(candidate: LessonCandidate): Promise<SidecarResult> {
    const startedAt = Date.now();
    const embedding = await this.embedder.embed(candidate.content);
    const matches = await this.store.topKByEmbedding(
      candidate.organizationId,
      embedding,
      this.topK,
    );

    const top = matches[0];

    if (top && top.similarity >= this.threshold) {
      const contradiction = detectContradiction(top.lesson.content, candidate.content);
      if (contradiction.contradicts) {
        const result = await this.applySupersede(top.lesson, candidate, embedding, contradiction.reason, top.similarity, startedAt);
        return result;
      }
      return this.applyReinforce(top.lesson, candidate.source, top.similarity, startedAt);
    }

    return this.applyInsert(candidate, embedding, startedAt);
  }

  private async applyInsert(
    candidate: LessonCandidate,
    embedding: number[],
    startedAt: number,
  ): Promise<SidecarResult> {
    const inserted = await this.store.insert({
      organizationId: candidate.organizationId,
      content: candidate.content,
      embedding,
      weight: 1,
      sources: [candidate.source],
      tags: candidate.tags ?? [],
      ...(candidate.framework !== undefined ? { framework: candidate.framework } : {}),
      ...(candidate.controlSlug !== undefined ? { controlSlug: candidate.controlSlug } : {}),
      ...(candidate.jurisdiction !== undefined ? { jurisdiction: candidate.jurisdiction } : {}),
      status: "active",
    });
    const durationMs = Date.now() - startedAt;
    this.metrics?.recordSidecar({ action: "inserted", durationMs });
    if (durationMs > this.maxLatencyMs) {
      this.metrics?.recordSidecarSlow(durationMs);
    }
    return { action: "inserted", lesson: inserted, durationMs };
  }

  private async applyReinforce(
    existing: Lesson,
    source: LessonSource,
    similarity: number,
    startedAt: number,
  ): Promise<SidecarResult> {
    const updated = await this.store.reinforce(existing.id, source);
    const durationMs = Date.now() - startedAt;
    this.metrics?.recordSidecar({ action: "reinforced", durationMs });
    if (durationMs > this.maxLatencyMs) this.metrics?.recordSidecarSlow(durationMs);
    return {
      action: "reinforced",
      lesson: updated,
      matched: existing.id,
      similarity,
      durationMs,
    };
  }

  private async applySupersede(
    existing: Lesson,
    candidate: LessonCandidate,
    embedding: number[],
    reason: string,
    similarity: number,
    startedAt: number,
  ): Promise<SidecarResult> {
    const { new: inserted } = await this.store.supersede(
      existing.id,
      {
        organizationId: candidate.organizationId,
        content: candidate.content,
        embedding,
        weight: 1,
        sources: [candidate.source],
        tags: candidate.tags ?? [],
        ...(candidate.framework !== undefined ? { framework: candidate.framework } : {}),
        ...(candidate.controlSlug !== undefined ? { controlSlug: candidate.controlSlug } : {}),
        ...(candidate.jurisdiction !== undefined ? { jurisdiction: candidate.jurisdiction } : {}),
        status: "active",
      },
      reason,
    );
    const durationMs = Date.now() - startedAt;
    this.metrics?.recordSidecar({ action: "superseded", durationMs });
    if (durationMs > this.maxLatencyMs) this.metrics?.recordSidecarSlow(durationMs);
    return {
      action: "superseded",
      lesson: inserted,
      matched: existing.id,
      similarity,
      durationMs,
    };
  }
}
