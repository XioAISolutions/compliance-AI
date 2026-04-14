import { vectorStore } from "./vector-store";
import { config } from "./config";
import type { DocumentChunk } from "./ingest";

/**
 * Hybrid search: BM25 (lexical) + dense vector (semantic), fused with
 * Reciprocal Rank Fusion.
 *
 * Compliance queries hit both registers: exact section numbers and jargon
 * (lexical) and paraphrased questions (semantic). RRF is the right fuser
 * because it consumes only ranks, not scores — so cosine similarity and
 * BM25 can live in different numeric universes without normalization.
 */

const RRF_K = 60;

// --- Tokenization + BM25 ------------------------------------------------------

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "to", "of", "in", "on", "at", "by", "for", "with", "and", "or", "but",
  "if", "then", "else", "when", "where", "which", "who", "what", "how",
  "this", "that", "these", "those", "it", "its", "as", "from", "into",
  "do", "does", "did", "have", "has", "had", "not", "no", "yes",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9§.\-\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

interface BM25Stats {
  df: Map<string, number>;         // document frequency per term
  avgDocLen: number;
  docLens: Map<string, number>;    // docId -> length
  termFreqs: Map<string, Map<string, number>>; // docId -> term -> tf
  totalDocs: number;
}

function buildBM25Stats(chunks: DocumentChunk[]): BM25Stats {
  const df = new Map<string, number>();
  const docLens = new Map<string, number>();
  const termFreqs = new Map<string, Map<string, number>>();
  let totalLen = 0;

  for (const c of chunks) {
    const text = [c.sectionHeader ?? "", c.sectionPath.join(" "), c.content].join(" ");
    const tokens = tokenize(text);
    docLens.set(c.id, tokens.length);
    totalLen += tokens.length;

    const tf = new Map<string, number>();
    for (const tok of tokens) tf.set(tok, (tf.get(tok) ?? 0) + 1);
    termFreqs.set(c.id, tf);

    for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }

  return {
    df,
    avgDocLen: chunks.length > 0 ? totalLen / chunks.length : 0,
    docLens,
    termFreqs,
    totalDocs: chunks.length,
  };
}

function bm25Score(query: string, chunkId: string, stats: BM25Stats): number {
  const k1 = 1.5, b = 0.75;
  const terms = tokenize(query);
  const tfMap = stats.termFreqs.get(chunkId);
  if (!tfMap) return 0;
  const docLen = stats.docLens.get(chunkId) ?? 0;
  let score = 0;
  for (const term of terms) {
    const tf = tfMap.get(term) ?? 0;
    if (tf === 0) continue;
    const df = stats.df.get(term) ?? 0;
    const idf = Math.log(1 + (stats.totalDocs - df + 0.5) / (df + 0.5));
    const denom = tf + k1 * (1 - b + b * (docLen / Math.max(stats.avgDocLen, 1)));
    score += idf * ((tf * (k1 + 1)) / denom);
  }
  return score;
}

// --- RRF fusion ---------------------------------------------------------------

interface Ranked { chunkId: string; rank: number; }

function rankBy<T extends { chunkId: string; score: number }>(items: T[]): Ranked[] {
  return [...items]
    .sort((a, b) => b.score - a.score)
    .filter((i) => i.score > 0)
    .map((i, idx) => ({ chunkId: i.chunkId, rank: idx + 1 }));
}

function mergeWithRRF(lists: Ranked[][]): Map<string, number> {
  const fused = new Map<string, number>();
  for (const list of lists) {
    for (const { chunkId, rank } of list) {
      fused.set(chunkId, (fused.get(chunkId) ?? 0) + 1 / (RRF_K + rank));
    }
  }
  return fused;
}

// --- Public API ---------------------------------------------------------------

export interface HybridResult {
  chunk: DocumentChunk;
  score: number;        // fused RRF score
  vectorScore: number;  // underlying cosine similarity (0-1)
  bm25Score: number;
}

export async function hybridSearch(query: string, topK?: number): Promise<HybridResult[]> {
  const k = topK ?? config.retrieval.topK;

  const [vectorRanked, allChunks] = await Promise.all([
    vectorStore.rankAll(query),
    vectorStore.allChunks(),
  ]);

  if (allChunks.length === 0) return [];

  const stats = buildBM25Stats(allChunks);
  const bm25 = allChunks.map((c) => ({ chunkId: c.id, score: bm25Score(query, c.id, stats) }));

  const vectorMap = new Map(vectorRanked.map((v) => [v.chunk.id, v.score]));
  const bm25Map = new Map(bm25.map((b) => [b.chunkId, b.score]));

  const vectorRanks = rankBy(vectorRanked.map((v) => ({ chunkId: v.chunk.id, score: v.score })));
  const bm25Ranks = rankBy(bm25);

  const fused = mergeWithRRF([vectorRanks, bm25Ranks]);
  const chunkById = new Map(allChunks.map((c) => [c.id, c]));

  return Array.from(fused.entries())
    .map(([chunkId, score]) => {
      const chunk = chunkById.get(chunkId)!;
      return {
        chunk,
        score,
        vectorScore: vectorMap.get(chunkId) ?? 0,
        bm25Score: bm25Map.get(chunkId) ?? 0,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
