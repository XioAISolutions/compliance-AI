import fs from "fs/promises";
import path from "path";
import { config } from "./config";
import { loadAllChunks, loadAllSections } from "./ingest";
import type { DocumentChunk, DocumentSection } from "./ingest";

/**
 * Compliance knowledge graph.
 *
 * Schema: typed nodes (Document, Section, Chunk) and a single generic edge
 * table with a `type` property. This shape keeps LLM-written Cypher clean
 * and lets the UI answer "cited by", "cites", and "what's in the ancestor
 * chain of this clause" from a single store.
 */

export type NodeType = "Document" | "Section" | "Chunk";
export type EdgeType =
  | "CONTAINS"      // Document -> Section, Section -> child Section, Section -> Chunk
  | "PARENT_OF"     // Section -> Section (structural hierarchy)
  | "REFERENCES"    // Chunk -> Section (resolved cross-reference)
  | "MENTIONS";     // Chunk -> unresolved textual reference (kept for audit)

export interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  documentId: string;
  fileName: string;
  pageNumber?: number;
  sectionNumber?: string | null;
  heading?: string | null;
}

export interface GraphEdge {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  excerpt?: string; // for REFERENCES: the phrase that triggered the link
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// --- Cross-reference extraction ----------------------------------------------

/**
 * Regex patterns that indicate a cross-reference. We match conservatively —
 * precision matters more than recall for citations.
 */
const XREF_PATTERNS: RegExp[] = [
  // "Section 4.3", "section 4.3.1", "Sec. 4"
  /\b(?:sec(?:tion|\.)?)\s+(\d+(?:\.\d+)*)/gi,
  // "§ 4.3" or "§4.3"
  /§\s?(\d+(?:\.\d+)*)/g,
  // "Article 12", "Art. 12"
  /\b(?:art(?:icle|\.)?)\s+(\d+(?:\.\d+)*)/gi,
  // "Part IV", "Part 2"
  /\bpart\s+([IVXLCDM]+|\d+)\b/gi,
  // "Chapter 5"
  /\bchapter\s+(\d+(?:\.\d+)*)/gi,
  // "Clause 4(1)(a)" — keep the outer number only
  /\bclause\s+(\d+(?:\.\d+)*)/gi,
  // "paragraph 4.3"
  /\bparagraph\s+(\d+(?:\.\d+)*)/gi,
];

export interface ExtractedRef {
  phrase: string;   // the raw text that matched
  number: string;   // the section number extracted
  position: number; // char offset into the chunk content
}

export function extractCrossReferences(text: string): ExtractedRef[] {
  const refs: ExtractedRef[] = [];
  const seen = new Set<string>();
  for (const pattern of XREF_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const number = m[1];
      const phrase = m[0];
      const position = m.index ?? 0;
      const key = `${number}@${position}`;
      if (seen.has(key)) continue;
      seen.add(key);
      refs.push({ phrase, number, position });
    }
  }
  return refs;
}

// --- Graph build -------------------------------------------------------------

function nodeIdForDocument(documentId: string): string {
  return `doc:${documentId}`;
}
function nodeIdForSection(sectionId: string): string {
  return `sec:${sectionId}`;
}
function nodeIdForChunk(chunkId: string): string {
  return `chk:${chunkId}`;
}

/**
 * Build a fresh graph from on-disk chunks + sections. Incremental updates are
 * simpler than they look: rebuilding is O(chunks) and cheap, so we just do it
 * every time new content is indexed.
 */
