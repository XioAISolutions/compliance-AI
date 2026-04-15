/**
 * In-memory cognition store — DEV / TEST ONLY.
 *
 * Why not real semantic search here: the prod backend is Postgres + pgvector
 * (Day 3+), which gives us multi-tenancy, RLS, and durable storage for free.
 * For local dev and unit tests we want a zero-dependency stub. We compute a
 * crude lexical-overlap score (Jaccard over normalized tokens) — good enough
 * for tests of the *interface*, intentionally NOT good enough that anyone
 * mistakes it for a production retrieval system.
 *
 * The deliberately-bad scoring is a feature: if a test passes against this
 * backend it must be testing the contract, not the embedding quality.
 */

import { randomUUID } from "node:crypto";
import type { CognitionItem, CognitionStore, RetrievalQuery, RetrievalResult } from "./types.js";

const tokenize = (text: string): Set<string> =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

export class InMemoryCognitionStore implements CognitionStore {
  private items = new Map<string, CognitionItem>();

  async add(item: CognitionItem): Promise<string> {
    const id = item.id ?? randomUUID();
    this.items.set(id, { ...item, id, createdAt: item.createdAt ?? new Date() });
    return id;
  }

  async addBatch(items: CognitionItem[]): Promise<string[]> {
    return Promise.all(items.map((item) => this.add(item)));
  }

  async remove(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async get(id: string): Promise<CognitionItem | null> {
    return this.items.get(id) ?? null;
  }

  async getAll(): Promise<CognitionItem[]> {
    return Array.from(this.items.values());
  }

  async retrieve(query: RetrievalQuery): Promise<RetrievalResult[]> {
    const queryTokens = tokenize(query.query);
    const topK = query.topK ?? 3;
    const threshold = query.scoreThreshold ?? 0.05;

    const scored: RetrievalResult[] = [];
    for (const item of this.items.values()) {
      if (query.organizationId && item.organizationId !== query.organizationId) continue;
      if (query.framework && item.framework !== query.framework) continue;
      if (query.controlSlug && item.controlSlug !== query.controlSlug) continue;

      const itemTokens = tokenize(`${item.title} ${item.content}`);
      const score = jaccard(queryTokens, itemTokens);
      if (score >= threshold) scored.push({ item, score });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async reset(): Promise<void> {
    this.items.clear();
  }

  async size(): Promise<number> {
    return this.items.size;
  }
}
