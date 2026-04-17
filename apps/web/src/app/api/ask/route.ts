/**
 * Compliance Q&A API — POST /api/ask
 *
 * Question-driven (not matter-scoped) Q&A surface. Retrieves authorities
 * from one or more jurisdictions (default: CA + US), fuses the two
 * rankings with reciprocal-rank fusion, feeds the merged snippets into
 * the qa-responder persona, and streams the result as SSE.
 *
 * Why a separate route from /api/chat:
 *   - Different persona: the qa-responder enforces a dual-audience output
 *     shape (plain-language summary + professional answer) and a standing
 *     non-advice disclaimer. Routing to it through /api/chat would require
 *     polluting that route's shape with jurisdiction / audience params
 *     that have no meaning for control-anchored chat.
 *   - Different retrieval: /api/chat does one scoped retrieval; /api/ask
 *     runs N jurisdictional retrievals and fuses them.
 *   - Different audit semantics: Q&A entries use a synthetic `qa:<org>`
 *     matterId so they audit-chain together without polluting any real
 *     matter's log.
 *
 * Response shape (SSE events, one per frame, `data: <json>\n\n`):
 *   - persona-selected  — always "qa-responder" (force-selected)
 *   - text-delta        — streaming prose from the model
 *   - done              — terminal; carries token usage
 *   - qa-summary        — route-local synthesis: confidence, divergence
 *                         flag, citations grouped by jurisdiction. Emitted
 *                         once after the model's `done`, before the stream
 *                         closes.
 *   - error             — any failure; stream is still closed cleanly
 */

import { NextRequest } from "next/server";
import {
  parseModelOutput,
  runAgent,
  type AgentContext,
  type RetrievedSnippet,
} from "@compliance-ai/agents";
import type { FrameworkId } from "@compliance-ai/frameworks";
import { getDefaultCognitionStore, rrfFuse, type RetrievalResult } from "@compliance-ai/cognition";
import { getSession } from "../../../lib/auth";
import { ensureTenant } from "../../../lib/bootstrap";
import { getDefaultAuditStore, sha256 } from "../../../lib/audit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Supported top-level jurisdictions exposed to the API caller. */
type Jurisdiction = "CA" | "US";

/**
 * Map the public-API jurisdiction label onto the tag used inside cognition
 * store items. Canadian items were ingested from the NI 45-106 consolidation
 * with `jurisdiction: "ontario"` (subnational); the route exposes them under
 * "CA" so the frontend can treat Canada as a single bucket.
 */
const JURISDICTION_TAG: Record<Jurisdiction, string> = {
  CA: "ontario",
  US: "US",
};

interface AskRequestBody {
  question: string;
  jurisdictions?: Jurisdiction[];
  framework?: FrameworkId;
  audience?: "professional" | "public";
  /** Cognition top-k per jurisdiction. Default 6. */
  topK?: number;
}

const DEFAULT_JURISDICTIONS: Jurisdiction[] = ["CA", "US"];
const DEFAULT_TOP_K = 6;
const DEFAULT_SCORE_THRESHOLD = 0.05;
const ALL_FRAMEWORKS: FrameworkId[] = ["soc2", "gdpr", "eu-ai-act", "iso-27001"];

function toRetrievedSnippet(result: RetrievalResult): RetrievedSnippet {
  return {
    id: result.item.id ?? "",
    title: result.item.title,
    content: result.item.content,
    source: result.item.source,
    score: result.score,
  };
}

