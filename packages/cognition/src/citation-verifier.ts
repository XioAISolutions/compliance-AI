/**
 * Citation verifier — resolves a Citation to an authoritative source.
 *
 * Lawyers' #1 concern about AI-assisted legal work is hallucinated or
 * subtly-wrong citations. The source-locker gives every citation
 * structured provenance; the missing-authority scanner flags what needs
 * verification; this module does the actual verification.
 *
 * Verification strategies (composable):
 *
 *   1. Offline corpus match — does the citation's `authorityId` or
 *      `(authority + section)` pair resolve to an item in this tenant's
 *      CognitionStore? The seeded corpus is itself a verification
 *      source: if we seeded it, a practicing Canadian lawyer can rely on
 *      it. (The seed text is always paraphrased, so counsel still
 *      verifies the exact wording against the authoritative source
 *      before filing — that's why the disclosure memo has a counsel
 *      signoff appendix. What this strategy confirms is that the
 *      *citation itself* — the authority id, the jurisdiction, the
 *      section — is real, not fabricated.)
 *
 *   2. CanLII URL heuristic — constructs a candidate canlii.org URL
 *      from the citation's authorityId / section / jurisdiction. Does
 *      not fetch; returns the URL so counsel can verify with one
 *      click. Eliminates the "open a browser, search canlii, paste the
 *      cite" friction that is the actual reason hallucinated cites
 *      make it past a hurried reviewer.
 *
 *   3. CanLII live fetch — stubbed here behind the CANLII_API_KEY env
 *      var. When a real API key is configured, the live adapter
 *      verifies the URL resolves + matches the cited section text.
 *      Without the key, the heuristic verifier still produces a
 *      candidate URL but reports status "candidate-url" instead of
 *      "verified".
 */

import type { CognitionStore } from "./types.js";
import { CanliiLiveFetchVerifier, canliiLiveFetchEnabled } from "./canlii-live-verifier.js";

/**
 * A citation as the verifier expects to receive it. Structurally the
 * same shape as `@compliance-ai/agents` Citation but redeclared here so
 * @compliance-ai/cognition doesn't reverse-depend on agents.
 */
export interface VerifierCitation {
  id: string;
  authorityId: string;
  section: string;
  quote?: string;
  jurisdiction?: string;
  sourceType?: string;
  authorityDate?: string;
  pinpoint?: string;
  confidence?: number;
}

/**
 * Verification outcome for a single citation. `status` is the summary;
 * `evidence` carries the artifact a reviewer needs to trust the result.
 */
export interface VerificationResult {
  /** Citation id (e.g. "c1") — matches the input citation. */
  citationId: string;
  /**
   * - "verified"       — citation resolved to an authoritative source
   *                      via an offline corpus match or a successful
   *                      live fetch.
   * - "candidate-url"  — we generated a candidate CanLII URL but
   *                      cannot confirm it resolves without a live
   *                      fetch. Reviewer opens the URL to verify.
   * - "unsupported"    — no verification strategy applies (e.g., the
   *                      citation's authorityId is an internal policy
   *                      item, not a citable law).
   * - "not-found"      — every strategy failed to find a match. Treat
   *                      as a potentially fabricated citation.
   * - "error"          — a verifier threw.
   */
  status: "verified" | "candidate-url" | "unsupported" | "not-found" | "error";
  /** Which strategy produced this result. */
  method:
    | "offline-corpus"
    | "canlii-url-heuristic"
    | "canlii-live"
    | "none";
  /** Human-readable single-sentence explanation. */
  reason: string;
  /** 0..1 confidence that the citation is real. */
  confidence: number;
  /** Evidence artifact the reviewer follows to confirm. */
  evidence?: {
    url?: string;
    matchedAuthorityId?: string;
    matchedTitle?: string;
    matchedJurisdiction?: string;
  };
  /** ISO-8601 timestamp of when the verification ran. */
  verifiedAt: string;
}

export interface CitationVerifier {
  verify(citation: VerifierCitation): Promise<VerificationResult>;
  verifyBatch(citations: VerifierCitation[]): Promise<VerificationResult[]>;
}

// ---------------------------------------------------------------------------
// Offline corpus verifier
// ---------------------------------------------------------------------------

/**
 * Resolves the citation against a CognitionStore. The match is:
 *   1. exact `authorityId` hit on the store, or
 *   2. a store item whose title contains both the authorityId fragment
 *      and the section number, or
 *   3. an item tagged with the same jurisdiction whose title+content
 *      contains a prominent substring of the citation's authority.
 *
 * Confidence scales from 1.0 (exact id hit) down to 0.6 (loose title
 * match).
 */
export class OfflineCorpusVerifier implements CitationVerifier {
  constructor(
    private readonly store: CognitionStore,
    private readonly organizationId?: string,
  ) {}

