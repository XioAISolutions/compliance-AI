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
import { runAgent, type AgentContext, type RetrievedSnippet } from "@compliance-ai/agents";
import type { FrameworkId } from "@compliance-ai/frameworks";
import {
  getDefaultCognitionStore,
  rrfFuse,
  type CognitionItem,
  type RetrievalResult,
} from "@compliance-ai/cognition";
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
 * Confidence heuristic: mean of the top-3 per-jurisdiction scores, halved
 * when fewer than 2 snippets made the cut. The halving encodes "a single
 * authority is never enough to be confident" — for a cross-border Q&A
 * answer, we want ≥1 from each jurisdiction or ≥2 from one.
 */
function computeConfidence(topResults: RetrievalResult[]): number {
  if (topResults.length === 0) return 0;
  const top3 = topResults.slice(0, 3);
  const mean = top3.reduce((s, r) => s + r.score, 0) / top3.length;
  const penalty = topResults.length >= 2 ? 1 : 0.5;
  return Math.max(0, Math.min(1, mean * penalty));
}

/** Group cited items by jurisdiction for the terminal summary event. */
function citationsByJurisdiction(items: CognitionItem[]): { CA: string[]; US: string[] } {
  const out: { CA: string[]; US: string[] } = { CA: [], US: [] };
  for (const item of items) {
    if (!item.id) continue;
    if (item.jurisdiction === "US") out.US.push(item.id);
    else if (item.jurisdiction === "ontario") out.CA.push(item.id);
  }
  return out;
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

  // Divergence heuristic: if the top fused set carries ≥1 item from each
  // jurisdiction, the persona gets invited to write a Cross-jurisdiction
  // note. This is a PRESENCE flag — the persona decides whether the two
  // positions actually diverge; we just hand it the raw material.
  const byJurisdiction = citationsByJurisdiction(fusedTop.map((r) => r.item));
  const crossJurisdictionNote = byJurisdiction.CA.length > 0 && byJurisdiction.US.length > 0;

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
            const summary = {
              type: "qa-summary" as const,
              confidence: computeConfidence(fusedTop),
              crossJurisdictionNote,
              citationsByJurisdiction: byJurisdiction,
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
