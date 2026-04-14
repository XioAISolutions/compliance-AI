import fs from "fs/promises";
import path from "path";
import { config } from "./config";
import { embed, cosineSimilarity } from "./embeddings";
import type { DocumentChunk } from "./ingest";

interface StoredVector { id: string; vector: number[]; metadata: DocumentChunk; }
interface SearchResult { chunk: DocumentChunk; score: number; }

const STORE_FILE = "vectors.json";

class LocalVectorStore {
  private vectors: StoredVector[] = [];
  private storePath: string;
  private loaded = false;

  constructor() {
    this.storePath = path.join(config.paths.vectorStore, STORE_FILE);
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    try {
      await fs.mkdir(config.paths.vectorStore, { recursive: true });
      const raw = await fs.readFile(this.storePath, "utf-8");
      this.vectors = JSON.parse(raw);
    } catch { this.vectors = []; }
    this.loaded = true;
  }

  private async save() {
    await fs.mkdir(config.paths.vectorStore, { recursive: true });
    await fs.writeFile(this.storePath, JSON.stringify(this.vectors));
  }

  async indexChunks(chunks: DocumentChunk[], onProgress?: (done: number, total: number) => void): Promise<void> {
    await this.ensureLoaded();
    const toIndex = chunks.filter((c) => !this.vectors.some((v) => v.id === c.id));
    for (let i = 0; i < toIndex.length; i++) {
      const vector = await embed(toIndex[i].content);
      this.vectors.push({ id: toIndex[i].id, vector, metadata: toIndex[i] });
      onProgress?.(i + 1, toIndex.length);
    }
    await this.save();
  }

  async search(query: string, topK?: number): Promise<SearchResult[]> {
    await this.ensureLoaded();
    const k = topK ?? config.retrieval.topK;
    const queryVector = await embed(query);
    return this.vectors
      .map((v) => ({ chunk: v.metadata, score: cosineSimilarity(queryVector, v.vector) }))
      .filter((s) => s.score >= config.retrieval.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  async count(): Promise<number> {
    await this.ensureLoaded();
    return this.vectors.length;
  }

  async listDocuments(): Promise<{ documentId: string; fileName: string; chunkCount: number }[]> {
    await this.ensureLoaded();
    const docs = new Map<string, { documentId: string; fileName: string; chunkCount: number }>();
    for (const v of this.vectors) {
      const e = docs.get(v.metadata.documentId);
      if (e) e.chunkCount++;
      else docs.set(v.metadata.documentId, { documentId: v.metadata.documentId, fileName: v.metadata.fileName, chunkCount: 1 });
    }
    return Array.from(docs.values());
  }
}

export const vectorStore = new LocalVectorStore();
