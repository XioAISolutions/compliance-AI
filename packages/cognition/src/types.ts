/**
 * Cognition-store contracts — modeled on GAIR-NLP/ASI-Evolve's
 * `cognition/cognition.py` (Apache 2.0). We keep the *interface* and replace
 * their FAISS+sentence-transformers backend with our own (in-memory for dev,
 * Postgres+pgvector for prod via the Drizzle layer).
 *
 * Why we lifted this design: a generic key-value store would lose the
 * `(item, score)` retrieval shape that lets the drafter persona reason about
 * how relevant each snippet is, and the `score_threshold` cutoff that prevents
 * irrelevant snippets from polluting the prompt.
 */

import type { FrameworkId } from "@compliance-ai/frameworks";

export interface CognitionItem {
  /** Stable id (UUID). Generated on add() if omitted. */
  id?: string;
  /** Tenant scope. Required at the prod layer; optional in tests. */
  organizationId?: string;
  /** Optional framework anchor — e.g., a snippet specific to SOC 2 narratives. */
  framework?: FrameworkId;
  /** Optional control anchor — e.g., a snippet specific to CC6.1 prior drafts. */
  controlSlug?: string;
  /** Short, human-readable label. Surfaced in the UI when a retrieval is shown. */
  title: string;
  /** The actual text body the drafter/reviewer reads. */
  content: string;
  /** Free-form provenance — "auditor letter 2025-Q3", "policy v2 by jdoe", etc. */
  source?: string;
  /** Jurisdiction scope — e.g. "ontario", "federal". Filters retrieval per matter. */
  jurisdiction?: string;
  /** Registration categories this item applies to — e.g. ["emd", "pm"]. */
  registrationCategories?: string[];
  createdAt?: Date;
}

export interface RetrievalResult {
  item: CognitionItem;
  /** Backend-defined relevance score, 0..1. Higher = more relevant. */
  score: number;
}

export interface RetrievalQuery {
  query: string;
  topK?: number;
  /** Retrieval mode. `hybrid` combines lexical overlap with BM25-style term weighting. */
  searchMode?: "hybrid" | "bm25" | "jaccard";
  /** Drop results below this score. */
  scoreThreshold?: number;
  /** Restrict to items tagged with one of these frameworks. */
  framework?: FrameworkId;
  /** Restrict to items tagged with this control slug. */
  controlSlug?: string;
  /** Restrict to items in this tenant. */
  organizationId?: string;
  /** Restrict to items matching this jurisdiction. */
  jurisdiction?: string;
  /** Restrict to items applicable to this registration category. */
  registrationCategory?: string;
  /**
   * Which scoring to use. "hybrid" combines BM25 + (semantic stub) with
   * reciprocal-rank-fusion; "bm25" and "jaccard" fall back to a single signal.
   * Default: "hybrid".
   *
   * Cannibalized from GitNexus's hybrid search (BM25 + semantic + RRF).
   * Semantic is a stub today — when embeddings land (pgvector, Day 3+),
   * hybrid will start combining real signals. Until then, hybrid ≡ BM25.
   */
  searchMode?: "hybrid" | "bm25" | "jaccard";
}

export interface CognitionStore {
  add(item: CognitionItem): Promise<string>;
  addBatch(items: CognitionItem[]): Promise<string[]>;
  remove(id: string): Promise<boolean>;
  get(id: string): Promise<CognitionItem | null>;
  getAll(): Promise<CognitionItem[]>;
  retrieve(query: RetrievalQuery): Promise<RetrievalResult[]>;
  reset(): Promise<void>;
  size(): Promise<number>;
}