export async function buildGraph(): Promise<Graph> {
  const [chunks, sections] = await Promise.all([loadAllChunks(), loadAllSections()]);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  let edgeCounter = 0;
  const addEdge = (type: EdgeType, from: string, to: string, excerpt?: string) => {
    edges.push({ id: `e${edgeCounter++}`, type, from, to, excerpt });
  };

  // Document nodes
  const docsById = new Map<string, { documentId: string; fileName: string }>();
  for (const c of chunks) {
    if (!docsById.has(c.documentId)) docsById.set(c.documentId, { documentId: c.documentId, fileName: c.fileName });
  }
  for (const d of docsById.values()) {
    nodes.push({ id: nodeIdForDocument(d.documentId), type: "Document", label: d.fileName, documentId: d.documentId, fileName: d.fileName });
  }

  // Section nodes + structural edges
  const sectionsById = new Map<string, DocumentSection>();
  const sectionsByDocAndNumber = new Map<string, DocumentSection>(); // key: `${docId}:${number}`
  for (const s of sections) {
    sectionsById.set(s.id, s);
    if (s.number) sectionsByDocAndNumber.set(`${s.documentId}:${s.number}`, s);
    const fileName = docsById.get(s.documentId)?.fileName ?? "";
    nodes.push({
      id: nodeIdForSection(s.id),
      type: "Section",
      label: s.heading,
      documentId: s.documentId,
      fileName,
      pageNumber: s.pageNumber,
      sectionNumber: s.number,
      heading: s.heading,
    });
    if (s.parentId) {
      addEdge("PARENT_OF", nodeIdForSection(s.parentId), nodeIdForSection(s.id));
    } else {
      addEdge("CONTAINS", nodeIdForDocument(s.documentId), nodeIdForSection(s.id));
    }
  }

  // Chunk nodes + containment
  const chunksById = new Map<string, DocumentChunk>();
  for (const c of chunks) {
    chunksById.set(c.id, c);
    nodes.push({
      id: nodeIdForChunk(c.id),
      type: "Chunk",
      label: c.sectionHeader ?? `Chunk ${c.chunkIndex + 1}`,
      documentId: c.documentId,
      fileName: c.fileName,
      pageNumber: c.pageNumber,
      sectionNumber: c.sectionNumber,
      heading: c.sectionHeader,
    });
    if (c.sectionId) addEdge("CONTAINS", nodeIdForSection(c.sectionId), nodeIdForChunk(c.id));
    else addEdge("CONTAINS", nodeIdForDocument(c.documentId), nodeIdForChunk(c.id));
  }

  // Cross-references
  for (const c of chunks) {
    const refs = extractCrossReferences(c.content);
    for (const ref of refs) {
      // Don't link a chunk to the section it already lives in.
      if (c.sectionNumber === ref.number) continue;
      const target = sectionsByDocAndNumber.get(`${c.documentId}:${ref.number}`);
      if (target) {
        addEdge("REFERENCES", nodeIdForChunk(c.id), nodeIdForSection(target.id), ref.phrase);
      } else {
        // Keep an unresolved mention so audits can spot broken refs.
        addEdge("MENTIONS", nodeIdForChunk(c.id), `unresolved:${c.documentId}:${ref.number}`, ref.phrase);
      }
    }
  }

  return { nodes, edges };
}

export async function saveGraph(graph: Graph): Promise<void> {
  await fs.mkdir(path.dirname(config.paths.graph), { recursive: true });
  await fs.writeFile(config.paths.graph, JSON.stringify(graph, null, 2));
}

export interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  resolvedRefs: number;    // REFERENCES edges — chunk -> target section resolved
  unresolvedRefs: number;  // MENTIONS edges — cross-ref phrase we couldn't resolve
  unresolvedSamples: { phrase: string; fromChunkId: string; fileName: string }[];
}

export async function getGraphStats(): Promise<GraphStats> {
  const graph = await loadGraph();
  let resolvedRefs = 0;
  let unresolvedRefs = 0;
  const unresolvedSamples: GraphStats["unresolvedSamples"] = [];

  // Lazy-load chunks only if we have something to annotate.
  const needsChunks = graph.edges.some((e) => e.type === "MENTIONS");
  const chunksById = needsChunks
    ? new Map((await loadAllChunks()).map((c) => [c.id, c]))
    : new Map();

  for (const e of graph.edges) {
    if (e.type === "REFERENCES") resolvedRefs++;
    else if (e.type === "MENTIONS") {
      unresolvedRefs++;
      if (unresolvedSamples.length < 10) {
        const chunkId = e.from.startsWith("chk:") ? e.from.slice(4) : "";
        const chunk = chunksById.get(chunkId);
        unresolvedSamples.push({
          phrase: e.excerpt ?? "",
          fromChunkId: chunkId,
          fileName: chunk?.fileName ?? "",
        });
      }
    }
  }

  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    resolvedRefs,
    unresolvedRefs,
    unresolvedSamples,
  };
}

