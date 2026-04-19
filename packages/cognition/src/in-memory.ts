/**
 * In-memory cognition store — DEV / TEST ONLY.
 *
 * Scoring modes:
 *   - "hybrid"  (default) — BM25 ranks + (reserved semantic rank slot) combined
 *                           via reciprocal-rank-fusion. Matches GitNexus's
 *                           hybrid search design; semantic is a no-op today
 *                           and wakes up when pgvector + embeddings land.
 *   - "bm25"             — classic BM25 over tokenized content.
 *   - "jaccard"          — lexical overlap; kept for back-compat + tests.
 *
 * BM25 parameters follow Robertson/Zaragoza defaults (k1=1.5, b=0.75). The
 * IDF uses the Okapi formulation with a +1 inside the log, so scores stay
 * positive for terms that appear in every doc (the classic BM25 can go
 * negative for those; we want bounded non-negative scores).
 *
 * Cannibalized from GitNexus's `Hybrid search layer` (BM25 + semantic + RRF).
 * The BM25 implementation is a clean-room TS port — no external BM25 lib.
 */

import { randomUUID } from "node:crypto";
import type { CognitionItem, CognitionStore, RetrievalQuery, RetrievalResult } from "./types.js";

// ---------------------------------------------------------------------------
// Tokenization
// ---------------------------------------------------------------------------

const MIN_TOKEN_LEN = 2;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > MIN_TOKEN_LEN);
}

function tokenSet(text: string): Set<string> {
  return new Set(tokenize(text));
}

// ---------------------------------------------------------------------------
// Jaccard (fallback / back-compat)
// ---------------------------------------------------------------------------

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// ---------------------------------------------------------------------------
// BM25
// ---------------------------------------------------------------------------

const BM25_K1 = 1.5;
const BM25_B = 0.75;

interface BM25Doc {
  id: string;
  tokens: string[];
  length: number;
  tf: Map<string, number>;
}

interface BM25Index {
  docs: BM25Doc[];
  avgLen: number;
  /** document frequency: term → count of docs containing the term */
  df: Map<string, number>;
  n: number;
}

