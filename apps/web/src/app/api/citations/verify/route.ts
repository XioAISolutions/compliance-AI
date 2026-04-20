/**
 * POST /api/citations/verify
 *
 * Verifies a batch of citations against the tenant's CognitionStore +
 * CanLII URL heuristics. Returns per-citation verification results and a
 * summary. Attempts to move citations from [NEEDS VERIFICATION] to
 * "verified" automatically — eliminating the fake-citation-embarrassment
 * risk that keeps lawyers from trusting AI-drafted filings.
 *
 * Request body:
 *   { matterId?: string, citations: VerifierCitation[] }
 *
 * Response body:
 *   { summary: VerificationSummary, results: VerificationResult[] }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  defaultVerifier,
  getDefaultCognitionStore,
  summarizeVerifications,
  type VerifierCitation,
} from "@compliance-ai/cognition";
import { getDefaultMatterStore } from "../../../../lib/matter-store";
import { getDefaultAuditStore, sha256 } from "../../../../lib/audit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface VerifyRequestBody {
  matterId?: string;
  citations: VerifierCitation[];
}

export async function POST(req: NextRequest) {
  let body: VerifyRequestBody;
  try {
    body = (await req.json()) as VerifyRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.citations)) {
    return NextResponse.json(
      { error: "`citations` must be an array" },
      { status: 400 },
    );
  }

  // Bound the batch size — prevents one runaway matter from pinning
  // retrieval. 100 citations is far more than any single review produces.
  if (body.citations.length > 100) {
    return NextResponse.json(
      { error: "`citations` capped at 100 per request" },
      { status: 400 },
    );
  }

  // If a matterId is supplied, scope verification to that matter's
  // organization so the tenant boundary is respected.
  let organizationId: string | undefined;
  if (body.matterId) {
    const matter = await getDefaultMatterStore().get(body.matterId);
    if (matter) organizationId = matter.organizationId;
  }

  const store = getDefaultCognitionStore();
  const verifier = defaultVerifier(store, organizationId);
  const results = await verifier.verifyBatch(body.citations);
  const summary = summarizeVerifications(results);

  // Audit: record the batch verification against the matter (when one
  // is supplied) so the audit chain shows which citations a reviewer
  // used verification-assist for, and the outcome.
  if (body.matterId) {
    const matter = await getDefaultMatterStore().get(body.matterId);
    if (matter) {
      const audit = getDefaultAuditStore();
      await audit.append(body.matterId, {
        matterId: body.matterId,
        organizationId: matter.organizationId,
        actor: "system",
        action: "retrieval",
        inputHash: sha256(
          JSON.stringify(body.citations.map((c) => `${c.id}:${c.authorityId}:${c.section}`)),
        ),
        authoritiesUsed: body.citations.map((c) => c.authorityId),
        outputHash: sha256(JSON.stringify(summary)),
        judgeVerdict: null,
        inputContent: `Citation verification run (${summary.total} citations)`,
        outputContent: `verified=${summary.verified} candidate-url=${summary.candidateUrl} not-found=${summary.notFound} error=${summary.error}`,
      });
    }
  }

  return NextResponse.json({ summary, results });
}
