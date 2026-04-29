/**
 * Lesson types and store contracts.
 *
 * A Lesson is distinct from a CognitionItem (an authority chunk). Lessons
 * are extracted insights from agent sessions — observations, gotchas,
 * patterns the firm wants to remember next time. They accumulate weight
 * via reinforcement and can be superseded when later sessions disagree.
 *
 * Two-layer consolidation modeled on jcode/OpenClaw:
 *   Layer 1 (sidecar):  per-turn dedup + reinforce/supersede on insert.
 *   Layer 2 (garden):   ambient deep dedup, fact verification, cluster
 *                        discovery, prune-on-repeal.
 */

import type { FrameworkId } from "@compliance-ai/frameworks";

export interface LessonSource {
  /**
   * The agent session this lesson came from. A session is one matter
   * review, one ambient garden cycle, or one deliberate ingest. The
   * id is an opaque string the caller controls — we never parse it.
   */
  sessionId: string;
  /** The CRUMB block id, when the lesson was extracted from a CRUMB. */
  crumbId?: string;
  /** Persona that surfaced the lesson — drafter, judge, evidence-collector, etc. */
  agent?: string;
  /** First ~240 chars of the surrounding evidence — for audit, not retrieval. */
  excerpt?: string;
  /** When this source observed the lesson. ISO date on the wire; Date in mem. */
  observedAt: Date;
}

export type LessonStatus = "active" | "superseded";

export type LessonRelationType =
  | "supersedes"
  | "agrees-with"
  | "discovered-cluster";

export interface Lesson {
  id: string;
  organizationId: string;
  /** The lesson body itself — short prose, "always check NI 33-109 disclosure when …" */
  content: string;
  /**
   * Dense vector embedding for cosine-similarity dedup. Length is fixed
   * by the embedding provider; mixed dimensions are a programmer error
   * (the store guards against it).
   */
  embedding?: number[];
  /**
   * Reinforcement weight. Starts at 1; bumped by 1 every time the
   * sidecar consolidates a near-duplicate observation against this
   * lesson. The garden uses weight as one of the tie-breakers when
   * choosing which member of a cluster to keep.
   */
  weight: number;
  /**
   * Breadcrumb of every session/CRUMB that has reinforced this lesson.
   * Capped at 32 entries (we keep the latest) to bound memory; the
   * garden audit log preserves the full history if needed.
   */
  sources: LessonSource[];
  /** Free-form classification tags the agent emitted. */
  tags: string[];
  /** Optional framework anchor — SOC 2 / GDPR / etc. */
  framework?: FrameworkId;
  /** Optional control anchor. */
  controlSlug?: string;
  /** Optional jurisdiction. */
  jurisdiction?: string;
  /**
   * "active" lessons are returned by retrieval. "superseded" lessons
   * remain in the store for audit + bandit-arm continuity but are
   * skipped by readers unless asked for explicitly.
   */
  status: LessonStatus;
  /** When superseded, the id of the lesson that replaced this one. */
  supersededBy?: string;
  /** When this lesson superseded an older one. */
  supersedes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LessonRelation {
  id: string;
  fromLessonId: string;
  toLessonId: string;
  type: LessonRelationType;
  /** Free-form reason — e.g., "regulator updated NI 31-103 s.13.3" */
  reason?: string;
  createdAt: Date;
}

/**
 * A lesson candidate the sidecar is asked to consolidate. The store
 * itself never sees these directly — the sidecar either inserts a
 * Lesson, reinforces an existing one, or flags a contradiction.
 */
export interface LessonCandidate {
  organizationId: string;
  content: string;
  source: LessonSource;
  tags?: string[];
  framework?: FrameworkId;
  controlSlug?: string;
  jurisdiction?: string;
}

export interface LessonStore {
  insert(input: Omit<Lesson, "id" | "createdAt" | "updatedAt">): Promise<Lesson>;
  get(id: string): Promise<Lesson | null>;
  getMany(ids: string[]): Promise<Lesson[]>;
  list(
    organizationId: string,
    opts?: { status?: LessonStatus | "all" },
  ): Promise<Lesson[]>;
  /**
   * Top-k nearest active lessons by cosine similarity over the embedding.
   * Mismatched-dimension embeddings are skipped (not thrown) so a model
   * swap mid-flight degrades gracefully.
   */
  topKByEmbedding(
    organizationId: string,
    embedding: number[],
    k: number,
  ): Promise<Array<{ lesson: Lesson; similarity: number }>>;
  reinforce(id: string, source: LessonSource): Promise<Lesson>;
  /**
   * Bulk-reinforce: append multiple sources and bump weight by the
   * delta count in one operation. Used by the garden when it folds a
   * cluster member into the cluster winner.
   */
  reinforceWith(id: string, sources: LessonSource[], weightDelta: number): Promise<Lesson>;
  supersede(
    oldId: string,
    newLesson: Omit<Lesson, "id" | "createdAt" | "updatedAt">,
    reason: string,
  ): Promise<{ old: Lesson; new: Lesson; relation: LessonRelation }>;
  /**
   * Mark `loserId` superseded BY `winnerId` without creating a new
   * lesson. Used by the garden to collapse a duplicate cluster onto
   * its winner, preserving bandit-arm continuity (the winner's id
   * stays stable; readers that cached `winnerId` keep working).
   */
  markSuperseded(loserId: string, winnerId: string, reason: string): Promise<{ loser: Lesson; relation: LessonRelation }>;
  addRelation(
    rel: Omit<LessonRelation, "id" | "createdAt">,
  ): Promise<LessonRelation>;
  listRelations(lessonId: string): Promise<LessonRelation[]>;
  remove(id: string): Promise<boolean>;
  size(): Promise<number>;
}
