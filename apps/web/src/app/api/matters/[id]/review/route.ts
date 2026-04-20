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
  getRetrievalPlan,
  parseModelOutput,
  runAgent,
  runAgentLoop,
  validateCitations,
  type AgentContext,
  type Citation,
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
import { applyEvent, finalizeReview, newReviewStreamState } from "../../../../../lib/review-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_TOP_K = 8;
/**
 * Per-query top-K when we're running the OM reviewer's multi-query retrieval
 * plan. Each plan query targets one authority cluster (e.g., Form F4, s.
 * 130.1, NI 45-102 resale), so 4 is enough per query. The union across
 * ~18 plan queries gives the reviewer a much richer authority deck than a
 * single 8-snippet BM25 pass against the OM text, which biases toward
 * issuer-specific vocabulary and against the rule-text items the reviewer
 * actually needs to cite.
 */
const PLAN_PER_QUERY_TOP_K = 4;
/**
 * Ceiling on the merged authority deck handed to the model. ~40 covers the
 * full set of checklist, gap-memo, risk-flag, resale, and post-filing
 * authorities the reviewer persona expects without overwhelming the prompt
 * budget. If the plan + document-content fallback surface fewer than this,
 * we pass what we have.
 */
const MAX_MERGED_SNIPPETS = 40;
// Threshold kept near zero: BM25 + RRF normalization returns scores on [0,1],
// and for a broad query against a well-populated corpus the top-K items tend
// to land between 0.1 and 1.0. Anything above zero is a positive lexical
// match — trust topK to cap the list rather than an arbitrary floor that
// silently starves the reviewer of authorities when the query happens to
// normalize tightly.
const DEFAULT_SCORE_THRESHOLD = 0;

function toRetrievedSnippet(result: RetrievalResult): RetrievedSnippet {
  return {
    id: result.item.id ?? "",
    title: result.item.title,
    content: result.item.content,
    source: result.item.source,
    score: result.score,
  };
}

interface RetrievalCoverage {
  taskType: string;
  snippetCount: number;
  jurisdiction: string;
  registrationCategory: string;
  /** Plan length, or 0 if no plan was registered for this task type. */
  plannedQueries: number;
  /** How many of the plan queries returned at least one hit. */
  queriesWithHits: number;
}

/**
 * Audit-log note for the retrieval phase. Includes plan coverage so a
 * reviewer or operator can spot a starvation regression — if `2/12 plan
 * queries returned hits` then the corpus is stale, the seed bootstrap is
 * misconfigured, or the jurisdiction filter is blocking results.
 */
