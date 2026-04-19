/**
 * Structured citations — first-class, not free text.
 *
 * The model emits citations as a JSON block at the end of its response
 * (fenced ```citations ... ```). Each citation maps an inline `[cN]`
 * marker in the prose to a specific authority section + source chunk.
 *
 * This module provides:
 *   - The Citation type
 *   - A parser that extracts citations from model output
 *   - A validator that cross-checks inline markers against the array
 */

/**
 * Canonical source types a lawyer recognizes. Drives badge color and the
 * ranking of how much weight a reviewer should give the citation.
 * "statute" > "regulation" > "rule" > "case" > "practice-direction" >
 * "regulator-notice" > "commentary".
 */
export type SourceType =
  | "statute"
  | "regulation"
  | "rule"
  | "case"
  | "practice-direction"
  | "regulator-notice"
  | "commentary"
  | "internal"
  | "other";

export interface Citation {
  /** In-doc unique, e.g. "c1", "c2". Referenced inline as [c1]. */
  id: string;
  /** Authority identifier, e.g. "ni-45-106", "osc-rule-45-501". */
  authorityId: string;
  /** Section within the authority, e.g. "2.9(2)(a)". */
  section: string;
  /** Exact text pulled from the source chunk. */
  quote: string;
  /** Source document id in the cognition store. */
  docId: string;
  /** Source chunk id in the cognition store. */
  chunkId: string;
  /** For PDFs, 1-indexed page number. */
  page?: number;
  /**
   * Source-locker fields — provenance a Canadian lawyer needs before trusting
   * an AI-surfaced citation.
   */
  /** Jurisdiction scope — e.g. "ontario", "federal", "multi-provincial". */
  jurisdiction?: string;
  /** Canonical source type. */
  sourceType?: SourceType;
  /**
   * Publication / as-of date of the authority in ISO-8601, e.g. "2024-06-30".
   * For statutes this is the consolidation date; for cases, the decision date.
   */
  authorityDate?: string;
  /**
   * Pinpoint reference beyond section — paragraph number in a case, schedule
   * number in a statute, page in a notice. Free-form.
   */
  pinpoint?: string;
  /**
   * Model-reported confidence that the cited authority actually supports the
   * proposition in the prose. 0..1. Reviewers can filter low-confidence
   * claims before export.
   */
  confidence?: number;
}

export interface ParsedOutput {
  /** The prose content with citation markers [c1], [c2], etc. */
  prose: string;
  /** Parsed citations array. Empty if no citations block found. */
  citations: Citation[];
  /** Citation ids referenced in prose but missing from the array. */
  orphanedMarkers: string[];
  /** Citations in the array but never referenced in prose. */
  unusedCitations: string[];
}

const CITATIONS_FENCE_RE = /```citations\s*\n([\s\S]*?)\n```/;
const INLINE_MARKER_RE = /\[c\d+\]/g;

/**
 * Parse model output into prose + structured citations.
 *
 * The model is instructed to emit a fenced ```citations block containing
 * a JSON array of Citation objects. This function:
 *   1. Extracts and removes the citations fence from the prose
 *   2. Parses the JSON array
 *   3. Cross-checks inline markers against the array
 *   4. Drops any citation with an unresolvable chunkId (logs as orphaned)
 */
export function parseModelOutput(raw: string): ParsedOutput {
  const fenceMatch = raw.match(CITATIONS_FENCE_RE);
  const prose = raw.replace(CITATIONS_FENCE_RE, "").trim();

  let citations: Citation[] = [];
  if (fenceMatch?.[1]) {
    try {
      const parsed = JSON.parse(fenceMatch[1]);
      if (Array.isArray(parsed)) {
        citations = parsed.filter(isCitation);
      }
    } catch {
      // Malformed JSON — treat as zero citations
    }
  }

  // Cross-check inline markers vs. citation array
  const inlineMarkers = new Set(
    (prose.match(INLINE_MARKER_RE) ?? []).map((m) => m.slice(1, -1)),
  );
  const citationIds = new Set(citations.map((c) => c.id));

  const orphanedMarkers = [...inlineMarkers].filter((id) => !citationIds.has(id));
  const unusedCitations = [...citationIds].filter((id) => !inlineMarkers.has(id));

  return { prose, citations, orphanedMarkers, unusedCitations };
}

