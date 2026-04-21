/**
 * CanliiLiveFetchVerifier — confirms a candidate CanLII URL resolves and
 * (when possible) that the cited text appears on the page.
 *
 * Activation: the verifier is inert unless process.env.CANLII_FETCH_ENABLED
 * is a truthy string ("1", "true", "yes"). This keeps preview deployments
 * deterministic and free of external dependencies by default. When the
 * flag is on, the verifier is composed after the URL-heuristic verifier
 * in the default chain — so URL candidates that actually resolve turn
 * from "candidate-url" to "verified".
 *
 * Design notes:
 *
 *   - Rate limit: one request per citation, 10s per-request timeout.
 *     We batch sequentially (not in parallel) when invoked via
 *     verifyBatch to avoid blasting canlii.org.
 *   - Error handling: any thrown error (network, timeout, non-2xx)
 *     downgrades to "unsupported" so the composite falls back to the
 *     URL-heuristic's "candidate-url". The user still gets a clickable
 *     link; they just don't get the auto-verified stamp.
 *   - Quote check: when the citation has a quote >= 20 chars, we do a
 *     case-insensitive substring search against the fetched body text.
 *     A miss downgrades the status to "candidate-url" — the URL is real
 *     but the specific text wasn't found on that page, which is a red
 *     flag worth surfacing. Below 20 chars the quote is too
 *     collision-prone to assert on (common words like "notice" appear on
 *     every page).
 *
 * The verifier is explicitly scoped to canlii.org hosts — we do NOT
 * follow redirects off-domain, and we reject any URL that isn't under
 * https://www.canlii.org. This prevents a poisoned
 * CanliiUrlHeuristicVerifier result from sending fetch traffic elsewhere.
 */

import type {
  CitationVerifier,
  VerificationResult,
  VerifierCitation,
} from "./citation-verifier.js";
import { canliiCandidateUrl } from "./citation-verifier.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const CANLII_HOST = "www.canlii.org";
const MIN_QUOTE_LEN = 20;

/**
 * Returns true when the operator has explicitly enabled live CanLII
 * lookups. Kept narrow — a "true" / "1" / "yes" env var is intentional
 * opt-in, not accidental.
 */
export function canliiLiveFetchEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = (env.CANLII_FETCH_ENABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

interface FetchLike {
  (
    input: string,
    init?: { signal?: AbortSignal; redirect?: "follow" | "manual" | "error" },
  ): Promise<{ ok: boolean; status: number; text: () => Promise<string>; url: string }>;
}

export interface CanliiLiveFetchOptions {
  timeoutMs?: number;
  /** Override for tests — defaults to globalThis.fetch. */
  fetchImpl?: FetchLike;
  /** Custom URL builder — defaults to canliiCandidateUrl(). */
  urlFor?: (c: VerifierCitation) => string;
}

export class CanliiLiveFetchVerifier implements CitationVerifier {
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchLike;
  private readonly urlFor: (c: VerifierCitation) => string;

  constructor(opts: CanliiLiveFetchOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
    this.urlFor = opts.urlFor ?? canliiCandidateUrl;
  }

  async verify(citation: VerifierCitation): Promise<VerificationResult> {
    const now = () => new Date().toISOString();
    const url = this.urlFor(citation);

    // Host-allowlist guard: we only ever fetch canlii.org. A poisoned or
    // drifted URL builder that points elsewhere gets downgraded here.
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return {
        citationId: citation.id,
        status: "unsupported",
        method: "canlii-live",
        reason: `URL builder returned an unparseable URL: ${url}`,
        confidence: 0,
        evidence: { url },
        verifiedAt: now(),
      };
    }
    if (parsed.host !== CANLII_HOST) {
      return {
        citationId: citation.id,
        status: "unsupported",
        method: "canlii-live",
        reason: `Refusing live fetch off-host: ${parsed.host}`,
        confidence: 0,
        evidence: { url },
        verifiedAt: now(),
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        signal: controller.signal,
        redirect: "manual",
      });
      clearTimeout(timer);
      if (!res.ok) {
        return {
          citationId: citation.id,
          status: "candidate-url",
          method: "canlii-live",
          reason: `CanLII returned HTTP ${res.status}. URL is the heuristic's candidate; click through to verify.`,
          confidence: 0.4,
          evidence: { url },
          verifiedAt: now(),
        };
      }
      const body = await res.text();
      // If the caller supplied a long-enough quote, do a case-insensitive
      // substring check. A hit gives us "verified" with confidence 0.95;
      // a miss keeps the URL but flags the quote mismatch.
      const quote = (citation.quote ?? "").trim();
      if (quote.length >= MIN_QUOTE_LEN) {
        const normalized = body.replace(/\s+/g, " ").toLowerCase();
        const needle = quote.replace(/\s+/g, " ").toLowerCase();
        if (normalized.includes(needle)) {
          return {
            citationId: citation.id,
            status: "verified",
            method: "canlii-live",
            reason: "CanLII page fetched and cited quote found on the page.",
            confidence: 0.95,
            evidence: { url },
            verifiedAt: now(),
          };
        }
        return {
          citationId: citation.id,
          status: "candidate-url",
          method: "canlii-live",
          reason:
            "CanLII page fetched but the cited quote (>= 20 chars) was not found on the page. Likely a pinpoint or wording drift — verify manually.",
          confidence: 0.35,
          evidence: { url },
          verifiedAt: now(),
        };
      }
      // No quote check possible — still upgrade "URL resolves" to
      // verified-at-the-URL level. Confidence below the quote-hit path.
      return {
        citationId: citation.id,
        status: "verified",
        method: "canlii-live",
        reason:
          "CanLII page fetched successfully. Quote too short to auto-match; reviewer should spot-check the pinpoint.",
        confidence: 0.8,
        evidence: { url },
        verifiedAt: now(),
      };
    } catch (err) {
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : String(err);
      // Network / timeout / abort → keep the URL, flag the miss.
      return {
        citationId: citation.id,
        status: "candidate-url",
        method: "canlii-live",
        reason: `CanLII live fetch failed (${message}). Reviewer verifies via the URL manually.`,
        confidence: 0.3,
        evidence: { url },
        verifiedAt: now(),
      };
    }
  }

  async verifyBatch(citations: VerifierCitation[]): Promise<VerificationResult[]> {
    // Sequential on purpose — we don't want to fire N parallel requests
    // at canlii.org for a single matter with 20 citations. The cost is
    // latency; we accept it because the verifier runs on-demand after a
    // review completes, not in the hot path of an interactive request.
    const out: VerificationResult[] = [];
    for (const c of citations) {
      out.push(await this.verify(c));
    }
    return out;
  }
}
