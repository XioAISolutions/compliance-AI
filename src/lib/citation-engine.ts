import { Ollama } from "ollama";
import fs from "fs/promises";
import { config } from "./config";
import type { HybridResult } from "./hybrid-search";
import type { DocumentChunk } from "./ingest";
import { retrieve, type Strategy } from "./retrieval-strategies";
import { extractClaimForCitation, verifyClaimAgainstChunk, type VerificationResult } from "./verify";
import { judgeClaim, type JudgeResult } from "./judge";

const ollama = new Ollama({ host: config.ollama.baseUrl });

export interface Citation {
  id: string;          // the full [[Sn:ref]] ref as emitted by the LLM
  chunkId: string;
  fileName: string;
  pageNumber: number;
  section: string | null;
  sectionNumber: string | null;
  sectionPath: string[];
  excerpt: string;
  confidence: number;  // fused RRF score
  vectorScore: number;
  bm25Score: number;
  verification: VerificationResult; // quote-level sanity check
  judge?: JudgeResult;              // optional LLM-as-judge second opinion
  claim: string;                    // the sentence this citation follows
}

export interface CitedAnswer {
  answer: string;
  citations: Citation[];
  retrievedChunks: DocumentChunk[];
  model: string;
  strategy: Strategy;
  queryTimeMs: number;
}

export type QueryOptions = {
  strategy?: Strategy;
  topK?: number;
  /**
   * When true, run the LLM judge on every citation.
   * When "weak", only judge citations that failed the lexical verifier.
   * When false/undefined, skip the judge entirely.
   */
  judge?: boolean | "weak";
};

const SYSTEM_PROMPT = `You are a compliance assistant operating in citation-first mode.

CITATION FORMAT:
- Every factual claim MUST end with a citation of the form [[doc:ref]].
- "doc" is the source identifier (a short tag like S1, S2, ... matching the tagged sources below).
- "ref" is the section or page locator provided with each source (for example [[S1:§4.1]] or [[S2:p.12]]).
- Example: "Consent must be meaningful [[S1:§4.3]] and can be withdrawn at any time [[S1:§4.3.8]]."

RULES:
1. Answer ONLY using the provided source documents below.
2. NEVER fabricate citations or regulatory references. If the answer is not in the sources, say: "I cannot find this information in the loaded compliance documents."
3. NEVER invent a doc tag (S3, S4...) that isn't listed below.
4. When multiple sources support a claim, cite all of them back-to-back: [[S1:§4.3]] [[S2:§12]].
5. If sources conflict, note the conflict and cite both sides.
6. Be precise, direct, and actionable. Compliance answers must be usable.`;

function docTag(index: number): string {
  return `S${index + 1}`;
}

function refFor(chunk: DocumentChunk): string {
  if (chunk.sectionNumber) return `§${chunk.sectionNumber}`;
  if (chunk.sectionHeader) return chunk.sectionHeader.slice(0, 60);
  return `p.${chunk.pageNumber}`;
}

function buildContext(chunks: DocumentChunk[]): string {
  return chunks.map((c, i) => {
    const tag = docTag(i);
    const ref = refFor(c);
    const breadcrumb = c.sectionPath.length > 0 ? c.sectionPath.join(" > ") : c.fileName;
    return `[${tag}:${ref}] (${c.fileName} — ${breadcrumb}, p.${c.pageNumber}):\n${c.content}`;
  }).join("\n\n---\n\n");
}

/**
 * Extract [[Sn:ref]] citations from the answer, resolve them to chunks,
 * verify each one against its source, and strip markers that reference
 * doc tags we never provided.
 */
function extractAndValidateCitations(
  answer: string,
  results: HybridResult[],
): { cleanAnswer: string; citations: Citation[] } {
  const tagToResult = new Map<string, { result: HybridResult; index: number }>();
  results.forEach((r, i) => tagToResult.set(docTag(i), { result: r, index: i }));

  const re = /\[\[\s*(S\d+)\s*:\s*([^\]]+?)\s*\]\]/gi;
  const matches = [...answer.matchAll(re)];
  const citationsByTag = new Map<string, Citation>();
  const invalidTags = new Set<string>();

  for (const m of matches) {
    const tag = m[1].toUpperCase();
    const ref = m[2];
    const markerStart = m.index ?? 0;
    const entry = tagToResult.get(tag);
    if (!entry) {
      invalidTags.add(tag);
      continue;
    }
    const { result } = entry;
    const c = result.chunk;
    const claim = extractClaimForCitation(answer, markerStart);
    const verification = verifyClaimAgainstChunk(claim, c.content);

    // Keep the best citation per tag (most recent overrides only if it has
    // a better verification score — this matters when a model cites the
    // same source for multiple claims of varying quality).
    const existing = citationsByTag.get(tag);
    if (existing && existing.verification.overlap >= verification.overlap) continue;

    const canonicalRef = ref.replace(/\s+/g, "");
    citationsByTag.set(tag, {
      id: `[[${tag}:${canonicalRef}]]`,
      chunkId: c.id,
      fileName: c.fileName,
      pageNumber: c.pageNumber,
      section: c.sectionHeader,
      sectionNumber: c.sectionNumber,
      sectionPath: c.sectionPath,
      excerpt: c.content.slice(0, 240),
      confidence: result.score,
      vectorScore: result.vectorScore,
      bm25Score: result.bm25Score,
      verification,
      claim,
    });
  }

  // Strip hallucinated refs from the rendered answer.
  let clean = answer;
  for (const tag of invalidTags) {
    clean = clean.replace(new RegExp(`\\[\\[\\s*${tag}\\s*:[^\\]]+\\]\\]`, "gi"), "");
  }

  return { cleanAnswer: clean, citations: Array.from(citationsByTag.values()) };
}

