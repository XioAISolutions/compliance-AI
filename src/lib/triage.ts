import { Ollama } from "ollama";
import { config } from "./config";
import { retrieve } from "./retrieval-strategies";
import { query, countUnresolvedCitationTags, type Citation } from "./citation-engine";
import { getMatter, effectiveMatterIds, type Matter } from "./matters";
import { loadIntake, summarizeIntake, type Intake } from "./intake";
import { authorityWeightFor, type DocType, type RetrievalFilter } from "./retrieval-filter";
import type { PromptProfileId } from "./prompt-profiles";
import type { DocumentChunk } from "./ingest";
import type { HybridResult } from "./hybrid-search";
import fs from "fs/promises";
import path from "path";
import { matterPaths } from "./config";
import { v4 as uuid } from "uuid";

/**
 * Triage.
 *
 * Given a matter's intake (parties, timeline, narrative) + the statute
 * libraries the matter subscribes to, enumerate candidate causes of action
 * and score how well the client's facts satisfy each statutory element.
 *
 * Algorithm:
 *   1. Build statute-only retrieval over matter + statuteCorpusIds.
 *   2. For each signal drawn from the intake (events, narrative, hint) run
 *      statute retrieval and collect hits.
 *   3. Group by (documentId, sectionNumber) — each group is a candidate cause.
 *   4. For each candidate, ask the chat model to enumerate the statutory
 *      elements in strict JSON.
 *   5. For each element, retrieve client_facts / correspondence / contract
 *      chunks and verify support via the existing lexical verifier.
 *   6. Generate a narrative through query() so the verify+judge pipeline
 *      attaches citations we can render unchanged.
 *   7. Rank by mean(elementSupport) * topChunkAuthorityWeight.
 *
 * Reuses verify.ts/judge.ts via the citation-engine query() call — we do
 * NOT fork the verification pipeline.
 */

const ollama = new Ollama({ host: config.ollama.baseUrl });

const FACT_DOC_TYPES: DocType[] = ["client_facts", "correspondence", "contract"];
const STATUTE_DOC_TYPES: DocType[] = ["statute", "regulation"];

export interface TriageElement {
  /** One-line statement of the element the statute requires (model-generated). */
  text: string;
  /** Fact chunks that appear to satisfy this element, ordered by verification strength. */
  supportingFactChunks: {
    chunkId: string;
    fileName: string;
    sectionNumber: string | null;
    pageNumber: number;
    excerpt: string;
    verified: boolean;
    overlap: number;
  }[];
  /** 0..1 — fraction of sampled fact chunks that the lexical verifier accepted. */
  supportRatio: number;
}

export interface CauseOfAction {
  id: string;
  statuteTag: string;              // e.g. "fake-fdcpa.pdf §807"
  documentId: string;
  fileName: string;
  sectionNumber: string | null;
  sectionHeader: string | null;
  jurisdiction: string | null;
  /** The top statute chunk that anchors this cause. */
  anchorChunkId: string;
  anchorAuthorityWeight: number;
  elements: TriageElement[];
  /** mean(element.supportRatio) * anchorAuthorityWeight — ranking signal. */
  score: number;
  /** citation-first narrative generated from the facts + statute. */
  narrative: string;
  /** Citations extracted from `narrative` by the citation engine. */
  citations: Citation[];
  /** Per-narrative verify + judge aggregates, same shape as drafting. */
  readiness: {
    verifiedRate: number;
    judgeSupportedRate: number | null;
    invalidTagCount: number;
  };
}

export interface TriageResult {
  id: string;
  matterId: string;
  createdAt: string;
  causes: CauseOfAction[];
  /** Stats emitted for the audit log / readiness meter. */
  stats: {
    statuteChunksConsidered: number;
    candidatesExplored: number;
    judgeUsed: boolean | "weak";
  };
}

// ---------------------------------------------------------------------------
// Step 2 — mine signals from the intake.