function sseFrame(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Fuse per-jurisdiction rankings with RRF. Input: for each jurisdiction,
 * a ranked list of RetrievalResult (index 0 = top hit). Output: a single
 * merged list of RetrievalResult, re-ordered by fused score, preserving
 * each item's ORIGINAL per-jurisdiction score in `.score` so the UI can
 * show it honestly. The fused score is used for ordering only.
 */
function fuseJurisdictionResults(
  perJurisdiction: Map<Jurisdiction, RetrievalResult[]>,
): RetrievalResult[] {
  const rankings = Array.from(perJurisdiction.values()).map((results) =>
    results.map((r, i) => ({ id: r.item.id ?? "", rank: i + 1 })),
  );

  // rrfFuse takes exactly two rankings. If we only have one jurisdiction,
  // pass it twice — an item at rank r in both copies just gets double
  // weight, and ORDER is preserved, which is what we want for the
  // single-jurisdiction degenerate case.
  const a = rankings[0] ?? [];
  const b = rankings[1] ?? rankings[0] ?? [];
  const fusedScores = rrfFuse(a, b);

  // Build a lookup of every item that appeared in any jurisdiction.
  const byId = new Map<string, RetrievalResult>();
  for (const results of perJurisdiction.values()) {
    for (const r of results) {
      const id = r.item.id ?? "";
      // Keep the highest per-jurisdiction score if duplicates appear
      // (shouldn't happen with disjoint jurisdiction tags, but be safe).
      const existing = byId.get(id);
      if (!existing || r.score > existing.score) byId.set(id, r);
    }
  }

  return [...fusedScores.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([id]) => byId.get(id))
    .filter((r): r is RetrievalResult => r !== undefined);
}

/**
 * Group docIds by jurisdiction using the retrieval result set as the
 * authoritative source of (docId → jurisdiction) — this is the cheapest way
 * to get jurisdiction for an arbitrary docId without another store call.
 * The `keep` filter controls which docIds end up in the output (e.g. "only
 * docs the model actually cited").
 */
function groupByJurisdiction(
  retrieved: RetrievalResult[],
  keep: (docId: string) => boolean,
): { CA: string[]; US: string[] } {
  const out: { CA: string[]; US: string[] } = { CA: [], US: [] };
  for (const r of retrieved) {
    const id = r.item.id;
    if (!id || !keep(id)) continue;
    if (r.item.jurisdiction === "US") out.US.push(id);
    else if (r.item.jurisdiction === "ontario") out.CA.push(id);
  }
  return out;
}

/**
 * Build the terminal `qa-summary` event from the MODEL'S ACTUAL OUTPUT
 * (not just raw retrieval). This is the single source of truth for what
 * the UI shows:
 *
 *   - `citationsByJurisdiction` lists only docs the model actually cited
 *     (intersection of retrieval ∩ citation fence). If the model refused
 *     or emitted no fence, these are empty.
 *   - `crossJurisdictionNote` is true only when the model CITED ≥1 CA and
 *     ≥1 US authority — we defer to the model's judgment about which
 *     authorities mattered, instead of flagging divergence just because
 *     retrieval happened to pull items from both sides.
 *   - `confidence` combines retrieval scores with output-side signals: a
 *     RETRIEVAL GAP notice or zero cited markers collapses confidence to
 *     ≤ 0.1, reflecting the honest posture "retrieval matched something
 *     lexically but the model couldn't use it". When citations exist,
 *     confidence is the mean of the TOP CITED items' retrieval scores,
 *     with the ≥2-items bonus preserved from the original heuristic.
 *
 * TODO(confidence): this formula is a reasonable default, not a calibrated
 * one. Places the owner may want to tune:
 *   - Weight by jurisdiction coverage (cross-jurisdiction → +bonus?)
 *   - Use cited-item RAW BM25 scores instead of normalized
 *   - Factor in cited-marker count vs. citation-fence-entries parity
 */
function buildSummary(
  proseBuffer: string,
  fusedTop: RetrievalResult[],
): {
  confidence: number;
  crossJurisdictionNote: boolean;
  citationsByJurisdiction: { CA: string[]; US: string[] };
} {
  const parsed = parseModelOutput(proseBuffer);
  const citedDocIds = new Set(parsed.citations.map((c) => c.docId));
  const retrievalGapDetected = /RETRIEVAL\s+GAP/i.test(proseBuffer);
  const markerCount = (proseBuffer.match(/\[c\d+\]/g) ?? []).length;

  const by = groupByJurisdiction(fusedTop, (id) => citedDocIds.has(id));
  const crossJurisdictionNote = by.CA.length > 0 && by.US.length > 0;

  // Confidence base: mean of the cited items' retrieval scores. When no
  // citations, fall back to the retrieval top-3 (but we'll cap below).
  const citedResults = fusedTop.filter((r) => r.item.id && citedDocIds.has(r.item.id));
  const baseSource = citedResults.length > 0 ? citedResults.slice(0, 3) : fusedTop.slice(0, 3);
  const mean =
    baseSource.length > 0 ? baseSource.reduce((s, r) => s + r.score, 0) / baseSource.length : 0;
  const coverageBonus = citedResults.length >= 2 ? 1 : 0.5;
  let confidence = Math.max(0, Math.min(1, mean * coverageBonus));

  // Output-side penalties — the model told us the retrieval didn't fit.
  if (retrievalGapDetected || markerCount === 0 || citedResults.length === 0) {
    confidence = Math.min(confidence, 0.1);
  }

  return { confidence, crossJurisdictionNote, citationsByJurisdiction: by };
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  const organizationId = session?.organizationId ?? "preview";
  const userId = session?.user.id ?? "anonymous";

  let body: AskRequestBody;
  try {
    body = (await req.json()) as AskRequestBody;
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question) {
    return new Response("`question` is required", { status: 400 });
  }

  const jurisdictions =
    Array.isArray(body.jurisdictions) && body.jurisdictions.length > 0
      ? body.jurisdictions.filter((j): j is Jurisdiction => j === "CA" || j === "US")
      : DEFAULT_JURISDICTIONS;

  if (jurisdictions.length === 0) {
    return new Response("`jurisdictions` must contain at least one of: CA, US", { status: 400 });
  }

  const framework = body.framework;
  const topK = body.topK ?? DEFAULT_TOP_K;

  // Seed the tenant corpus if this is the first hit. Safe to call every
  // request — idempotent via a Set-of-seen-tenants in bootstrap.ts.
  await ensureTenant(organizationId, "securities");

  // ---- Parallel per-jurisdiction retrieval -------------------------------
  const store = getDefaultCognitionStore("securities");
  const perJurisdiction = new Map<Jurisdiction, RetrievalResult[]>();
  try {
    const retrievals = await Promise.all(
      jurisdictions.map(async (j) => {
        const results = await store.retrieve({
          query: question,
          topK,
          organizationId,
          framework,
          jurisdiction: JURISDICTION_TAG[j],
          searchMode: "hybrid",
          scoreThreshold: DEFAULT_SCORE_THRESHOLD,
        });
        return [j, results] as const;
      }),
    );
    for (const [j, r] of retrievals) perJurisdiction.set(j, r);
  } catch {
    // Retrieval failure must not block generation. Fall through with empty
    // snippets; the persona's empty-retrieval branch will take over.
    for (const j of jurisdictions) perJurisdiction.set(j, []);
  }

  // Fuse rankings and take the top-K for the prompt context. We cap at
  // 2 * topK to keep the context block bounded even when both jurisdictions
  // return a full topK of disjoint items.
  const fusedTop = fuseJurisdictionResults(perJurisdiction).slice(0, topK * 2);
  const retrievedSnippets = fusedTop.map(toRetrievedSnippet);

  const context: AgentContext = {
    control: null,
    frameworkScope: framework ? [framework] : ALL_FRAMEWORKS,
    organizationId,
    retrievedSnippets,
  };

  const auditMatterId = `qa:${organizationId}`;
  const inputHash = sha256(question);
  const authoritiesUsed = fusedTop.map((r) => r.item.id ?? "").filter(Boolean);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let proseBuffer = "";

      try {
        const generator = runAgent(context, [], question, {
          forcePersona: "qa-responder",
        });

        for await (const event of generator) {
          // Capture prose so we can hash the final output for the audit log.
          if (event.type === "text-delta") proseBuffer += event.delta;
          controller.enqueue(encoder.encode(sseFrame(event)));

          // Emit the route's terminal summary right after the model's done
          // event, before we close. We keep this emission inside the loop
          // so it sits at the correct position in the SSE stream.
          if (event.type === "done") {
            // Build the summary from the ACTUAL model output: parse the
            // citations fence and reconcile retrieved vs. cited items.
            // Keeps the summary honest when the model refuses or the
            // retrieval matched lexically but the model couldn't use it.
            const summary = {
              type: "qa-summary" as const,
              ...buildSummary(proseBuffer, fusedTop),
            };
            controller.enqueue(encoder.encode(sseFrame(summary)));
          }
        }

        // Audit after the stream has fully run — one row per /ask call.
        try {
          await getDefaultAuditStore().append(auditMatterId, {
            matterId: auditMatterId,
            organizationId,
            actor: userId,
            action: "query",
            inputHash,
            authoritiesUsed,
            outputHash: proseBuffer ? sha256(proseBuffer) : null,
            judgeVerdict: null,
            inputContent: question,
            outputContent: proseBuffer || null,
          });
        } catch {
          // Audit failure must not break the response — log silently and move on.
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(sseFrame({ type: "error", message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