/**
 * Run the LLM judge on the subset of citations the caller asked about,
 * mutating `citations` in place. Serial by design — parallel chat calls
 * saturate local Ollama.
 */
async function applyJudge(citations: Citation[], mode: boolean | "weak" | undefined, chunksById: Map<string, DocumentChunk>) {
  if (!mode) return;
  const targets = mode === "weak" ? citations.filter((c) => !c.verification.verified) : citations;
  for (const c of targets) {
    const chunk = chunksById.get(c.chunkId);
    if (!chunk) continue;
    c.judge = await judgeClaim(c.claim, chunk.content);
  }
}

async function logAudit(entry: Record<string, unknown>) {
  try {
    let log: unknown[] = [];
    try { log = JSON.parse(await fs.readFile(config.paths.auditLog, "utf-8")); } catch {}
    log.push(entry);
    await fs.writeFile(config.paths.auditLog, JSON.stringify(log, null, 2));
  } catch {}
}

/**
 * Non-streaming query — used by the eval harness and any caller that
 * doesn't need incremental tokens.
 */
export async function query(question: string, opts: QueryOptions = {}): Promise<CitedAnswer> {
  const strategy = opts.strategy ?? "hybrid";
  const start = Date.now();
  const results = await retrieve(question, strategy, opts.topK);
  const chunks = results.map((r) => r.chunk);

  if (chunks.length === 0) {
    return {
      answer: "I cannot find information relevant to this question in the loaded compliance documents.",
      citations: [],
      retrievedChunks: [],
      model: config.ollama.chatModel,
      strategy,
      queryTimeMs: Date.now() - start,
    };
  }

  const context = buildContext(chunks);
  const res = await ollama.chat({
    model: config.ollama.chatModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `SOURCES:\n\n${context}\n\n---\n\nQUESTION: ${question}\n\nAnswer using ONLY these sources. Cite every claim with [[doc:ref]].` },
    ],
    options: { temperature: 0.1, num_predict: 1024 },
  });

  const { cleanAnswer, citations } = extractAndValidateCitations(res.message.content, results);
  const chunksById = new Map(chunks.map((c) => [c.id, c]));
  await applyJudge(citations, opts.judge, chunksById);
  const queryTimeMs = Date.now() - start;

  await logAudit({
    timestamp: new Date().toISOString(),
    question,
    strategy,
    citationCount: citations.length,
    verifiedCount: citations.filter((c) => c.verification.verified).length,
    judgedCount: citations.filter((c) => c.judge).length,
    judgeSupportedCount: citations.filter((c) => c.judge?.supported).length,
    topFused: results[0]?.score ?? null,
    model: config.ollama.chatModel,
    queryTimeMs,
  });

  return {
    answer: cleanAnswer,
    citations,
    retrievedChunks: chunks,
    model: config.ollama.chatModel,
    strategy,
    queryTimeMs,
  };
}

export async function* queryStream(
  question: string,
  opts: QueryOptions = {},
): AsyncGenerator<{ type: "text" | "citations" | "meta" | "error"; data: any }> {
  const strategy = opts.strategy ?? "hybrid";
  const start = Date.now();
  const results = await retrieve(question, strategy, opts.topK);
  const chunks = results.map((r) => r.chunk);

  if (chunks.length === 0) {
    yield { type: "text", data: "I cannot find information relevant to this question in the loaded compliance documents. Please upload the relevant documents first." };
    return;
  }

  const context = buildContext(chunks);
  const stream = await ollama.chat({
    model: config.ollama.chatModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `SOURCES:\n\n${context}\n\n---\n\nQUESTION: ${question}\n\nAnswer using ONLY these sources. Cite every claim with [[doc:ref]].` },
    ],
    stream: true,
    options: { temperature: 0.1, num_predict: 1024 },
  });

  let fullAnswer = "";
  for await (const chunk of stream) {
    fullAnswer += chunk.message.content;
    yield { type: "text", data: chunk.message.content };
  }

  const { citations } = extractAndValidateCitations(fullAnswer, results);
  const chunksById = new Map(chunks.map((c) => [c.id, c]));
  await applyJudge(citations, opts.judge, chunksById);
  const queryTimeMs = Date.now() - start;

  yield { type: "citations", data: citations };
  yield { type: "meta", data: { model: config.ollama.chatModel, strategy, queryTimeMs } };

  await logAudit({
    timestamp: new Date().toISOString(),
    question,
    strategy,
    citationCount: citations.length,
    verifiedCount: citations.filter((c) => c.verification.verified).length,
    judgedCount: citations.filter((c) => c.judge).length,
    judgeSupportedCount: citations.filter((c) => c.judge?.supported).length,
    topFused: results[0]?.score ?? null,
    model: config.ollama.chatModel,
    queryTimeMs,
  });
}