export async function loadGraph(): Promise<Graph> {
  try {
    const raw = await fs.readFile(config.paths.graph, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { nodes: [], edges: [] };
  }
}

// --- Context lookup ----------------------------------------------------------

export interface ContextResult {
  chunk: DocumentChunk;
  parents: { id: string; heading: string; number: string | null }[];
  cites: { chunkId: string; heading: string | null; fileName: string }[];
  citedBy: { chunkId: string; heading: string | null; fileName: string }[];
}

/**
 * One-shot context for a chunk: returns the chunk, the ancestor chain of
 * sections, its outgoing references, and the chunks whose references
 * resolve back to this chunk's section. Precomputing this at index time
 * means the source panel never has to traverse the graph on the UI thread.
 */
export async function getContext(chunkId: string): Promise<ContextResult | null> {
  const [chunks, sections, graph] = await Promise.all([loadAllChunks(), loadAllSections(), loadGraph()]);
  const chunk = chunks.find((c) => c.id === chunkId);
  if (!chunk) return null;

  const sectionsById = new Map(sections.map((s) => [s.id, s]));
  const chunksById = new Map(chunks.map((c) => [c.id, c]));

  // Parents: walk up the section tree.
  const parents: ContextResult["parents"] = [];
  let cursor: DocumentSection | undefined = chunk.sectionId ? sectionsById.get(chunk.sectionId) : undefined;
  while (cursor) {
    parents.push({ id: cursor.id, heading: cursor.heading, number: cursor.number });
    cursor = cursor.parentId ? sectionsById.get(cursor.parentId) : undefined;
  }

  // Cites: REFERENCES edges out of this chunk.
  const cites: ContextResult["cites"] = [];
  const chunkNode = `chk:${chunk.id}`;
  for (const e of graph.edges) {
    if (e.type !== "REFERENCES" || e.from !== chunkNode) continue;
    const sectionId = e.to.startsWith("sec:") ? e.to.slice(4) : null;
    if (!sectionId) continue;
    const sec = sectionsById.get(sectionId);
    if (!sec) continue;
    // Surface one representative chunk for the referenced section.
    const target = chunks.find((c) => c.sectionId === sec.id);
    if (!target) continue;
    cites.push({ chunkId: target.id, heading: sec.heading, fileName: sec.documentId === chunk.documentId ? chunk.fileName : (chunksById.get(target.id)?.fileName ?? "") });
  }

  // CitedBy: incoming REFERENCES whose target is this chunk's section.
  const citedBy: ContextResult["citedBy"] = [];
  if (chunk.sectionId) {
    const sectionNode = `sec:${chunk.sectionId}`;
    for (const e of graph.edges) {
      if (e.type !== "REFERENCES" || e.to !== sectionNode) continue;
      const sourceChunkId = e.from.startsWith("chk:") ? e.from.slice(4) : null;
      if (!sourceChunkId || sourceChunkId === chunk.id) continue;
      const src = chunksById.get(sourceChunkId);
      if (!src) continue;
      citedBy.push({ chunkId: src.id, heading: src.sectionHeader, fileName: src.fileName });
    }
  }

  // Dedupe by chunkId in case multiple refs resolved to the same target.
  const dedupe = <T extends { chunkId: string }>(arr: T[]) => {
    const seen = new Set<string>();
    return arr.filter((x) => (seen.has(x.chunkId) ? false : (seen.add(x.chunkId), true)));
  };

  return {
    chunk,
    parents,
    cites: dedupe(cites),
    citedBy: dedupe(citedBy),
  };
}
