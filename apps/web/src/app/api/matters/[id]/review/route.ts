/**
 * OM Review API — POST /api/matters/[id]/review
 *
 * Runs the OM reviewer persona through the judge loop and streams SSE
 * events. Seeds the cognition store with Ontario/EMD authorities on
 * first call, then retrieves relevant snippets filtered by the matter's
 * jurisdiction and registration category.
 *
 * Also writes audit trail entries for each phase (query, retrieval,
 * generation, verdict).
 */

import { NextRequest } from "next/server";
import {
  runAgentLoop,
  type AgentContext,
  type PersonaId,
  type RetrievedSnippet,
  type ReviewSubject,
} from "@compliance-ai/agents";
import { getDefaultCognitionStore, type RetrievalResult } from "@compliance-ai/cognition";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";
import { getDefaultAuditStore, sha256 } from "../../../../../lib/audit-store";
import { ensureTenant } from "../../../../../lib/bootstrap";
import {
  getDefaultEvidenceStore,
  extractEvidenceRequests,
} from "../../../../../lib/evidence-store";
import { requireSession } from "../../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TOP_K = 6;
const DEFAULT_SCORE_THRESHOLD = 0.02;

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

/** Map matter task type → the drafter persona that specializes in it. */
function personaForTask(taskType: string): PersonaId {
  switch (taskType) {
    case "om-review":
      return "om-reviewer";
    case "kyc-gap-check":
      return "kyc-reviewer";
    case "marketing-signoff":
      return "marketing-reviewer";
    case "response-memo":
      return "response-memo-drafter";
    default:
      return "om-reviewer";
  }
}

const DOC_TYPE_LABELS: Record<string, string> = {
  "authority-rule": "authority rule",
  "regulatory-guidance": "regulatory guidance",
  "offering-memo": "offering memorandum",
  "kyc-aml-file": "client KYC/AML file",
  "marketing-material": "marketing material",
  "reference-material": "reference material",
  other: "document",
};

/**
 * Pick the most relevant uploaded document for a given task type and
 * assemble it into a ReviewSubject. Returns null if no documents exist.
 *
 * Matching strategy:
 *   - om-review → prefer offering-memo docs
 *   - kyc-gap-check → prefer kyc-aml-file
 *   - marketing-signoff → prefer marketing-material
 *   - response-memo → prefer regulatory-guidance or other (for the inquiry)
 * Falls back to the most recently uploaded document if no type matches.
 *
 * Truncates the chunk list if the total content exceeds ~25k tokens to leave
 * headroom for the persona prompt + retrieved authorities + output.
 */
async function buildReviewSubject(
  matterId: string,
  taskType: string,
): Promise<ReviewSubject | null> {
  const store = getDefaultMatterStore();
  const documents = await store.getDocuments(matterId);
  if (documents.length === 0) return null;

  const preferredType: Record<string, string[]> = {
    "om-review": ["offering-memo"],
    "kyc-gap-check": ["kyc-aml-file"],
    "marketing-signoff": ["marketing-material"],
    "response-memo": ["regulatory-guidance", "other"],
  };

  const preferred = preferredType[taskType] ?? [];
  const match =
    documents.find((d) => preferred.includes(d.documentType)) ??
    // Most recent upload as fallback
    documents[documents.length - 1]!;

  const chunks = await store.getChunksByDoc(match.id);
  if (chunks.length === 0) return null;

  // Token budget: cap subject chunks at ~25k tokens so authorities + output
  // have room. Chunks sorted by ordinal; truncate tail if needed.
  const MAX_TOKENS = 25_000;
  const ordered = [...chunks].sort((a, b) => a.ordinal - b.ordinal);
  const selected: typeof ordered = [];
  let tokens = 0;
  for (const c of ordered) {
    if (tokens + c.tokenCount > MAX_TOKENS && selected.length > 0) break;
    selected.push(c);
    tokens += c.tokenCount;
  }

  const subject: ReviewSubject = {
    documentId: match.id,
    documentType: DOC_TYPE_LABELS[match.documentType] ?? match.documentType,
    title: match.filename,
    chunks: selected.map((c) => ({
      chunkId: c.id,
      ordinal: c.ordinal,
      ...(c.page !== undefined ? { page: c.page } : {}),
      content: c.content,
    })),
  };

  return subject;
}

