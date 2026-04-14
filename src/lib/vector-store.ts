import fs from "fs/promises";
import path from "path";
import { config } from "./config";
import { embed, cosineSimilarity } from "./embeddings";
import { buildEmbeddingText, loadAllChunks } from "./ingest";
import type { DocumentChunk } from "./ingest";

/**
 * Split store (GitNexus pattern): vectors live in their own table keyed by
 * chunkId, chunk text + metadata live separately. This keeps the hot path
 * (vector cosine) cheap and avoids rewriting big content blobs on every index.
 */
interface StoredEmbedding {
  chunkId: string;
  vector: number[];
}

interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

const EMBEDDINGS_FILE = "embeddings.json";

class LocalVectorStore {
  private embeddings: StoredEmbedding[] = [];
  private chunksById = new Map<string, DocumentChunk>();
  private embeddingsPath: string;
  private loaded = false;

  constructor() {
    this.embeddingsPath = path.join(config.paths.vectorStore, EMBEDDINGS_FILE);
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    await fs.mkdir(config.paths.vectorStore, { recursive: true });
    try {
      const raw = await fs.readFile(this.embeddingsPath, "utf-8");
      this.embeddings = JSON.parse(raw);
    } catch {
      this.embeddings = [];
    }
    const chunks = await loadAllChunks();
    this.chunksById = new Map(chunks.map((c) => [c.id, c]));
    this.loaded = true;
  }

  private async saveEmbeddings() {
    await fs.mkdir(config.paths.vectorStore, { recursive: true });
    await fs.writeFile(this.embeddingsPath, JSON.stringify(this.embeddings));
  }

  /**
   * Force a reload after a fresh ingest writes new chunk files.
   */
  async refresh() {
    this.loaded = false;
    await this.ensureLoaded();
  }

  async indexChunks(chunks: DocumentChunk[], onProgress?: (done: number, total: number) => void): Promise<void> {
    await this.ensureLoaded();
    // Ensure new chunks are visible for lookup even if they weren't on disk at load time.
    for (const c of chunks) this.chunksById.set(c.id, c);

    const have = new Set(this.embeddings.map((e) => e.chunkId));
    const toIndex = chunks.filter((c) => !have.has(c.id));
    for (let i = 0; i < toIndex.length; i++) {
      const c = toIndex[i];
      const vector = await embed(buildEmbeddingText(c));
      this.embeddings.push({ chunkId: c.id, vector });
      onProgress?.(i + 1, toIndex.length);
    }
    await this.saveEmbeddings();
  }

  async search(query: string, topK?: number): Promise<SearchResult[]> {
    await this.ensureLoaded();
    const k = topK ?? config.retrieval.topK;
    const queryVector = await embed(query);
    const scored: SearchResult[] = [];
    for (const e of this.embeddings) {
      const chunk = this.chunksById.get(e.chunkId);
      if (!chunk) continue;
      scored.push({ chunk, score: cosineSimilarity(queryVector, e.vector) });
    }
    return scored
      .filter((s) => s.score >= config.retrieval.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /**
   * Vector-only ranking for all chunks, used by the hybrid searcher.
   * Returns every chunk with its score; filtering + top-k happen after fusion.
   */
  async rankAll(query: string): Promise<SearchResult[]> {
    await this.ensureLoaded();
    const queryVector = await embed(query);
    const scored: SearchResult[] = [];
    for (const e of this.embeddings) {
      const chunk = this.chunksById.get(e.chunkId);
      if (!chunk) continue;
      scored.push({ chunk, score: cosineSimilarity(queryVector, e.vector) });
    }
    return scored.sort((a, b) => b.score - a.score);
  }

  async allChunks(): Promise<DocumentChunk[]> {
    await this.ensureLoaded();
    return Array.from(this.chunksById.values());
  }

  async count(): Promise<number> {
    await this.ensureLoaded();
    return this.embeddings.length;
  }

  async listDocuments(): Promise<{ documentId: string; fileName: string; chunkCount: number }[]> {
    await this.ensureLoaded();
    const docs = new Map<string, { documentId: string; fileName: string; chunkCount: number }>();
    for (const chunk of this.chunksById.values()) {
      const e = docs.get(chunk.documentId);
      if (e) e.chunkCount++;
      else docs.set(chunk.documentId, { documentId: chunk.documentId, fileName: chunk.fileName, chunkCount: 1 });
    }
    return Array.from(docs.values());
  }
}

export const vectorStore = new LocalVectorStore();