function buildRetrievalCoverageNote(c: RetrievalCoverage): string {
  const head = `Retrieved ${c.snippetCount} authorities for ${c.jurisdiction} / ${c.registrationCategory} (task=${c.taskType})`;
  if (c.plannedQueries === 0) return `${head}; single-pass retrieval (no plan registered)`;
  const pct = Math.round((c.queriesWithHits / c.plannedQueries) * 100);
  return `${head}; plan coverage ${c.queriesWithHits}/${c.plannedQueries} (${pct}%) plan queries with hits`;
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
    case "court-ai-disclosure":
      return "court-ai-disclosure-drafter";
    case "missing-authority-scan":
      return "missing-authority-scanner";
    case "pipeda-check":
      return "pipeda-reviewer";
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
    // Court AI-disclosure runs over the matter's substantive output, not a
    // newly uploaded document. The handler still tries to assemble a
    // ReviewSubject for compatibility, so we fall through to the most
    // recent upload if present.
    "court-ai-disclosure": ["other", "regulatory-guidance"],
    // Missing-authority scan runs against the matter's existing output +
    // citations; the document under review, if any, is the review draft.
    "missing-authority-scan": ["other", "regulatory-guidance"],
    // PIPEDA review runs over an uploaded privacy policy, incident-response
    // plan, consent form, or vendor DPA. All tagged as regulatory-guidance
    // or other in the existing document-type taxonomy.
    "pipeda-check": ["regulatory-guidance", "other"],
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

  "court-ai-disclosure": `Draft an AI-use disclosure memo to accompany the filed material described in the "Document under review" block above (or, if no filing draft has been uploaded, for the substantive output the matter already contains).

Produce the full structured output: (1) AI-Use Disclosure Statement, (2) Court-Specific Requirements Checklist, (3) Citation Verification Appendix, (4) Verification Blockers, (5) Counsel Signoff Appendix. Every court practice-direction reference must be cited against the retrieved snippets; if a specific practice direction isn't in the retrieval context, use [NEEDS VERIFICATION] and name the court so counsel knows where to look.`,

  "missing-authority-scan": `Audit the matter's current substantive output (attached as "Document under review" above) for citation risk. Produce the five-section audit: (1) Citation Risk Summary, (2) Per-Citation Audit Table, (3) Uncited Assertions, (4) Corpus Coverage Gaps, (5) Pre-Filing Punch List.

Do NOT rewrite the output. Your job is to flag risk, not fix it. Every finding should be actionable — name the specific citation id, the specific assertion, or the specific authority cluster that is missing.`,

  "pipeda-check": `Review the privacy-related material described in the "Document under review" block above for compliance with PIPEDA Schedule 1 and, where applicable, Quebec Law 25 / Alberta PIPA / BC PIPA.

Produce the full structured output: (1) Executive Summary, (2) Ten Fair Information Principles Conformance Checklist, (3) Breach-Notification Readiness, (4) Cross-Border and Third-Party Transfers, (5) Provincial Substantially-Similar Regime Check (where matter jurisdiction is QC/AB/BC), (6) Remediation Punch List. Every finding must cite the specific PIPEDA section, Schedule 1 principle, or provincial statute section.`,
};