const VALID_SOURCE_TYPES: ReadonlySet<SourceType> = new Set<SourceType>([
  "statute",
  "regulation",
  "rule",
  "case",
  "practice-direction",
  "regulator-notice",
  "commentary",
  "internal",
  "other",
]);

/** Type guard for a valid Citation shape. Strict on required, tolerant of optional. */
function isCitation(obj: unknown): obj is Citation {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (
    typeof o.id !== "string" ||
    typeof o.authorityId !== "string" ||
    typeof o.section !== "string" ||
    typeof o.quote !== "string" ||
    typeof o.docId !== "string" ||
    typeof o.chunkId !== "string"
  ) {
    return false;
  }
  // Silently drop malformed optional fields instead of rejecting the whole
  // citation — the core identifiers are intact, which is what validators need.
  if (o.sourceType !== undefined && !VALID_SOURCE_TYPES.has(o.sourceType as SourceType)) {
    delete o.sourceType;
  }
  if (o.confidence !== undefined) {
    const n = Number(o.confidence);
    if (!Number.isFinite(n) || n < 0 || n > 1) delete o.confidence;
    else o.confidence = n;
  }
  return true;
}

/**
 * Validate citations against a set of known chunk IDs from the cognition
 * store. Returns only citations whose chunkId exists.
 */
export function validateCitations(
  citations: Citation[],
  knownChunkIds: Set<string>,
): { valid: Citation[]; dropped: Citation[] } {
  const valid: Citation[] = [];
  const dropped: Citation[] = [];
  for (const c of citations) {
    if (knownChunkIds.has(c.chunkId)) {
      valid.push(c);
    } else {
      dropped.push(c);
    }
  }
  return { valid, dropped };
}

/**
 * The citation instruction block appended to the agent system prompt
 * when retrieved snippets are present. Tells the model how to format
 * structured citations.
 */
export const CITATION_INSTRUCTION = `
## Citation format

When you reference a retrieved snippet or authority in your answer, cite it
inline using bracketed markers: [c1], [c2], etc. At the END of your response,
include a fenced block with the citation details:

\`\`\`citations
[
  {
    "id": "c1",
    "authorityId": "ni-45-106",
    "section": "2.9(2)(a)",
    "quote": "exact text from the source",
    "docId": "the document id",
    "chunkId": "the chunk id",
    "jurisdiction": "ontario",
    "sourceType": "rule",
    "authorityDate": "2024-06-30",
    "pinpoint": "para. 14",
    "confidence": 0.88
  }
]
\`\`\`

Rules:
- Every [cN] marker in your prose MUST have a matching entry in the citations array.
- Every entry in the citations array MUST be referenced at least once in the prose.
- The "quote" field must be an exact substring from the retrieved snippet, not a paraphrase.
- If a snippet has a page number, include "page": N in the citation object.
- Do not fabricate citations. If you cannot cite a source, do not use a marker.

Source-locker fields (Canadian legal practice requires provenance):
- "jurisdiction": copy from the retrieved snippet (e.g. "ontario", "federal",
  "british-columbia", "multi-provincial"). Never guess.
- "sourceType": one of "statute", "regulation", "rule", "case",
  "practice-direction", "regulator-notice", "commentary", "internal", "other".
  Pick the narrowest accurate label.
- "authorityDate": the ISO-8601 date from the retrieved snippet (consolidation
  date for legislation, decision date for cases). Omit if the snippet does not
  carry one — do not guess.
- "pinpoint": paragraph, schedule, or page beyond the section if the snippet
  provides it.
- "confidence": a number in [0,1] expressing how strongly the cited authority
  supports the proposition in the prose. 1.0 = direct on-point text; 0.5 = the
  authority is related but requires analogical reasoning; below 0.4 = you
  should probably not rely on this citation. Reviewers filter on this value.
`.trim();
