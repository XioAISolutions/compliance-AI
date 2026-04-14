import { Ollama } from "ollama";
import { config } from "./config";
import { hybridSearch, type HybridResult } from "./hybrid-search";

/**
 * Retrieval strategies sit on top of hybrid search.
 *
 * `hybrid`     Plain BM25 + vector + RRF. Fast, default for chat.
 * `hyde`       Draft a hypothetical answer paragraph, use its embedding as
 *              the vector-side query. Boosts recall when the question is
 *              terse or the corpus uses different wording than the user.
 * `multi`      Generate paraphrased variants, run hybrid on each, RRF-fuse
 *              the result lists. Boosts robustness to phrasing.
 */
export type Strategy = "hybrid" | "hyde" | "multi";

const ollama = new Ollama({ host: config.ollama.baseUrl });
const RRF_K = 60;

async function generateHypotheticalAnswer(question: string): Promise<string> {
  const res = await ollama.chat({
    model: config.ollama.chatModel,
    messages: [
      {
        role: "system",
        content: "You are a compliance expert. Draft a short, confident paragraph (3-5 sentences) that would answer the user's question if it were a real passage from a regulation. Use formal regulatory tone. Do not hedge or mention that you are generating a hypothetical.",
      },
      { role: "user", content: question },
    ],
    options: { temperature: 0.2, num_predict: 256 },
  });
  return res.message.content.trim();
}

async function generateQueryVariants(question: string, count = 2): Promise<string[]> {
  const res = await ollama.chat({
    model: config.ollama.chatModel,
    messages: [
      {
        role: "system",
        content: `Rewrite the user's compliance question in ${count} different ways. Each variant should preserve meaning but vary vocabulary and phrasing. Output one variant per line, no numbering, no preamble.`,
      },
      { role: "user", content: question },
    ],
    options: { temperature: 0.3, num_predict: 256 },
  });
  return res.message.content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 5)
    .slice(0, count);
}

function fuseRanked(lists: HybridResult[][], topK: number): HybridResult[] {
  const fused = new Map<string, { result: HybridResult; score: number }>();
  for (const list of lists) {
    list.forEach((r, i) => {
      const existing = fused.get(r.chunk.id);
      const contribution = 1 / (RRF_K + i + 1);
      if (existing) existing.score += contribution;
      else fused.set(r.chunk.id, { result: r, score: contribution });
    });
  }
  return Array.from(fused.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ result, score }) => ({ ...result, score }));
}

export async function retrieve(question: string, strategy: Strategy = "hybrid", topK?: number): Promise<HybridResult[]> {
  const k = topK ?? config.retrieval.topK;

  if (strategy === "hybrid") {
    return hybridSearch(question, k);
  }

  if (strategy === "hyde") {
    const hypo = await generateHypotheticalAnswer(question);
    // Run both the original question and the hypothetical; fuse so we don't
    // lose matches that the hypothetical drifted away from.
    const [a, b] = await Promise.all([hybridSearch(question, k * 2), hybridSearch(hypo, k * 2)]);
    return fuseRanked([a, b], k);
  }

  // multi
  const variants = await generateQueryVariants(question);
  const queries = [question, ...variants];
  const lists = await Promise.all(queries.map((q) => hybridSearch(q, k * 2)));
  return fuseRanked(lists, k);
}