// Fallback prompts when no document has been uploaded yet. Instructs the
// reviewer to ask the user to upload, rather than hallucinating a review.
const TASK_PROMPTS_NO_SUBJECT: Record<string, string> = {
  "om-review": `No offering memorandum has been uploaded to this matter yet. Respond with a brief message asking the user to drop an OM PDF or DOCX into the Documents zone on the left, and then start the review.`,
  "kyc-gap-check": `No client file has been uploaded to this matter yet. Ask the user to upload the client KYC/AML file to begin the gap check.`,
  "marketing-signoff": `No marketing material has been uploaded to this matter yet. Ask the user to upload the marketing document (deck, brochure, one-pager) to begin the sign-off review.`,
  "response-memo": `No inquiry or deficiency letter has been uploaded to this matter yet. Ask the user to upload the regulator's letter so the response can be drafted against its specific points.`,
  "court-ai-disclosure": `Draft an AI-use disclosure memo for the material in this matter. If the matter has no substantive output yet, draft a GENERIC court-appropriate AI-use disclosure that counsel can adapt — cover the three obligations (transparency, accuracy, accountability), leave placeholders for court name and filing details, and include the Counsel Signoff Appendix. Never refuse to produce the memo.`,
  "missing-authority-scan": `No substantive output has been produced in this matter yet, so there is nothing to audit. Ask the user to run the primary review (OM / KYC / marketing / response memo / PIPEDA / etc.) first, then re-run the missing-authority scan against the resulting output.`,
  "pipeda-check": `No privacy material has been uploaded to this matter yet. Ask the user to upload the privacy policy, incident-response playbook, consent form, vendor DPA, or breach-notification draft so the PIPEDA conformance review can begin.`,
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  let body: { taskType?: string; maxRounds?: number } = {};
  try {
    body = (await req.json()) as { taskType?: string; maxRounds?: number };
  } catch {
    // Use matter's task type + default rounds
  }

  const taskType = body.taskType ?? matter.taskType;
  // Optional override for the judge-loop round cap. Default 3 matches the
  // original behaviour. The UI surfaces a "retry with deeper rounds" action
  // on needs-revision matters that calls through with 6 — giving the judge
  // more room to iterate with the drafter before the matter resolves.
  // Clamp to [1, 8] so a malformed client request can't wedge the loop.
  const requestedRounds = typeof body.maxRounds === "number" ? body.maxRounds : 3;
  const maxRounds = Math.max(1, Math.min(8, Math.floor(requestedRounds)));

  // Build the review subject from the matter's uploaded document chunks.
  // If no document has been uploaded, fall through to the no-subject prompt.
  const reviewSubject = await buildReviewSubject(matterId, taskType);
  const userMessage = reviewSubject
    ? (TASK_PROMPTS_WITH_SUBJECT[taskType] ?? TASK_PROMPTS_WITH_SUBJECT["om-review"]!)
    : (TASK_PROMPTS_NO_SUBJECT[taskType] ?? TASK_PROMPTS_NO_SUBJECT["om-review"]!);

  // Seed authorities for this tenant (idempotent)
  await ensureTenant(matter.organizationId);

  // Retrieve relevant snippets filtered by matter scope.
  //
  // For task types with a registered retrieval plan (OM review, KYC gap
  // check, marketing sign-off, response-memo) we run the plan — one short
  // BM25 query per authority cluster — and union the results. This surfaces
  // rule-text items that a single pass over the document's
  // subject-specific vocabulary would miss. Results are deduped by item id;
  // ranking is best-score-across-queries. A fallback pass over the document
  // content itself catches anything subject-specific the static plan misses.
  //
  // For task types without a registered plan we fall back to legacy
  // single-pass retrieval over the document content.
  const cognitionStore = getDefaultCognitionStore();
  const plan = getRetrievalPlan(taskType);
  const documentQuery = reviewSubject
    ? reviewSubject.chunks
        .map((c) => c.content)
        .join(" ")
        .slice(0, 2000)
    : userMessage;
  let retrievedSnippets: RetrievedSnippet[] = [];
  // Retrieval coverage telemetry — surfaced in the audit log so we can spot
  // a starvation regression (plan queries returning zero hits) before a
  // user hits a "corpus is incomplete" refusal.
  let plannedQueries = 0;
  let queriesWithHits = 0;
  try {
    if (plan) {
      plannedQueries = plan.length;
      const merged = new Map<string, RetrievalResult>();
      for (const planQuery of plan) {
        const results = await cognitionStore.retrieve({
          query: planQuery,
          topK: PLAN_PER_QUERY_TOP_K,
          organizationId,
          scoreThreshold: DEFAULT_SCORE_THRESHOLD,
          jurisdiction: matter.jurisdiction,
          registrationCategory: matter.registrationCategory,
        });
        if (results.length > 0) queriesWithHits += 1;
        for (const r of results) {
          const id = r.item.id ?? "";
          if (!id) continue;
          const prior = merged.get(id);
          if (!prior || r.score > prior.score) merged.set(id, r);
        }
      }
      const docResults = await cognitionStore.retrieve({
        query: documentQuery,
        topK: DEFAULT_TOP_K,
        organizationId,
        scoreThreshold: DEFAULT_SCORE_THRESHOLD,
        jurisdiction: matter.jurisdiction,
        registrationCategory: matter.registrationCategory,
      });
      for (const r of docResults) {
        const id = r.item.id ?? "";
        if (!id) continue;
        const prior = merged.get(id);
        if (!prior || r.score > prior.score) merged.set(id, r);
      }
      retrievedSnippets = [...merged.values()]
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_MERGED_SNIPPETS)
        .map(toRetrievedSnippet);
    } else {
      const results = await cognitionStore.retrieve({
        query: documentQuery,
        topK: DEFAULT_TOP_K,
        organizationId,
        scoreThreshold: DEFAULT_SCORE_THRESHOLD,
        jurisdiction: matter.jurisdiction,
        registrationCategory: matter.registrationCategory,
      });
      retrievedSnippets = results.map(toRetrievedSnippet);
    }
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
      inputContent: buildRetrievalCoverageNote({
        taskType,
        snippetCount: retrievedSnippets.length,
        jurisdiction: matter.jurisdiction,
        registrationCategory: matter.registrationCategory,
        plannedQueries,
        queriesWithHits,
      }),
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
      const state = newReviewStreamState();

      try {
        const generator = runAgentLoop(context, userMessage, {
          maxRounds,
          drafterPersona: personaForTask(taskType),
        });

        // Stream events through. Track state for the post-loop finalization
        // step — the UI mirrors this same state via its own handler, so the
        // server and client agree on "what is the current drafter round's
        // output" without coordinating mid-stream.
        //
        // IMPORTANT: `loop-done` is the terminal signal the UI uses to stop
        // reading. We must emit `prose-final` and `citations` BEFORE the
        // loop-done passes through so the UI can replace its accumulated
        // stream with the clean final version before closing the reader.
        // Build the set of resolvable chunkIds visible to the model this turn —
        // both the subject document's chunks AND the retrieved authority ids.
        // A [cN] citation is only trustworthy if its chunkId lands in this set.
        const knownChunkIds = new Set<string>();
        for (const s of retrievedSnippets) knownChunkIds.add(s.id);
        if (context.reviewSubject) {
          for (const c of context.reviewSubject.chunks) knownChunkIds.add(c.chunkId);
        }

        for await (const event of generator) {
          if (event.type === "loop-done") {
            // Hold the loop-done event until after we've parsed + emitted
            // the finalize events.
            applyEvent(state, event);
            const { prose, citations, orphanedMarkers, unusedCitations } = finalizeReview(state);
            const { valid: validCitations, dropped } = validateCitations(citations, knownChunkIds);
            // Surface the judge's rationale alongside the final prose so a
            // compliance lawyer looking at a `needs-revision` or `blocked`
            // matter sees WHY the judge rejected, not just the verdict
            // token. When the judge shipped READY_TO_SUBMIT we skip this
            // event — there's no critique to show.
            if (state.lastVerdict !== "READY_TO_SUBMIT" && state.activeJudgeOutput.trim()) {
              controller.enqueue(
                encoder.encode(
                  sseFrame({
                    type: "verdict-rationale",
                    rationale: state.activeJudgeOutput.trim(),
                    verdict: state.lastVerdict,
                  }),
                ),
              );
            }
            controller.enqueue(encoder.encode(sseFrame({ type: "prose-final", prose })));
            controller.enqueue(
              encoder.encode(sseFrame({ type: "citations", citations: validCitations })),
            );
            // Surface citation integrity warnings so the UI can flag "X
            // orphan marker(s)" — silently dropping them is what got us the
            // empty `authorities_used` audit rows in the first place.
            if (orphanedMarkers.length > 0 || unusedCitations.length > 0 || dropped.length > 0) {
              controller.enqueue(
                encoder.encode(
                  sseFrame({
                    type: "citation-warnings",
                    orphanedMarkers,
                    unusedCitations,
                    droppedChunkIds: dropped.map((c) => c.chunkId),
                  }),
                ),
              );
            }
            controller.enqueue(encoder.encode(sseFrame(event)));
            continue;
          }
          controller.enqueue(encoder.encode(sseFrame(event)));
          applyEvent(state, event);
        }

        // Re-finalize so we can upgrade via a targeted retry when the drafter
        // output didn't cite cleanly the first time.
        // eslint-disable-next-line prefer-const
        let { prose, citations, orphanedMarkers, unusedCitations } = finalizeReview(state);
        const validation = validateCitations(citations, knownChunkIds);
        let validCitations = validation.valid;
        let dropped = validation.dropped;

        // CITATION-INTEGRITY RETRY
        //
        // Why this is a separate pass and not just another drafter+judge
        // round: the judge critiques compliance substance, not citation
        // plumbing. When MAX_TOKENS truncates the trailing ```citations
        // fence mid-JSON (a routine outcome for longer marketing/KYC
        // deliverables with many [cN] markers) the judge correctly says
        // ITERATE but the next drafter round often rewrites the prose from
        // scratch and hits the same ceiling. What we actually need is a
        // targeted "emit ONLY a citations block that resolves every marker
        // in this prose, against this allowed chunkId set" pass. One extra
        // model call, ~500 tokens, fixes the common truncation case.
        const markersInProse = Array.from(
          new Set((prose.match(/\[c\d+\]/g) ?? []).map((m) => m.slice(1, -1))),
        );
        const needsRetry =
          markersInProse.length > 0 &&
          (orphanedMarkers.length > 0 ||
            dropped.length > 0 ||
            validCitations.length < markersInProse.length);

        if (needsRetry && retrievedSnippets.length > 0) {
          controller.enqueue(
            encoder.encode(
              sseFrame({
                type: "citation-retry-started",
                markersInProse,
                priorValidCount: validCitations.length,
                reason:
                  orphanedMarkers.length > 0
                    ? `${orphanedMarkers.length} orphan marker(s)`
                    : dropped.length > 0
                      ? `${dropped.length} hallucinated chunkId(s)`
                      : `citations block truncated (${validCitations.length}/${markersInProse.length} resolved)`,
              }),
            ),
          );

          const chunkCatalogLines: string[] = [];
          for (const s of retrievedSnippets) {
            // Truncated content helps the model produce accurate quotes.
            const preview = s.content.replace(/\s+/g, " ").slice(0, 240);
            chunkCatalogLines.push(
              `- chunkId \`${s.id}\` → authorityId "${s.id}" · title "${s.title}" · content preview: "${preview}${s.content.length > 240 ? "…" : ""}"`,
            );
          }
          if (context.reviewSubject) {
            for (const c of context.reviewSubject.chunks.slice(0, 12)) {
              const preview = c.content.replace(/\s+/g, " ").slice(0, 180);
              chunkCatalogLines.push(
                `- chunkId \`${c.chunkId}\` → authorityId "subject-document" · section "chunk ${c.chunkId}" · content preview: "${preview}${c.content.length > 180 ? "…" : ""}"`,
              );
            }
          }

          const retryPrompt = [
            `A compliance review was just drafted but its \`\`\`citations JSON fence was missing, truncated, or referenced invalid chunkIds. Do NOT re-emit the prose. Output ONLY a single fenced \`\`\`citations JSON array that resolves every \`[cN]\` marker used in the prose below.`,
            ``,
            `Markers to resolve: ${markersInProse.map((m) => `[${m}]`).join(", ")}`,
            ``,
            `Allowed chunkIds (pick the best match for each marker):`,
            ...chunkCatalogLines,
            ``,
            `Prior prose (for context — do not re-emit):`,
            "```",
            prose.slice(0, 9000),
            "```",
            ``,
            `Output format — exactly one fenced citations array, nothing else:`,
            "```citations",
            `[`,
            `  {"id": "c1", "authorityId": "<one-of-the-above-authorityId>", "section": "<section-or-chunk-label>", "quote": "<verbatim-or-near-verbatim-from-content-preview>", "docId": "<one-of-the-above-chunkId>", "chunkId": "<one-of-the-above-chunkId>"},`,
            `  ...`,
            `]`,
            "```",
            ``,
            `Rules:`,
            `- Every marker in the list above MUST have a matching entry in the array.`,
            `- The \`chunkId\` field MUST exactly match one of the chunkIds listed above — do not invent chunkIds.`,
            `- The \`quote\` should be drawn from the matching content preview.`,
            `- Output ONLY the fenced citations block. No commentary, no preamble, no other prose.`,
          ].join("\n");

          let retryOutput = "";
          try {
            for await (const ev of runAgent(context, [], retryPrompt, {
              forcePersona: personaForTask(taskType),
              maxTokens: 4096,
            })) {
              if (ev.type === "text-delta") retryOutput += ev.delta;
              if (ev.type === "error") break;
            }
          } catch {
            // Retry best-effort; fall through with original values if the
            // extra call errors.
          }

          const retryParsed = parseModelOutput(retryOutput);
          const retryValidation = validateCitations(retryParsed.citations, knownChunkIds);

          // Accept the retry output only if it strictly improves citation
          // coverage — otherwise keep the original and let the
          // citation-warnings event flag the remaining integrity gap.
          if (retryValidation.valid.length > validCitations.length) {
            validCitations = retryValidation.valid;
            citations = retryParsed.citations;
            const cited = new Set(retryValidation.valid.map((c) => c.id));
            orphanedMarkers = markersInProse.filter((m) => !cited.has(m));
            unusedCitations = retryValidation.valid
              .map((c) => c.id)
              .filter((id) => !markersInProse.includes(id));
            dropped = retryValidation.dropped;

            controller.enqueue(
              encoder.encode(sseFrame({ type: "citations", citations: validCitations })),
            );
            if (orphanedMarkers.length > 0 || unusedCitations.length > 0 || dropped.length > 0) {
              controller.enqueue(
                encoder.encode(
                  sseFrame({
                    type: "citation-warnings",
                    orphanedMarkers,
                    unusedCitations,
                    droppedChunkIds: dropped.map((c: Citation) => c.chunkId),
                    afterRetry: true,
                  }),
                ),
              );
            }
          }
        }

        // authoritiesUsed now records the authorities the reviewer ACTUALLY
        // cited (deduped authorityId values), not the retrieval pool. If the
        // reviewer shipped uncited prose we record the retrieval pool as a
        // fallback but the orphan/unused counts in inputContent make the
        // integrity gap visible to an auditor reading the trail.
        const citedAuthorityIds = Array.from(
          new Set(validCitations.map((c) => c.authorityId).filter(Boolean)),
        );
        const authoritiesUsed =
          citedAuthorityIds.length > 0 ? citedAuthorityIds : retrievedSnippets.map((s) => s.id);

        // Write the generation audit entry using the CLEAN final prose so
        // regulators see the final deliverable, not the reasoning transcript.
        // The fullOutput transcript stays within the reviewer's working
        // memory and is never persisted.
        await auditStore.append(matterId, {
          matterId,
          organizationId: organizationId,
          actor: personaForTask(taskType),
          action: "generation",
          inputHash: sha256(userMessage),
          authoritiesUsed,
          outputHash: sha256(prose),
          judgeVerdict: state.lastVerdict,
          inputContent:
            `${state.totalRounds} round(s) via judge loop · ` +
            `${validCitations.length}/${citations.length} citation(s) resolved · ` +
            `${orphanedMarkers.length} orphan marker(s) · ` +
            `${unusedCitations.length} unused citation(s)`,
          outputContent: prose.slice(0, 2000),
        });

        // Auto-generate evidence requests from the FINAL draft's checklist
        // (not the concatenated transcript). A round-1 draft that flagged
        // MISSING items which round-2 resolved should NOT create evidence
        // requests for stale findings.
        const evidenceStore = getDefaultEvidenceStore();
        const extracted = extractEvidenceRequests(prose);
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
            inputHash: sha256(prose),
            authoritiesUsed: [],
            outputHash: sha256(extracted.map((r) => r.title).join(",")),
            judgeVerdict: null,
            inputContent: `Auto-extracted ${extracted.length} evidence requests from review output`,
            outputContent: extracted.map((r) => `- ${r.title}`).join("\n"),
          });
        }

        // Update matter status based on the final judge verdict. See the
        // state machine comment in matter-store.ts — in-review is a
        // transient state; every review should resolve into complete /
        // needs-revision / blocked so the matters list reflects whether
        // the review actually produced a shippable deliverable.
        if (state.lastVerdict === "READY_TO_SUBMIT") {
          await matterStore.updateStatus(matterId, "complete");
        } else if (state.lastVerdict === "ITERATE") {
          await matterStore.updateStatus(matterId, "needs-revision");
        } else if (state.lastVerdict === "REWRITE") {
          await matterStore.updateStatus(matterId, "blocked");
        }
      } catch (err) {
        // Review crashed — the output is untrustworthy. Block the matter
        // so a human has to look before any downstream action (export,
        // handoff, sign-off) runs against a half-finished draft.
        await matterStore.updateStatus(matterId, "blocked").catch(() => {});
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