const TASK_PROMPTS_WITH_SUBJECT: Record<string, string> = {
  "om-review": `Review the offering memorandum under review (see the "Document under review" block above) for compliance with Ontario securities rules.

Produce the full structured output as specified in your instructions:
1. Required Disclosures Checklist (table with Status: FOUND / PARTIAL / MISSING)
2. Gap Memo (paragraph per PARTIAL/MISSING item with rule citations)
3. Risk Flags (forward-looking statements, missing rights of action, marketing claims)

For each finding, cite the relevant authority using [c1], [c2] markers. When you point to a specific passage IN THE OM, also cite the chunkId (e.g., "per OM chunk ch-1a2b3c4d the issuer states..."). Be thorough — this memo will be reviewed by a CCO.`,

  "kyc-gap-check": `Review the client file under review (see the "Document under review" block above) for KYC/AML compliance gaps under NI 31-103 Part 13 and FINTRAC requirements.

For each required KYC element (identity, source of funds, PEP screening, suitability, relationship disclosure), assess whether the file is complete, incomplete, or missing. Cite the specific regulatory requirement for each gap found, and quote the chunkId where evidence is present or absent.`,

  "marketing-signoff": `Review the marketing material under review (see the "Document under review" block above) for compliance with NI 81-102 Part 15 (sales communications and prohibited representations).

Flag any misleading statements, missing risk disclosures, or prohibited representations. For each flag, quote the chunkId of the problematic text, cite the specific rule, and suggest corrective language.`,

  "response-memo": `Draft a response memo addressing the regulatory inquiry described in the "Document under review" block above.

Structure the response point-by-point, addressing each concern raised. Cite supporting authorities using [c1], [c2] markers. Reference specific chunkIds from the inquiry when quoting back concerns.`,
};