function intakeSignals(intake: Intake | null): string[] {
  if (!intake) return [];
  const out: string[] = [];
  for (const ev of intake.timeline) {
    if (ev.description.trim().length > 0) out.push(ev.description.trim());
  }
  const narrative = intake.freeNarrative.trim();
  if (narrative.length > 0) {
    // Split the free narrative into sentences; each sentence is a retrieval
    // signal. Short narratives produce one signal; long ones produce several.
    const sentences = narrative.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 12);
    out.push(...sentences.slice(0, 6));
  }
  if (intake.intakeTypeHint && intake.intakeTypeHint.trim().length > 0) {
    out.push(intake.intakeTypeHint.trim());
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 3 — group statute hits by (documentId, sectionNumber).

interface Candidate {
  key: string;
  documentId: string;
  fileName: string;
  sectionNumber: string | null;
  sectionHeader: string | null;
  jurisdiction: string | null;
  anchor: HybridResult;
  hits: HybridResult[];
  /** Accumulated RRF score across signals that surfaced this candidate. */
  weight: number;
}

function groupStatuteHits(lists: HybridResult[][]): Candidate[] {
  const byKey = new Map<string, Candidate>();
  for (const list of lists) {
    list.forEach((r, rank) => {
      const c = r.chunk;
      // Prefer section-level grouping; fall back to documentId when the
      // statute PDF has no detected sections so we still cluster sensibly.
      const key = `${c.documentId}::${c.sectionNumber ?? "doc"}`;
      const existing = byKey.get(key);
      const contribution = 1 / (60 + rank + 1); // RRF-style
      if (existing) {
        existing.weight += contribution;
        existing.hits.push(r);
        // Keep the highest-scoring chunk as the anchor for this candidate.
        if (r.score > existing.anchor.score) existing.anchor = r;
      } else {
        byKey.set(key, {
          key,
          documentId: c.documentId,
          fileName: c.fileName,
          sectionNumber: c.sectionNumber,
          sectionHeader: c.sectionHeader,
          jurisdiction: c.jurisdiction,
          anchor: r,
          hits: [r],
          weight: contribution,
        });
      }
    });
  }
  return Array.from(byKey.values()).sort((a, b) => b.weight - a.weight);
}

// ---------------------------------------------------------------------------
// Step 4 — enumerate elements via chat model (strict JSON).

const ELEMENTS_SYSTEM = `You are a consumer-law expert. Given ONE statute or regulation passage, enumerate the distinct elements a plaintiff must prove for a cause of action under this provision.

Rules:
- Each element is a single short sentence, stated as the fact that must be shown.
- Do NOT invent elements that the passage does not support.
- Do NOT add commentary, preamble, or explanation.
- Respond with a single line of compact JSON exactly of the form:
  {"elements":["<short sentence>", "<short sentence>", ...]}
- If the passage does not support a cause of action (e.g. definitions, procedural rules), respond with {"elements":[]}.
- Limit to 6 elements.`;

async function enumerateElements(anchor: DocumentChunk): Promise<string[]> {
  try {
    const res = await ollama.chat({
      model: config.ollama.chatModel,
      messages: [
        { role: "system", content: ELEMENTS_SYSTEM },
        {
          role: "user",
          content: `STATUTE (${anchor.fileName}${anchor.sectionNumber ? ` §${anchor.sectionNumber}` : ""}):\n${anchor.content.slice(0, 2200)}`,
        },
      ],
      options: { temperature: 0, num_predict: 384 },
    });
    const raw = res.message.content.trim();
    const jsonMatch = raw.match(/\{[\s\S]*"elements"[\s\S]*\}/);
    if (!jsonMatch) return [];
    const obj = JSON.parse(jsonMatch[0]) as { elements?: unknown };
    if (!Array.isArray(obj.elements)) return [];
    return obj.elements
      .filter((e): e is string => typeof e === "string")
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.length < 400)
      .slice(0, 6);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Step 5 — test each element against the fact corpus.

import { verifyClaimAgainstChunk } from "./verify";

async function scoreElement(
  element: string,
  factFilter: RetrievalFilter,
  topK: number,
): Promise<TriageElement> {
  // Retrieve fact chunks most relevant to the element text.
  const hits = await retrieve(element, "hybrid", topK, factFilter);
  const supporting: TriageElement["supportingFactChunks"] = [];
  let verifiedCount = 0;
  for (const r of hits) {
    const v = verifyClaimAgainstChunk(element, r.chunk.content);
    if (v.verified) verifiedCount++;
    supporting.push({
      chunkId: r.chunk.id,
      fileName: r.chunk.fileName,
      sectionNumber: r.chunk.sectionNumber,
      pageNumber: r.chunk.pageNumber,
      excerpt: r.chunk.content.slice(0, 200),
      verified: v.verified,
      overlap: v.overlap,
    });
  }
  supporting.sort((a, b) => Number(b.verified) - Number(a.verified) || b.overlap - a.overlap);
  const supportRatio = hits.length > 0 ? verifiedCount / hits.length : 0;
  return { text: element, supportingFactChunks: supporting.slice(0, 5), supportRatio };
}

// ---------------------------------------------------------------------------
// Step 6 — narrative generation via query() (reuses verify+judge+citations).

function narrativePromptFor(cause: {
  fileName: string;
  sectionNumber: string | null;
  elements: TriageElement[];
}): string {
  const header = cause.sectionNumber ? `${cause.fileName} §${cause.sectionNumber}` : cause.fileName;
  const elementsList = cause.elements.length > 0
    ? cause.elements.map((e, i) => `  ${i + 1}. ${e.text}`).join("\n")
    : "  (no elements detected — treat the passage as the controlling authority)";
  return [
    `Draft a short triage paragraph analyzing whether the matter supports a cause of action under ${header}.`,
    "",
    "Structure:",
    "  - State the statute and its role.",
    "  - For each listed element, name it and point to the specific fact(s) in the sources that satisfy it (or note the gap).",
    "  - Conclude with whether the matter appears to support this cause.",
    "",
    "STATUTORY ELEMENTS TO ANALYZE:",
    elementsList,
    "",
    "Every statutory assertion must cite a statute/regulation source. Every factual assertion must cite a client-facts, correspondence, or contract source. Use [[Sn:ref]] tags from the provided sources. Never invent a tag.",
  ].join("\n");
}

function profileFor(matter: Matter): PromptProfileId {
  switch (matter.persona) {
    case "plaintiff":
      return "plaintiff_demand";
    case "legal_aid":
      return "legal_aid_triage";
    case "in_house":
      return "in_house_review";
    case "compliance_ops":
      return "internal_memo";
    default:
      return "compliance_qa";
  }
}

// ---------------------------------------------------------------------------
// Entry point.

export interface TriageOptions {
  /** Pass-through to query() so each cause narrative runs the LLM judge. */
  judge?: boolean | "weak";
  /** Per-element fact retrieval depth. Defaults to 5. */
  elementTopK?: number;
  /** Per-signal statute retrieval depth. Defaults to 8. */
  statuteTopK?: number;
  /** Hard cap on the number of candidate causes explored. Defaults to 5. */
  maxCandidates?: number;
  /** When true, retrieval multiplies fused score by chunk authority weight. */
  authorityBoost?: boolean;
}

export async function triageMatter(
  matterId: string,
  opts: TriageOptions = {},
): Promise<TriageResult> {
  const matter = await getMatter(matterId);
  if (!matter) throw new Error(`Matter not found: ${matterId}`);
  const intake = await loadIntake(matterId);
  const matterIds = await effectiveMatterIds(matterId);

  const statuteTopK = opts.statuteTopK ?? 8;
  const elementTopK = opts.elementTopK ?? 5;
  const maxCandidates = opts.maxCandidates ?? 5;

  const authorityBoost = opts.authorityBoost === true;
  const statuteFilter: RetrievalFilter = { matterIds, docTypes: STATUTE_DOC_TYPES, authorityBoost };
  const factFilter: RetrievalFilter = { matterIds, docTypes: FACT_DOC_TYPES };

  // Step 2: build retrieval signals from the intake. If we have nothing,
  // fall back to the matter's displayName — better a broad signal than
  // refusing to triage.
  const rawSignals = intakeSignals(intake);
  const signals = rawSignals.length > 0 ? rawSignals : [matter.displayName];

  const lists: HybridResult[][] = [];
  for (const s of signals) {
    const hits = await retrieve(s, "hybrid", statuteTopK, statuteFilter);
    if (hits.length > 0) lists.push(hits);
  }
  const allStatuteHits = lists.flat();
  const statuteChunksConsidered = new Set(allStatuteHits.map((r) => r.chunk.id)).size;

  // Step 3: group into candidates.
  const candidates = groupStatuteHits(lists).slice(0, maxCandidates);

  // Step 4–6: enumerate elements, score each, generate narrative.
  const causes: CauseOfAction[] = [];
  const persona = profileFor(matter);
  for (const cand of candidates) {
    const anchor = cand.anchor.chunk;
    const elementTexts = await enumerateElements(anchor);

    const elements: TriageElement[] = [];
    for (const t of elementTexts) {
      elements.push(await scoreElement(t, factFilter, elementTopK));
    }
    const meanSupport = elements.length > 0
      ? elements.reduce((n, e) => n + e.supportRatio, 0) / elements.length
      : 0;
    const anchorAuthority = authorityWeightFor(anchor.docType);

    // Step 6: narrative. Retrieval scope = statute + facts so the engine
    // can cite both. We pass matterIds only (no docType restriction) so
    // both statutes and facts reach the model.
    const narrativeFilter: RetrievalFilter = {
      matterIds,
      docTypes: [...STATUTE_DOC_TYPES, ...FACT_DOC_TYPES],
      authorityBoost,
    };
    const narrativeQuestion = narrativePromptFor({
      fileName: anchor.fileName,
      sectionNumber: anchor.sectionNumber,
      elements,
    });
    // Seed the matter/intake context into the question so the retrieval
    // engine gets a richer query than just the elements.
    const intakeContext = intake ? `\n\nMATTER INTAKE:\n${summarizeIntake(intake)}` : "";
    const fullQuestion = `${narrativeQuestion}${intakeContext}`;
    const answer = await query(fullQuestion, {
      filter: narrativeFilter,
      topK: Math.max(statuteTopK, elementTopK) + 2,
      judge: opts.judge,
      promptProfile: persona,
    });

    const verifiedCount = answer.citations.filter((c) => c.verification.verified).length;
    const judgedCount = answer.citations.filter((c) => c.judge).length;
    const judgeSupportedCount = answer.citations.filter((c) => c.judge?.supported).length;
    const totalCitations = answer.citations.length;
    const verifiedRate = totalCitations > 0 ? verifiedCount / totalCitations : 1;
    const judgeSupportedRate = judgedCount > 0 ? judgeSupportedCount / judgedCount : null;
    const invalidTagCount = countUnresolvedCitationTags(answer.answer, answer.citations);

    causes.push({
      id: uuid(),
      statuteTag: anchor.sectionNumber ? `${anchor.fileName} §${anchor.sectionNumber}` : anchor.fileName,
      documentId: anchor.documentId,
      fileName: anchor.fileName,
      sectionNumber: anchor.sectionNumber,
      sectionHeader: anchor.sectionHeader,
      jurisdiction: anchor.jurisdiction,
      anchorChunkId: anchor.id,
      anchorAuthorityWeight: anchorAuthority,
      elements,
      score: meanSupport * anchorAuthority,
      narrative: answer.answer,
      citations: answer.citations,
      readiness: { verifiedRate, judgeSupportedRate, invalidTagCount },
    });
  }

  causes.sort((a, b) => b.score - a.score);

  const result: TriageResult = {
    id: uuid(),
    matterId,
    createdAt: new Date().toISOString(),
    causes,
    stats: {
      statuteChunksConsidered,
      candidatesExplored: candidates.length,
      judgeUsed: opts.judge ?? false,
    },
  };

  await saveTriage(result).catch(() => {});
  return result;
}

// ---------------------------------------------------------------------------
// Persistence.

const TRIAGE_PREFIX = "triage-";

export async function saveTriage(result: TriageResult): Promise<void> {
  const dir = matterPaths(result.matterId).intake;
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${TRIAGE_PREFIX}${result.id}.json`), JSON.stringify(result, null, 2));
}

export async function listTriageRuns(matterId: string): Promise<TriageResult[]> {
  const dir = matterPaths(matterId).intake;
  try {
    const files = (await fs.readdir(dir)).filter((f) => f.startsWith(TRIAGE_PREFIX) && f.endsWith(".json"));
    const out: TriageResult[] = [];
    for (const f of files) {
      try {
        out.push(JSON.parse(await fs.readFile(path.join(dir, f), "utf-8")) as TriageResult);
      } catch {}
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function loadTriage(matterId: string, id: string): Promise<TriageResult | null> {
  const file = path.join(matterPaths(matterId).intake, `${TRIAGE_PREFIX}${id}.json`);
  try {
    return JSON.parse(await fs.readFile(file, "utf-8")) as TriageResult;
  } catch {
    return null;
  }
}
