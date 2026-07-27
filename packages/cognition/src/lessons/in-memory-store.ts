/**
 * In-memory implementation of LessonStore.
 *
 * Designed to be the prod default until a Postgres / pgvector backend
 * lands. The interface is identical, so swapping is a one-line edit.
 *
 * Embeddings are stored alongside lessons. Mismatched-dimension
 * embeddings (e.g., after a model swap) are silently skipped during
 * topK lookup so the sidecar still functions; the garden's "discover
 * relations" pass will eventually re-embed and reconcile.
 */

import { randomUUID } from "node:crypto";
import { cosineSimilarity } from "./embedding.js";
import type {
  Lesson,
  LessonRelation,
  LessonSource,
  LessonStatus,
  LessonStore,
} from "./types.js";

const MAX_SOURCES_PER_LESSON = 32;

export class InMemoryLessonStore implements LessonStore {
  private lessons = new Map<string, Lesson>();
  private relations: LessonRelation[] = [];

  async insert(input: Omit<Lesson, "id" | "createdAt" | "updatedAt">): Promise<Lesson> {
    const now = new Date();
    const lesson: Lesson = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      sources: input.sources.slice(-MAX_SOURCES_PER_LESSON),
      tags: [...new Set(input.tags)],
    };
    this.lessons.set(lesson.id, lesson);
    return lesson;
  }

  async get(id: string): Promise<Lesson | null> {
    return this.lessons.get(id) ?? null;
  }

  async getMany(ids: string[]): Promise<Lesson[]> {
    const out: Lesson[] = [];
    for (const id of ids) {
      const l = this.lessons.get(id);
      if (l) out.push(l);
    }
    return out;
  }

  async list(
    organizationId: string,
    opts?: { status?: LessonStatus | "all" },
  ): Promise<Lesson[]> {
    const status = opts?.status ?? "active";
    const out: Lesson[] = [];
    for (const l of this.lessons.values()) {
      if (l.organizationId !== organizationId) continue;
      if (status !== "all" && l.status !== status) continue;
      out.push(l);
    }
    return out;
  }

  async topKByEmbedding(
    organizationId: string,
    embedding: number[],
    k: number,
  ): Promise<Array<{ lesson: Lesson; similarity: number }>> {
    const scored: Array<{ lesson: Lesson; similarity: number }> = [];
    for (const l of this.lessons.values()) {
      if (l.organizationId !== organizationId) continue;
      if (l.status !== "active") continue;
      if (!l.embedding || l.embedding.length !== embedding.length) continue;
      const s = cosineSimilarity(embedding, l.embedding);
      scored.push({ lesson: l, similarity: s });
    }
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, Math.max(0, k));
  }

  async reinforce(id: string, source: LessonSource): Promise<Lesson> {
    const existing = this.lessons.get(id);
    if (!existing) throw new Error(`reinforce: lesson ${id} not found`);
    const sources = [...existing.sources, source].slice(-MAX_SOURCES_PER_LESSON);
    const updated: Lesson = {
      ...existing,
      weight: existing.weight + 1,
      sources,
      updatedAt: new Date(),
    };
    this.lessons.set(id, updated);
    return updated;
  }

  async reinforceWith(id: string, sources: LessonSource[], weightDelta: number): Promise<Lesson> {
    const existing = this.lessons.get(id);
    if (!existing) throw new Error(`reinforceWith: lesson ${id} not found`);
    const merged = [...existing.sources, ...sources].slice(-MAX_SOURCES_PER_LESSON);
    const updated: Lesson = {
      ...existing,
      weight: existing.weight + weightDelta,
      sources: merged,
      updatedAt: new Date(),
    };
    this.lessons.set(id, updated);
    return updated;
  }

  async markSuperseded(
    loserId: string,
    winnerId: string,
    reason: string,
  ): Promise<{ loser: Lesson; relation: LessonRelation }> {
    const loser = this.lessons.get(loserId);
    if (!loser) throw new Error(`markSuperseded: loser ${loserId} not found`);
    if (!this.lessons.has(winnerId))
      throw new Error(`markSuperseded: winner ${winnerId} not found`);
    const updated: Lesson = {
      ...loser,
      status: "superseded",
      supersededBy: winnerId,
      updatedAt: new Date(),
    };
    this.lessons.set(loserId, updated);
    const relation = await this.addRelation({
      fromLessonId: winnerId,
      toLessonId: loserId,
      type: "supersedes",
      reason,
    });
    return { loser: updated, relation };
  }

  async supersede(
    oldId: string,
    newLesson: Omit<Lesson, "id" | "createdAt" | "updatedAt">,
    reason: string,
  ): Promise<{ old: Lesson; new: Lesson; relation: LessonRelation }> {
    const old = this.lessons.get(oldId);
    if (!old) throw new Error(`supersede: lesson ${oldId} not found`);
    const inserted = await this.insert({ ...newLesson, supersedes: oldId });
    const oldUpdated: Lesson = {
      ...old,
      status: "superseded",
      supersededBy: inserted.id,
      updatedAt: new Date(),
    };
    this.lessons.set(oldId, oldUpdated);
    const relation = await this.addRelation({
      fromLessonId: inserted.id,
      toLessonId: oldId,
      type: "supersedes",
      reason,
    });
    return { old: oldUpdated, new: inserted, relation };
  }

  async addRelation(
    rel: Omit<LessonRelation, "id" | "createdAt">,
  ): Promise<LessonRelation> {
    const r: LessonRelation = {
      ...rel,
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.relations.push(r);
    return r;
  }

  async listRelations(lessonId: string): Promise<LessonRelation[]> {
    return this.relations.filter(
      (r) => r.fromLessonId === lessonId || r.toLessonId === lessonId,
    );
  }

  async remove(id: string): Promise<boolean> {
    return this.lessons.delete(id);
  }

  async size(): Promise<number> {
    return this.lessons.size;
  }
}
