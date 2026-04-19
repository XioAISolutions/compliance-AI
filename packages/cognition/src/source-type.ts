/**
 * Source-type inference for the source locker.
 *
 * Many legacy authority items in this corpus predate the `sourceType` +
 * `authorityDate` tagging convention. Rather than bulk-edit the 112-row
 * NI 45-106 corpus, we derive a reasonable sourceType at read time from the
 * item's `source` / `title` strings. Explicit tags on a CognitionItem always
 * win; inference is fallback only.
 *
 * Keep the heuristics narrow and conservative — guessing "statute" for a
 * commentary piece is worse than returning "other" and letting the UI show an
 * unlabeled badge the reviewer has to resolve.
 */

import type { SourceType } from "./types.js";

export interface SourceHints {
  source?: string;
  title?: string;
  authorityId?: string;
}

/**
 * Derive a SourceType from the item's text hints, or "other" if no rule matches.
 * Order matters: statute checks run before regulation, before case, etc.
 */
export function inferSourceType(hints: SourceHints): SourceType {
  const blob = [hints.source, hints.title, hints.authorityId]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!blob) return "other";

  // Cases first — "v." and court abbreviations are cheap and unambiguous.
  if (/\bv\.\s/.test(blob) || /\b\d{4}\s+(scc|onca|onsc|qcca|bcca|abca|abqb|fc|fca)\b/.test(blob)) {
    return "case";
  }

  // Practice directions & court notices for AI use live in their own lane so
  // reviewers notice them when preparing filings.
  if (/practice\s+direction|practice\s+note|court\s+notice|consolidated\s+notice/.test(blob)) {
    return "practice-direction";
  }

  // Regulator notices / staff notices / bulletins / guidelines — not binding
  // law but consistently relied on.
  if (
    /staff\s+notice|compliance\s+bulletin|guideline\s+\d|supervisory\s+guidance|interpretation\s+notice|field\s+review/.test(
      blob,
    )
  ) {
    return "regulator-notice";
  }

  // National / Multilateral Instruments and OSC/BCSC/ASC/AMF rules.
  if (/\bnational\s+instrument|\bni\s+\d|\bmulti-?lateral\s+instrument|\brule\s+\d|securities\s+commission\s+rule/.test(blob)) {
    return "rule";
  }

  // Regulations under enabling legislation.
  if (/\bregulation\b|\bregulations\b|\bo\.\s*reg\b|\bs\.\s*or\b/.test(blob)) {
    return "regulation";
  }

  // Statutes — the "Act" signal is strong enough on its own.
  if (/\bact,?\s+\d{4}|\bact\b|c\.\s+[a-z]\.\d|r\.s\.o\.|r\.s\.c\.|s\.o\.\s+\d|s\.c\.\s+\d/.test(blob)) {
    return "statute";
  }

  // Books, treatises, law-society notes, CanLII commentary.
  if (/commentary|treatise|article|law\s+society|canlii\s+summary/.test(blob)) {
    return "commentary";
  }

  return "other";
}
