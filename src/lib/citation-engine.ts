import { Ollama } from "ollama";
import fs from "fs/promises";
import { config } from "./config";
import { vectorStore } from "./vector-store";
import type { DocumentChunk } from "./ingest";

const ollama = new Ollama({ host: config.ollama.baseUrl });

export interface Citation {
  id: string; chunkId: string; fileName: string; pageNumber: number;
  section: string | null; excerpt: string; confidence: number;
}

export interface CitedAnswer {
  answer: string; citations: Citation[]; retrievedChunks: DocumentChunk[];
  model: string; queryTimeMs: number;
}

const SYSTEM_PROMPT = `You are a compliance assistant operating in citation-first mode.

RULES:
1. Answer ONLY using the provided source documents below.
1. Every factual claim MUST include a citation in the format [Source N].
1. If the answer is not in the provided documents, say: "I cannot find this information in the loaded compliance documents."
1. NEVER fabricate citations or regulatory references.
1. NEVER cite a source number that does not exist in the provided documents.
1. Be precise and direct. Compliance answers must be actionable.
1. When multiple sources support a claim, cite all of them.
1. If sources conflict, note the conflict and cite both sides.`;

function buildContext(chunks: DocumentChunk[]): string {
  return chunks.map((c, i) =>
    `[Source ${i + 1}] (${c.fileName}, Page ${c.pageNumber}${c.sectionHeader ? `, ${c.sectionHeader}` : ""}):\n${c.content}`
  ).join("\n\n---\n\n");
}

function validateCitations(answer: string, chunks: DocumentChunk[]) {
  const refs = [...answer.matchAll(/\[Source\s+(\d+)\]/gi)].map((m) => parseInt(m[1], 10));
  const unique = [...new Set(refs)];
  const valid = unique.filter((r) => r >= 1 && r <= chunks.length);
  const invalid = unique.filter((r) => r < 1 || r > chunks.length);
  let clean = answer;
  for (const inv of invalid) clean = clean.replace(new RegExp(`\\[Source\\s+${inv}\\]`, "gi"), "");
  return { cleanAnswer: clean, validRefs: valid, invalidRefs: invalid };
}

export async function* queryStream(question: string): AsyncGenerator<{ type: "text" | "citations" | "meta"; data: any }> {
  const start = Date.now();
  const results = await vectorStore.search(question);
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
      { role: "user", content: `${context}\n\n---\n\nQuestion: ${question}` },
    ],
    stream: true,
    options: { temperature: 0.1, num_predict: 1024 },
  });

  let fullAnswer = "";
  for await (const chunk of stream) {
    fullAnswer += chunk.message.content;
    yield { type: "text", data: chunk.message.content };
  }

  const { validRefs } = validateCitations(fullAnswer, chunks);
  const citations: Citation[] = validRefs.map((n) => {
    const c = chunks[n - 1], r = results[n - 1];
    return { id: `[Source ${n}]`, chunkId: c.id, fileName: c.fileName, pageNumber: c.pageNumber, section: c.sectionHeader, excerpt: c.content.slice(0, 200), confidence: r.score };
  });

  yield { type: "citations", data: citations };
  yield { type: "meta", data: { model: config.ollama.chatModel, queryTimeMs: Date.now() - start } };

  // Audit log
  try {
    let log: any[] = [];
    try { log = JSON.parse(await fs.readFile(config.paths.auditLog, "utf-8")); } catch {}
    log.push({ timestamp: new Date().toISOString(), question, citationCount: citations.length, model: config.ollama.chatModel, queryTimeMs: Date.now() - start });
    await fs.writeFile(config.paths.auditLog, JSON.stringify(log, null, 2));
  } catch {}
}