  async verify(citation: VerifierCitation): Promise<VerificationResult> {
    const now = new Date().toISOString();

    // Exact id match. Seed items carry an id like "auth-ni-45-106-2.9".
    // The drafter's authorityId is usually the same pattern, so exact
    // hits are common.
    const exact = await this.store.get(citation.authorityId);
    if (exact) {
      return {
        citationId: citation.id,
        status: "verified",
        method: "offline-corpus",
        reason: `Matched store item by exact id: ${exact.title}`,
        confidence: 1.0,
        evidence: {
          matchedAuthorityId: exact.id,
          matchedTitle: exact.title,
          matchedJurisdiction: exact.jurisdiction,
        },
        verifiedAt: now,
      };
    }

    // Title-contains match. Retrieve by the citation's authorityId as
    // the query and see if any top result titles contain the section.
    const query = [citation.authorityId, citation.section].filter(Boolean).join(" ");
    const hits = await this.store.retrieve({
      query,
      topK: 5,
      ...(this.organizationId ? { organizationId: this.organizationId } : {}),
      ...(citation.jurisdiction ? { jurisdiction: citation.jurisdiction } : {}),
      scoreThreshold: 0.01,
    });

    const authorityKey = citation.authorityId.toLowerCase();
    const sectionKey = (citation.section ?? "").toLowerCase();
    for (const hit of hits) {
      const title = (hit.item.title ?? "").toLowerCase();
      const id = (hit.item.id ?? "").toLowerCase();
      if (
        (title.includes(authorityKey) || id.includes(authorityKey)) &&
        (!sectionKey || title.includes(sectionKey) || id.includes(sectionKey))
      ) {
        return {
          citationId: citation.id,
          status: "verified",
          method: "offline-corpus",
          reason: `Matched store item by authority + section: ${hit.item.title}`,
          confidence: 0.85,
          evidence: {
            matchedAuthorityId: hit.item.id,
            matchedTitle: hit.item.title,
            matchedJurisdiction: hit.item.jurisdiction,
          },
          verifiedAt: now,
        };
      }
    }

    // No soft-hit path on BM25 score alone — a thin retrieval score
    // over an unrelated authority is exactly the kind of false-positive
    // that keeps lawyers from trusting AI verification. If the strict
    // substring path above didn't match, hand off to the URL-heuristic
    // verifier so the reviewer gets a CanLII link instead of a wrong
    // "verified" stamp.

    return {
      citationId: citation.id,
      status: "not-found",
      method: "offline-corpus",
      reason: "No offline-corpus match for this authority + section.",
      confidence: 0,
      verifiedAt: now,
    };
  }

  async verifyBatch(citations: VerifierCitation[]): Promise<VerificationResult[]> {
    return Promise.all(citations.map((c) => this.verify(c)));
  }
}

// ---------------------------------------------------------------------------
// CanLII URL heuristic verifier
// ---------------------------------------------------------------------------

const JURISDICTION_TO_CANLII: Record<string, string> = {
  federal: "ca",
  ontario: "on",
  quebec: "qc",
  "british-columbia": "bc",
  alberta: "ab",
  saskatchewan: "sk",
  manitoba: "mb",
  "nova-scotia": "ns",
  "new-brunswick": "nb",
  newfoundland: "nl",
  pei: "pe",
  "northwest-territories": "nt",
  yukon: "yk",
  nunavut: "nu",
};

/**
 * Build a candidate CanLII URL from a citation's metadata. Does not
 * fetch — the verifier's contribution is the URL itself, which is what
 * the reviewer will click to verify.
 *
 * Handles the three most common Canadian-authority shapes:
 *   - Cases: "2020 SCC 27" / "2020 ONCA 118" → /en/ca/scc/doc/2020/2020scc27/…
 *     When we have a parseable year + court + number.
 *   - National Instruments / CSA rules: constructed under /en/ca/laws/stat.
 *     We prefer the CanLII search URL for these since the exact URL
 *     slug is hard to guess.
 *   - Provincial statutes: /en/{prov}/laws/stat.
 *
 * Fallback: a CanLII keyword search URL built from the authorityId +
 * section. Still an actionable link for the reviewer.
 */
export function canliiCandidateUrl(citation: VerifierCitation): string {
  const prov = JURISDICTION_TO_CANLII[citation.jurisdiction ?? ""] ?? "ca";

  // Case citation, e.g. "2020 SCC 27", "2022 ONCA 118"
  const caseMatch = citation.authorityId.match(
    /^(\d{4})[\s-]+(SCC|ONCA|ONSC|ONKB|QCCA|QCCS|BCCA|BCSC|ABCA|ABKB|ABQB|FC|FCA|NSCA|NSSC)[\s-]+(\d+)$/i,
  );
  if (caseMatch) {
    const [, year, court, num] = caseMatch;
    const courtSlug = court!.toLowerCase();
    const courtFamily = courtSlug.startsWith("scc")
      ? "scc"
      : courtSlug.startsWith("fc")
        ? "fct"
        : courtSlug;
    return `https://www.canlii.org/en/${prov === "ca" ? "ca" : prov}/${courtFamily}/doc/${year}/${year}${courtSlug}${num}/${year}${courtSlug}${num}.html`;
  }

  // Default: CanLII search URL (always works, one click to verify).
  const q = encodeURIComponent(
    [citation.authorityId, citation.section].filter(Boolean).join(" "),
  );
  const lang = "en";
  return `https://www.canlii.org/${lang}/search/?type=all&text=${q}`;
}

