/**
 * In-memory matter store — preview mode.
 *
 * Mirrors the DB schema from `packages/db/src/schema/matters.ts` but runs
 * entirely in-process. Day 3 swaps this for Drizzle + Postgres.
 *
 * The store is a process-wide singleton (same as the cognition store).
 */

import { randomUUID } from "node:crypto";

export type Jurisdiction = "ontario" | "quebec" | "british-columbia" | "alberta" | "federal";
export type RegistrationCategory = "emd" | "pm" | "iiroc" | "issuer" | "none";
export type TaskType = "om-review" | "kyc-gap-check" | "marketing-signoff" | "response-memo";
export type MatterStatus = "open" | "in-review" | "complete" | "archived";
export type DocumentType =
  | "authority-rule"
  | "regulatory-guidance"
  | "offering-memo"
  | "kyc-aml-file"
  | "marketing-material"
  | "reference-material"
  | "other";

export interface Matter {
  id: string;
  organizationId: string;
  title: string;
  jurisdiction: Jurisdiction;
  registrationCategory: RegistrationCategory;
  taskType: TaskType;
  status: MatterStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatterDocument {
  id: string;
  matterId: string;
  filename: string;
  documentType: DocumentType;
  chunkCount: number;
  sha256?: string;
  pageCount?: number;
  createdAt: Date;
}

/**
 * A stored chunk of a document. Mirrors `DocumentChunk` from @compliance-ai/ingest
 * plus the `matterId` it belongs to (for matter-scoped retrieval).
 */
export interface StoredChunk {
  id: string;
  docId: string;
  matterId: string;
  ordinal: number;
  content: string;
  charStart: number;
  charEnd: number;
  page?: number;
  tokenCount: number;
}

export interface CreateMatterInput {
  title: string;
  jurisdiction: Jurisdiction;
  registrationCategory: RegistrationCategory;
  taskType: TaskType;
}

class MatterStore {
  private matters = new Map<string, Matter>();
  private documents = new Map<string, MatterDocument[]>();
  /** chunks keyed by docId. */
  private chunksByDoc = new Map<string, StoredChunk[]>();
  /** Fast lookup: all chunks per matter (flattened across docs). */
  private chunksByMatter = new Map<string, StoredChunk[]>();

  create(input: CreateMatterInput, organizationId = "preview"): Matter {
    const id = randomUUID();
    const now = new Date();
    const matter: Matter = {
      id,
      organizationId,
      title: input.title,
      jurisdiction: input.jurisdiction,
      registrationCategory: input.registrationCategory,
      taskType: input.taskType,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    this.matters.set(id, matter);
    this.documents.set(id, []);
    return matter;
  }

  get(id: string): Matter | null {
    return this.matters.get(id) ?? null;
  }

  list(organizationId = "preview"): Matter[] {
    return Array.from(this.matters.values())
      .filter((m) => m.organizationId === organizationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  updateStatus(id: string, status: MatterStatus): Matter | null {
    const matter = this.matters.get(id);
    if (!matter) return null;
    matter.status = status;
    matter.updatedAt = new Date();
    return matter;
  }

  addDocument(
    matterId: string,
    filename: string,
    documentType: DocumentType,
    extras: { sha256?: string; pageCount?: number } = {},
  ): MatterDocument {
    const doc: MatterDocument = {
      id: randomUUID(),
      matterId,
      filename,
      documentType,
      chunkCount: 0,
      createdAt: new Date(),
      ...(extras.sha256 ? { sha256: extras.sha256 } : {}),
      ...(extras.pageCount !== undefined ? { pageCount: extras.pageCount } : {}),
    };
    const docs = this.documents.get(matterId) ?? [];
    docs.push(doc);
    this.documents.set(matterId, docs);
    return doc;
  }

  getDocuments(matterId: string): MatterDocument[] {
    return this.documents.get(matterId) ?? [];
  }

  /**
   * Attach chunks to a document. Updates the document's chunkCount and
   * maintains fast lookup by matterId.
   */
  addChunks(
    matterId: string,
    docId: string,
    chunks: Array<Omit<StoredChunk, "matterId">>,
  ): StoredChunk[] {
    const stored: StoredChunk[] = chunks.map((c) => ({ ...c, matterId }));
    this.chunksByDoc.set(docId, stored);

    const matterChunks = this.chunksByMatter.get(matterId) ?? [];
    matterChunks.push(...stored);
    this.chunksByMatter.set(matterId, matterChunks);

    // Update the document's chunk count.
    const docs = this.documents.get(matterId) ?? [];
    const doc = docs.find((d) => d.id === docId);
    if (doc) {
      doc.chunkCount = stored.length;
    }

    return stored;
  }

  getChunksByDoc(docId: string): StoredChunk[] {
    return this.chunksByDoc.get(docId) ?? [];
  }

  getChunksByMatter(matterId: string): StoredChunk[] {
    return this.chunksByMatter.get(matterId) ?? [];
  }

  size(): number {
    return this.matters.size;
  }
}

let _default: MatterStore | null = null;
export function getDefaultMatterStore(): MatterStore {
  if (!_default) _default = new MatterStore();
  return _default;
}