function buildBM25Index(items: { id: string; text: string }[]): BM25Index {
  const docs: BM25Doc[] = items.map((it) => {
    const tokens = tokenize(it.text);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { id: it.id, tokens, length: tokens.length, tf };
  });
  const n = docs.length;
  const avgLen = n > 0 ? docs.reduce((s, d) => s + d.length, 0) / n : 0;
  const df = new Map<string, number>();
  for (const d of docs) {
    for (const t of new Set(d.tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return { docs, avgLen, df, n };
}

function bm25Score(query: string[], doc: BM25Doc, index: BM25Index): number {
  if (index.n === 0 || doc.length === 0 || index.avgLen === 0) return 0;
  let score = 0;
  for (const term of query) {
    const dfT = index.df.get(term) ?? 0;
    if (dfT === 0) continue;
    // Okapi IDF with +1 guard — keeps scores ≥ 0.
    const idf = Math.log(1 + (index.n - dfT + 0.5) / (dfT + 0.5));
    const tf = doc.tf.get(term) ?? 0;
    const normLen = doc.length / index.avgLen;
    const numerator = tf * (BM25_K1 + 1);
    const denominator = tf + BM25_K1 * (1 - BM25_B + BM25_B * normLen);
    score += idf * (numerator / denominator);
  }
  return score;
}

/** Normalize scores to [0,1] by dividing by the max. Useful for ranking
 *  comparison across documents, and for stable score_threshold semantics. */
function normalizeScores(scored: { id: string; score: number }[]): void {
  const max = scored.reduce((m, s) => Math.max(m, s.score), 0);
  if (max <= 0) return;
  for (const s of scored) s.score = s.score / max;
}

// ---------------------------------------------------------------------------
// Reciprocal-rank fusion
// ---------------------------------------------------------------------------

const RRF_K = 60;

/**
 * Reciprocal-rank fusion over two rankings. Exported so callers that run
 * multiple independent retrievals (e.g. /api/ask doing per-jurisdiction
 * retrieval) can merge them with the same fusion weight (RRF_K = 60) that
 * the in-memory store uses internally. Each ranking is `{ id, rank }` where
 * rank starts at 1 for the top hit.
 */
export function rrfFuse(
  rankingA: { id: string; rank: number }[],
  rankingB: { id: string; rank: number }[],
): Map<string, number> {
  const scores = new Map<string, number>();
  const add = (id: string, rank: number) => {
    scores.set(id, (scores.get(id) ?? 0) + 1 / (RRF_K + rank));
  };
  for (const r of rankingA) add(r.id, r.rank);
  for (const r of rankingB) add(r.id, r.rank);
  return scores;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

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
    const topK = query.topK ?? 3;
    const threshold = query.scoreThreshold ?? 0;
    const mode = query.searchMode ?? "hybrid";

    // Apply all non-lexical filters up-front so scoring only sees candidates.
    const candidates: CognitionItem[] = [];
    for (const item of this.items.values()) {
      if (query.organizationId && item.organizationId !== query.organizationId) continue;
      if (query.framework && item.framework !== query.framework) continue;
      if (query.controlSlug && item.controlSlug !== query.controlSlug) continue;
      // Jurisdiction filter — exact match OR pan-Canadian applicability. A
      // National Instrument tagged "multi-provincial" applies in every
      // province; a federal statute tagged "federal" applies nationally. Both
      // should surface when a provincial matter queries its own jurisdiction.
      if (
        query.jurisdiction &&
        item.jurisdiction &&
        item.jurisdiction !== query.jurisdiction &&
        item.jurisdiction !== "multi-provincial" &&
        item.jurisdiction !== "federal"
      ) {
        continue;
      }
      if (
        query.registrationCategory &&
        item.registrationCategories?.length &&
        !item.registrationCategories.includes(query.registrationCategory)
      )
        continue;
      candidates.push(item);
    }
    if (candidates.length === 0) return [];

    const queryTokens = tokenize(query.query);
    const qTokenSet = new Set(queryTokens);

    const items: { id: string; text: string; item: CognitionItem }[] = candidates.map((item) => ({
      id: item.id!,
      text: `${item.title} ${item.content}`,
      item,
    }));

    // ---- BM25 ranking ----
    const bm25Index = buildBM25Index(items);
    const bm25Scored = bm25Index.docs.map((d) => ({
      id: d.id,
      score: bm25Score(queryTokens, d, bm25Index),
    }));
    normalizeScores(bm25Scored);
    bm25Scored.sort((a, b) => b.score - a.score);

    // ---- Jaccard ranking (for back-compat mode) ----
    const jaccardScored = items.map((it) => ({
      id: it.id,
      score: jaccard(qTokenSet, tokenSet(it.text)),
    }));
    jaccardScored.sort((a, b) => b.score - a.score);

    // ---- Select scoring -----------------------------------------------------
    let picked: { id: string; score: number }[];
    if (mode === "jaccard") {
      picked = jaccardScored;
    } else if (mode === "bm25") {
      picked = bm25Scored;
    } else {
      // "hybrid" — BM25 + (stub) semantic via RRF. Today semantic ≡ identity
      // on BM25, which means hybrid behaves like BM25-only. Wired so a real
      // semantic ranker (embeddings) can drop in without changing callers.
      const semanticRanked = bm25Scored; // stub
      const fused = rrfFuse(
        bm25Scored.map((s, i) => ({ id: s.id, rank: i + 1 })),
        semanticRanked.map((s, i) => ({ id: s.id, rank: i + 1 })),
      );
      picked = [...fused.entries()].map(([id, score]) => ({ id, score }));
      normalizeScores(picked);
      picked.sort((a, b) => b.score - a.score);
    }

    // Assemble results, apply threshold + topK.
    const byId = new Map(items.map((it) => [it.id, it.item]));
    const results: RetrievalResult[] = [];
    for (const p of picked) {
      const item = byId.get(p.id);
      if (!item) continue;
      if (p.score < threshold) continue;
      results.push({ item, score: p.score });
      if (results.length >= topK) break;
    }
    return results;
  }

  async reset(): Promise<void> {
    this.items.clear();
  }

  async size(): Promise<number> {
    return this.items.size;
  }
}