// Fallback prompts when no document has been uploaded yet. Instructs the
// reviewer to ask the user to upload, rather than hallucinating a review.
const TASK_PROMPTS_NO_SUBJECT: Record<string, string> = {
  "om-review": `No offering memorandum has been uploaded to this matter yet. Respond with a brief message asking the user to drop an OM PDF or DOCX into the Documents zone on the left, and then start the review.`,
  "kyc-gap-check": `No client file has been uploaded to this matter yet. Ask the user to upload the client KYC/AML file to begin the gap check.`,
  "marketing-signoff": `No marketing material has been uploaded to this matter yet. Ask the user to upload the marketing document (deck, brochure, one-pager) to begin the sign-off review.`,
  "response-memo": `No inquiry or deficiency letter has been uploaded to this matter yet. Ask the user to upload the regulator's letter so the response can be drafted against its specific points.`,
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }
  const organizationId = session.organizationId;

  const matterStore = getDefaultMatterStore();
  const matter = await matterStore.get(matterId);

  if (!matter) {
    return new Response("Matter not found", { status: 404 });
  }

  let body: { taskType?: string } = {};
  try {
    body = (await req.json()) as { taskType?: string };
  } catch {
    // Use matter's task type
  }

  const taskType = body.taskType ?? matter.taskType;

  // Build the review subject from the matter's uploaded document chunks.
  // If no document has been uploaded, fall through to the no-subject prompt.
  const reviewSubject = await buildReviewSubject(matterId, taskType);
  const userMessage = reviewSubject
    ? TASK_PROMPTS_WITH_SUBJECT[taskType] ?? TASK_PROMPTS_WITH_SUBJECT["om-review"]!
    : TASK_PROMPTS_NO_SUBJECT[taskType] ?? TASK_PROMPTS_NO_SUBJECT["om-review"]!;

  // Seed authorities for this tenant (idempotent)
  await ensureTenant(matter.organizationId);

  // Retrieve relevant snippets filtered by matter scope. When a subject is
  // present, use the document content as the retrieval query so authorities
  // most relevant to the OM's topics come back.
  const cognitionStore = getDefaultCognitionStore();
  const retrievalQuery = reviewSubject
    ? reviewSubject.chunks.map((c) => c.content).join(" ").slice(0, 2000)
    : userMessage;
  let retrievedSnippets: RetrievedSnippet[] = [];
  try {
    const results = await cognitionStore.retrieve({
      query: retrievalQuery,
      topK: DEFAULT_TOP_K,
      organizationId: organizationId,
      scoreThreshold: DEFAULT_SCORE_THRESHOLD,
      jurisdiction: matter.jurisdiction,
      registrationCategory: matter.registrationCategory,
    });
    retrievedSnippets = results.map(toRetrievedSnippet);
  } catch {
    retrievedSnippets = [];
  }

  // Write audit entry for the query
  const auditStore = getDefaultAuditStore();
  await auditStore.append(matterId, {
    matterId,
    organizationId: organizationId,
    actor: "om-reviewer",
    action: "query",
    inputHash: sha256(userMessage),
    authoritiesUsed: retrievedSnippets.map((s) => s.id),
    outputHash: null,
    judgeVerdict: null,
    inputContent: userMessage,
    outputContent: null,
  });

  // Write audit entry for retrieval
  if (retrievedSnippets.length > 0) {
    await auditStore.append(matterId, {
      matterId,
      organizationId: organizationId,
      actor: "system",
      action: "retrieval",
      inputHash: sha256(userMessage),
      authoritiesUsed: retrievedSnippets.map((s) => s.id),
      outputHash: sha256(retrievedSnippets.map((s) => s.title).join(",")),
      judgeVerdict: null,
      inputContent: `Retrieved ${retrievedSnippets.length} authorities for ${matter.jurisdiction} / ${matter.registrationCategory}`,
      outputContent: retrievedSnippets.map((s) => s.title).join("\n"),
    });
  }

  // Build agent context (framework-agnostic — we're in securities mode).
  // Include the document under review when present.
  const context: AgentContext = {
    control: null,
    frameworkScope: [],
    organizationId: organizationId,
    retrievedSnippets,
    ...(reviewSubject ? { reviewSubject } : {}),
  };

  // Update matter status
  await matterStore.updateStatus(matterId, "in-review");

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullOutput = "";
      let lastVerdict: string | null = null;
      let rounds = 0;

      try {
        const generator = runAgentLoop(context, userMessage, {
          maxRounds: 3,
          drafterPersona: personaForTask(taskType),
        });

        for await (const event of generator) {
          controller.enqueue(encoder.encode(sseFrame(event)));

          // Track output and verdict for audit
          if (event.type === "text-delta") {
            fullOutput += event.delta;
          } else if (event.type === "verdict-final") {
            lastVerdict = event.verdict;
          } else if (event.type === "loop-done") {
            rounds = event.totalRounds;
            if (event.finalVerdict) lastVerdict = event.finalVerdict;
          }
        }

        // Write generation audit entry
        await auditStore.append(matterId, {
          matterId,
          organizationId: organizationId,
          actor: personaForTask(taskType),
          action: "generation",
          inputHash: sha256(userMessage),
          authoritiesUsed: retrievedSnippets.map((s) => s.id),
          outputHash: sha256(fullOutput),
          judgeVerdict: lastVerdict,
          inputContent: `${rounds} round(s) via judge loop`,
          outputContent: fullOutput.slice(0, 2000),
        });

        // Auto-generate evidence requests from PARTIAL / MISSING checklist rows
        const evidenceStore = getDefaultEvidenceStore();
        const extracted = extractEvidenceRequests(fullOutput);
        for (const req of extracted) {
          await evidenceStore.create(
            {
              matterId,
              ...req,
            },
            matter.organizationId,
          );
        }
        if (extracted.length > 0) {
          await auditStore.append(matterId, {
            matterId,
            organizationId: organizationId,
            actor: "system",
            action: "retrieval",
            inputHash: sha256(fullOutput),
            authoritiesUsed: [],
            outputHash: sha256(extracted.map((r) => r.title).join(",")),
            judgeVerdict: null,
            inputContent: `Auto-extracted ${extracted.length} evidence requests from review output`,
            outputContent: extracted.map((r) => `- ${r.title}`).join("\n"),
          });
        }

        // Update matter status based on verdict
        if (lastVerdict === "READY_TO_SUBMIT") {
          await matterStore.updateStatus(matterId, "complete");
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
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