export class CanliiUrlHeuristicVerifier implements CitationVerifier {
  async verify(citation: VerifierCitation): Promise<VerificationResult> {
    const url = canliiCandidateUrl(citation);
    return {
      citationId: citation.id,
      status: "candidate-url",
      method: "canlii-url-heuristic",
      reason:
        "Generated a candidate CanLII URL. Reviewer must click through to confirm the authority exists and supports the cited proposition.",
      confidence: 0.5,
      evidence: { url },
      verifiedAt: new Date().toISOString(),
    };
  }

  async verifyBatch(citations: VerifierCitation[]): Promise<VerificationResult[]> {
    return Promise.all(citations.map((c) => this.verify(c)));
  }
}

// ---------------------------------------------------------------------------
// Composite verifier — tries strategies in order, stops at "verified"
// ---------------------------------------------------------------------------

/**
 * Runs an ordered list of verifiers. Returns the first "verified"
 * result; otherwise returns the last result (typically "candidate-url"
 * from the URL heuristic, or "not-found" from an offline-only setup).
 *
 * Rationale: offline-corpus hits are the strongest signal — they mean
 * the authority is in our own seed, which is itself curated from
 * authoritative sources. When offline misses, we still want to hand
 * the reviewer a CanLII URL so the click-through is one step, not a
 * browser search.
 */
export class CompositeVerifier implements CitationVerifier {
  constructor(private readonly verifiers: readonly CitationVerifier[]) {}

  async verify(citation: VerifierCitation): Promise<VerificationResult> {
    let last: VerificationResult | null = null;
    for (const v of this.verifiers) {
      try {
        const result = await v.verify(citation);
        last = result;
        if (result.status === "verified") return result;
      } catch (err) {
        last = {
          citationId: citation.id,
          status: "error",
          method: "none",
          reason: err instanceof Error ? err.message : String(err),
          confidence: 0,
          verifiedAt: new Date().toISOString(),
        };
      }
    }
    return (
      last ?? {
        citationId: citation.id,
        status: "not-found",
        method: "none",
        reason: "No verifier registered.",
        confidence: 0,
        verifiedAt: new Date().toISOString(),
      }
    );
  }

  async verifyBatch(citations: VerifierCitation[]): Promise<VerificationResult[]> {
    return Promise.all(citations.map((c) => this.verify(c)));
  }
}

/**
 * Default verifier chain:
 *
 *   offline-corpus → [optional] canlii-live → canlii-url-heuristic
 *
 * Live CanLII fetching is opt-in via CANLII_FETCH_ENABLED so preview
 * deployments stay deterministic and free of external network calls.
 * When enabled, a URL candidate that actually resolves (and matches the
 * cited quote when one is supplied) gets the "verified" stamp; a fetch
 * failure falls through to the URL-heuristic "candidate-url" path.
 *
 * Composite is short-circuit on first "verified" — so an offline-corpus
 * hit never triggers a live fetch.
 */
export function defaultVerifier(
  store: CognitionStore,
  organizationId?: string,
): CitationVerifier {
  const verifiers: CitationVerifier[] = [new OfflineCorpusVerifier(store, organizationId)];
  if (canliiLiveFetchEnabled()) {
    verifiers.push(new CanliiLiveFetchVerifier());
  }
  verifiers.push(new CanliiUrlHeuristicVerifier());
  return new CompositeVerifier(verifiers);
}

/**
 * Batch summary — count per status. Handy for the API response and the
 * matter-page verifier badge.
 */
export interface VerificationSummary {
  total: number;
  verified: number;
  candidateUrl: number;
  unsupported: number;
  notFound: number;
  error: number;
}

export function summarizeVerifications(
  results: readonly VerificationResult[],
): VerificationSummary {
  const summary: VerificationSummary = {
    total: results.length,
    verified: 0,
    candidateUrl: 0,
    unsupported: 0,
    notFound: 0,
    error: 0,
  };
  for (const r of results) {
    switch (r.status) {
      case "verified":
        summary.verified += 1;
        break;
      case "candidate-url":
        summary.candidateUrl += 1;
        break;
      case "unsupported":
        summary.unsupported += 1;
        break;
      case "not-found":
        summary.notFound += 1;
        break;
      case "error":
        summary.error += 1;
        break;
    }
  }
  return summary;
}
