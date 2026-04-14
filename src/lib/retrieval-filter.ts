/**
 * Retrieval filter primitives.
 *
 * A single `RetrievalFilter` threads from the citation engine all the way
 * down to `vectorStore.search`, so every retrieval path (hybrid / hyde /
 * multi) can be scoped to a matter, to one or more document types, or to
 * a jurisdiction — and can optionally boost chunks by authority weight
 * (binding statute > regulation > persuasive caselaw > client docs).
 *
 * Kept in its own module so `ingest.ts`, `vector-store.ts`, and
 * `hybrid-search.ts` can import the types without creating import cycles.
 */

export type DocType =
  | "statute"        // codified law, binding
  | "regulation"     // administrative rule, binding
  | "caselaw"        // judicial opinion, persuasive-to-binding
  | "contract"       // client-side contract / TOS / disclosure
  | "client_facts"   // intake notes, timeline, client correspondence
  | "correspondence" // letters to/from opposing party, collector notices
  | "form"           // template demand letter, complaint skeleton
  | "unknown";

export const DOC_TYPES: DocType[] = [
  "statute", "regulation", "caselaw",
  "contract", "client_facts", "correspondence",
  "form", "unknown",
];

/**
 * Authority weights drive the optional post-RRF multiplier used when
 * `RetrievalFilter.authorityBoost` is on. Binding statutes dominate,
 * client docs surface only when nothing authoritative matches.
 * Consumer law is statute-anchored — these weights encode that.
 */
export const AUTHORITY_WEIGHT: Record<DocType, number> = {
  statute: 1.0,
  regulation: 0.85,
  caselaw: 0.7,
  contract: 0.5,
  correspondence: 0.4,
  client_facts: 0.3,
  form: 0.2,
  unknown: 0.3,
};

export interface RetrievalFilter {
  /** If set, only include chunks whose `matterId` is in this list. Defaults to ["default"] at the entry point. */
  matterIds?: string[];
  /** If set, only include chunks whose `docType` is in this list. */
  docTypes?: DocType[];
  /** If set, only include chunks whose `jurisdiction` is in this list. */
  jurisdictions?: string[];
  /** When true, multiply fused RRF score by chunk.authorityWeight before ranking. */
  authorityBoost?: boolean;
}

/**
 * Per-chunk match test. Returns true when the chunk should be included.
 * Unset filter fields pass through (filter is additive, not exclusive).
 */
export function chunkMatches(
  chunk: { matterId?: string; docType?: DocType; jurisdiction?: string | null },
  filter: RetrievalFilter | undefined,
): boolean {
  if (!filter) return true;
  if (filter.matterIds && filter.matterIds.length > 0) {
    const id = chunk.matterId ?? "default";
    if (!filter.matterIds.includes(id)) return false;
  }
  if (filter.docTypes && filter.docTypes.length > 0) {
    const dt = chunk.docType ?? "unknown";
    if (!filter.docTypes.includes(dt)) return false;
  }
  if (filter.jurisdictions && filter.jurisdictions.length > 0) {
    const j = chunk.jurisdiction ?? "";
    if (!filter.jurisdictions.includes(j)) return false;
  }
  return true;
}

export function authorityWeightFor(docType: DocType | undefined): number {
  return AUTHORITY_WEIGHT[docType ?? "unknown"];
}
