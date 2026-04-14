import path from "path";

const CORPUS_ROOT = path.resolve(process.env.CORPUS_PATH || "./compliance-brain/01-corpus");

export const config = {
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    embedModel: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
    chatModel: process.env.OLLAMA_CHAT_MODEL || "llama3.1:8b",
  },
  paths: {
    corpus: CORPUS_ROOT,
    /** Legacy corpus location — pre-matter chunks live here; migration tags them as matterId="default". */
    rawDocs: path.join(CORPUS_ROOT, "raw"),
    chunks: path.join(CORPUS_ROOT, "chunks"),
    vectorStore: path.resolve(process.env.VECTOR_STORE_PATH || path.join(CORPUS_ROOT, "vectors")),
    /** Per-matter storage root. Each matter gets a directory under here. */
    matters: path.join(CORPUS_ROOT, "matters"),
    /** Matter index lists every known matter (including `lib-*` shared libraries). */
    mattersIndex: path.resolve("./compliance-brain/00-core/matters-index.json"),
    citationLog: path.resolve(process.env.CITATION_LOG_PATH || "./compliance-brain/02-citations/citation-log.json"),
    auditLog: path.resolve(process.env.AUDIT_LOG_PATH || "./compliance-brain/04-audit/query-log.json"),
    graph: path.resolve(process.env.GRAPH_PATH || "./compliance-brain/05-graph/graph.json"),
  },
  chunking: {
    size: parseInt(process.env.CHUNK_SIZE || "500", 10),
    overlap: parseInt(process.env.CHUNK_OVERLAP || "50", 10),
  },
  retrieval: {
    topK: 5,
    minScore: 0.65,
  },
} as const;

export const DEFAULT_MATTER_ID = "default";

/**
 * Resolve the per-matter directory layout. `default` — the legacy matter
 * — keeps pointing at the existing top-level `chunks/`, `vectors/`, and
 * `raw/` directories so pre-migration corpora keep working unchanged.
 */
export function matterPaths(matterId: string) {
  if (matterId === DEFAULT_MATTER_ID) {
    return {
      root: config.paths.corpus,
      record: path.join(config.paths.matters, DEFAULT_MATTER_ID, "matter.json"),
      raw: config.paths.rawDocs,
      chunks: config.paths.chunks,
      vectors: config.paths.vectorStore,
      intake: path.join(config.paths.matters, DEFAULT_MATTER_ID, "intake"),
      drafts: path.join(config.paths.matters, DEFAULT_MATTER_ID, "drafts"),
      audit: path.join(config.paths.matters, DEFAULT_MATTER_ID, "audit"),
      graph: path.join(config.paths.matters, DEFAULT_MATTER_ID, "graph"),
    };
  }
  const root = path.join(config.paths.matters, matterId);
  return {
    root,
    record: path.join(root, "matter.json"),
    raw: path.join(root, "raw"),
    chunks: path.join(root, "chunks"),
    vectors: path.join(root, "vectors"),
    intake: path.join(root, "intake"),
    drafts: path.join(root, "drafts"),
    audit: path.join(root, "audit"),
    graph: path.join(root, "graph"),
  };
}

