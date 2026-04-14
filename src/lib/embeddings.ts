import { Ollama } from "ollama";
import { config } from "./config";

const ollama = new Ollama({ host: config.ollama.baseUrl });

export async function embed(text: string): Promise<number[]> {
  const response = await ollama.embed({ model: config.ollama.embedModel, input: text });
  return response.embeddings[0];
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await ollama.embed({ model: config.ollama.embedModel, input: texts });
  return response.embeddings;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
