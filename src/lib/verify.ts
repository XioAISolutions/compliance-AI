/**
 * Quote-level citation verification.
 *
 * For each [[Sn:ref]] that the LLM emits, check that the sentence preceding
 * the citation actually has lexical overlap with the cited chunk. If the
 * model fabricated a plausible-looking claim and stuck a real citation on
 * the end, the overlap collapses and we can flag it.
 *
 * Not a substitute for an NLI or judge model — it's a cheap first line of
 * defense that runs locally with no extra inference cost.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "to", "of", "in", "on", "at", "by", "for", "with", "and", "or", "but",
  "if", "then", "else", "when", "where", "which", "who", "what", "how",
  "this", "that", "these", "those", "it", "its", "as", "from", "into",
  "do", "does", "did", "have", "has", "had", "not", "no", "yes",
  "must", "shall", "may", "should", "will", "would", "can", "could",
]);

function significantTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9§.\-\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOPWORDS.has(t));
}

/**
 * Pull the claim sentence that a citation marker concludes: everything
 * between the previous sentence terminator (or the start of the string)
 * and the marker itself. We also walk back past any immediately-adjacent
 * citation markers so a run of "[[S1:§4]] [[S2:§5]]" all share one claim.
 */
export function extractClaimForCitation(text: string, markerStart: number): string {
  let cursor = markerStart;
  // Skip preceding citation markers + whitespace.
  while (cursor > 0) {
    const prev = text.slice(0, cursor).trimEnd();
    if (prev.endsWith("]]")) {
      const openIdx = prev.lastIndexOf("[[");
      if (openIdx === -1) break;
      cursor = openIdx;
    } else break;
  }
  const before = text.slice(0, cursor);
  const terminatorMatch = before.match(/[.!?]\s+(?=[^\s])[^.!?]*$/);
  if (terminatorMatch) return terminatorMatch[0].replace(/^[.!?]\s+/, "").trim();
  return before.trim();
}

export interface VerificationResult {
  verified: boolean;
  overlap: number;          // fraction of significant claim tokens found in chunk
  significantTokens: number; // total significant tokens in the claim
  matchedTokens: number;
}

export function verifyClaimAgainstChunk(claim: string, chunkContent: string): VerificationResult {
  const claimTokens = significantTokens(claim);
  if (claimTokens.length === 0) {
    return { verified: true, overlap: 1, significantTokens: 0, matchedTokens: 0 };
  }
  const chunkSet = new Set(significantTokens(chunkContent));
  const matched = claimTokens.filter((t) => chunkSet.has(t)).length;
  const overlap = matched / claimTokens.length;

  // Threshold: require either 30% of claim tokens or 3+ absolute, whichever
  // is lower. Short claims (e.g., "within 72 hours") shouldn't fail just
  // because they have few tokens.
  const threshold = Math.min(0.3, 3 / claimTokens.length);
  return { verified: overlap >= threshold, significantTokens: claimTokens.length, matchedTokens: matched, overlap };
}
