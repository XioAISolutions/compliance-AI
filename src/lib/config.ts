import path from "path";

export const config = {
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
    embedModel: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text",
    chatModel: process.env.OLLAMA_CHAT_MODEL || "llama3.1:8b",
  },
  paths: {
    corpus: path.resolve(process.env.CORPUS_PATH || "./compliance-brain/01-corpus"),
    rawDocs: path.resolve(process.env.CORPUS_PATH || "./compliance-brain/01-corpus", "raw"),
    chunks: path.resolve(process.env.CORPUS_PATH || "./compliance-brain/01-corpus", "chunks"),
    vectorStore: path.resolve(process.env.VECTOR_STORE_PATH || "./compliance-brain/01-corpus/vectors"),
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
