import { Ollama } from "ollama";
import fs from "fs/promises";
import { config } from "./config";
import { hybridSearch, type HybridResult } from "./hybrid-search";
import type { DocumentChunk } from "./ingest";

const ollama = new Ollama({ host: config.ollama.baseUrl });

export interface Citation {
  id: string;          // the full [[doc:§section]] ref as emitted by the LLM
  chunkId: string;
  fileName: string;
  pageNumber: number;
  section: string | null;
  sectionNumber: string | null;
  sectionPath: string[];
  excerpt: string;
  confidence: number;  // fused RRF score, not raw cosine
  vectorScore: number;
  bm25Score: number;
}

export interface CitedAnswer {
  answer: string;
  citations: Citation[];
  retrievedChunks: DocumentChunk[];
  model: string;
  queryTimeMs: number;
}

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
 * Extract [[doc:ref]] citations from the answer and resolve them to chunks.
 * Strips any that reference unknown doc tags (hallucinated citations).
 */
function extractAndValidateCitations(
  answer: string,
  results: HybridResult[],
): { cleanAnswer: string; citations: Citation[] } {
  const tagToResult = new Map<string, { result: HybridResult; index: number }>();
  results.forEach((r, i) => tagToResult.set(docTag(i), { result: r, index: i }));

  const matches = [...answer.matchAll(/\[\[\s*(S\d+)\s*:\s*([^\]]+?)\s*\]\]/gi)];
  const citationsByTag = new Map<string, Citation>();
  const invalidTags = new Set<string>();

  for (const m of matches) {
    const tag = m[1].toUpperCase();
    const ref = m[2];
    const entry = tagToResult.get(tag);
    if (!entry) {
      invalidTags.add(tag);
      continue;
    }
    if (citationsByTag.has(tag)) continue; // dedupe per source
    const { result } = entry;
    const c = result.chunk;
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
    });
  }

  // Strip hallucinated refs from the rendered answer.
  let clean = answer;
  for (const tag of invalidTags) {
    clean = clean.replace(new RegExp(`\\[\\[\\s*${tag}\\s*:[^\\]]+\\]\\]`, "gi"), "");
  }

  return { cleanAnswer: clean, citations: Array.from(citationsByTag.values()) };
}

export async function* queryStream(
  question: string,
): AsyncGenerator<{ type: "text" | "citations" | "meta" | "error"; data: any }> {
  const start = Date.now();
  const results = await hybridSearch(question);
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

  yield { type: "citations", data: citations };
  yield { type: "meta", data: { model: config.ollama.chatModel, queryTimeMs: Date.now() - start } };

  // Audit log
  try {
    let log: any[] = [];
    try { log = JSON.parse(await fs.readFile(config.paths.auditLog, "utf-8")); } catch {}
    log.push({
      timestamp: new Date().toISOString(),
      question,
      citationCount: citations.length,
      topFused: results[0]?.score ?? null,
      model: config.ollama.chatModel,
      queryTimeMs: Date.now() - start,
    });
    await fs.writeFile(config.paths.auditLog, JSON.stringify(log, null, 2));
  } catch {}
}
