import fs from "fs/promises";
import path from "path";
import { config, matterPaths, DEFAULT_MATTER_ID } from "./config";
import { embed, cosineSimilarity } from "./embeddings";
import { buildEmbeddingText, loadAllChunks } from "./ingest";
import type { DocumentChunk } from "./ingest";
import { chunkMatches, type RetrievalFilter } from "./retrieval-filter";

/**
 * Split store: vectors live in their own table keyed by chunkId, chunk
 * text + metadata live separately. Keeps the hot path (cosine similarity)
 * cheap and avoids rewriting big content blobs on every re-index.
 */
interface StoredEmbedding {
  chunkId: string;
  vector: number[];
  /** Which matter this embedding belongs to — tracked so writes go back to the right file. */
  matterId: string;
}

interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

const EMBEDDINGS_FILE = "embeddings.json";

class LocalVectorStore {
  private embeddings: StoredEmbedding[] = [];
  private chunksById = new Map<string, DocumentChunk>();
  private loaded = false;

  /**
   * Walk every matter directory (legacy top-level + matters/<id>/) and
   * return the embedding file paths. The legacy path maps to the
   * `default` matter — this keeps pre-migration corpora searchable.
   */
  private async listEmbeddingFiles(): Promise<{ matterId: string; file: string }[]> {
    const out: { matterId: string; file: string }[] = [];
    // Legacy "default" location
    const legacy = path.join(config.paths.vectorStore, EMBEDDINGS_FILE);
    try {
      await fs.access(legacy);
      out.push({ matterId: DEFAULT_MATTER_ID, file: legacy });
    } catch {}
    // Per-matter locations
    try {
      const entries = await fs.readdir(config.paths.matters, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (e.name === DEFAULT_MATTER_ID) continue; // handled via legacy path
        const file = path.join(matterPaths(e.name).vectors, EMBEDDINGS_FILE);
        try {
          await fs.access(file);
          out.push({ matterId: e.name, file });
        } catch {}
      }
    } catch {}
    return out;
  }

  private async ensureLoaded() {
    if (this.loaded) return;
    this.embeddings = [];
    for (const { matterId, file } of await this.listEmbeddingFiles()) {
      try {
        const raw = await fs.readFile(file, "utf-8");
        const arr = JSON.parse(raw) as Array<Partial<StoredEmbedding>>;
        for (const rec of arr) {
          if (!rec || typeof rec.chunkId !== "string" || !Array.isArray(rec.vector)) continue;
          this.embeddings.push({
            chunkId: rec.chunkId,
            vector: rec.vector as number[],
            matterId: typeof rec.matterId === "string" && rec.matterId.length > 0 ? rec.matterId : matterId,
          });
        }
      } catch {}
    }
    const chunks = await loadAllChunks();
    this.chunksById = new Map(chunks.map((c) => [c.id, c]));
    this.loaded = true;
  }

  /**
   * Persist all embeddings, writing each matter's slice to its own file so
   * on-disk isolation is preserved even though retrieval unifies them in
   * memory.
   */
  private async saveEmbeddings() {
    const byMatter = new Map<string, StoredEmbedding[]>();
    for (const e of this.embeddings) {
      const list = byMatter.get(e.matterId) ?? [];
      list.push(e);
      byMatter.set(e.matterId, list);
    }
    // Ensure every matter present in the index still writes (even if empty)
    // so deletes persist to disk.
    for (const [matterId, list] of byMatter) {
      const dir = matterId === DEFAULT_MATTER_ID ? config.paths.vectorStore : matterPaths(matterId).vectors;
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, EMBEDDINGS_FILE), JSON.stringify(list));
    }
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
      this.embeddings.push({ chunkId: c.id, vector, matterId: c.matterId });
      onProgress?.(i + 1, toIndex.length);
    }
    await this.saveEmbeddings();
  }

  async search(query: string, topK?: number, filter?: RetrievalFilter): Promise<SearchResult[]> {
    await this.ensureLoaded();
    const k = topK ?? config.retrieval.topK;
    const queryVector = await embed(query);
    const scored: SearchResult[] = [];
    for (const e of this.embeddings) {
      const chunk = this.chunksById.get(e.chunkId);
      if (!chunk) continue;
      if (!chunkMatches(chunk, filter)) continue;
      scored.push({ chunk, score: cosineSimilarity(queryVector, e.vector) });
    }
    return scored
      .filter((s) => s.score >= config.retrieval.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /**
   * Vector-only ranking across the filtered subcorpus, used by the hybrid
   * searcher. Returns every passing chunk with its cosine score; filtering
   * happens before scoring so BM25 + vector + RRF all operate on the same
   * subcorpus.
   */
  async rankAll(query: string, filter?: RetrievalFilter): Promise<SearchResult[]> {
    await this.ensureLoaded();
    const queryVector = await embed(query);
    const scored: SearchResult[] = [];
    for (const e of this.embeddings) {
      const chunk = this.chunksById.get(e.chunkId);
      if (!chunk) continue;
      if (!chunkMatches(chunk, filter)) continue;
      scored.push({ chunk, score: cosineSimilarity(queryVector, e.vector) });
    }
    return scored.sort((a, b) => b.score - a.score);
  }

  async allChunks(filter?: RetrievalFilter): Promise<DocumentChunk[]> {
    await this.ensureLoaded();
    const out: DocumentChunk[] = [];
    for (const chunk of this.chunksById.values()) {
      if (chunkMatches(chunk, filter)) out.push(chunk);
    }
    return out;
  }

  async count(filter?: RetrievalFilter): Promise<number> {
    await this.ensureLoaded();
    if (!filter) return this.embeddings.length;
    let n = 0;
    for (const chunk of this.chunksById.values()) {
      if (chunkMatches(chunk, filter)) n++;
    }
    return n;
  }

  async listDocuments(filter?: RetrievalFilter): Promise<{ documentId: string; fileName: string; chunkCount: number; matterId: string; docType: string }[]> {
    await this.ensureLoaded();
    const docs = new Map<string, { documentId: string; fileName: string; chunkCount: number; matterId: string; docType: string }>();
    for (const chunk of this.chunksById.values()) {
      if (!chunkMatches(chunk, filter)) continue;
      const e = docs.get(chunk.documentId);
      if (e) e.chunkCount++;
      else docs.set(chunk.documentId, {
        documentId: chunk.documentId,
        fileName: chunk.fileName,
        chunkCount: 1,
        matterId: chunk.matterId,
        docType: chunk.docType,
      });
    }
    return Array.from(docs.values());
  }
}

export const vectorStore = new LocalVectorStore();
