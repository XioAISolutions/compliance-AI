/**
 * Matter store — interface + in-memory backend.
 *
 * The interface is async so the Postgres-backed implementation can satisfy
 * it without leaking sync-vs-async concerns to callers. The in-memory
 * backend is still used for tests and for preview mode when DATABASE_URL
 * is unset.
 *
 * Factory (`getDefaultMatterStore`) picks the right backend based on env:
 *   DATABASE_URL set   → Postgres-backed
 *   DATABASE_URL unset → in-memory singleton
 */

import { randomUUID } from "node:crypto";

export type Jurisdiction = "ontario" | "quebec" | "british-columbia" | "alberta" | "federal";
export type RegistrationCategory = "emd" | "pm" | "iiroc" | "issuer" | "none";
export type TaskType = "om-review" | "kyc-gap-check" | "marketing-signoff" | "response-memo";
/**
 * Matter state machine:
 *
 *   open ──(first /review call)──▶ in-review ──(READY_TO_SUBMIT)──▶ complete
 *                                        │
 *                                        ├──(ITERATE after maxRounds)──▶ needs-revision
 *                                        │
 *                                        ├──(REWRITE after maxRounds)──▶ blocked
 *                                        │
 *                                        └──(review errored)──────────▶ blocked
 *
 *   complete | needs-revision | blocked ──(human action)──▶ archived
 *
 * `needs-revision` is a soft stop: the drafter produced cited output but the
 * judge didn't sign off within the round cap. A human can pick up from the
 * current draft without losing anything.
 *
 * `blocked` is a hard stop: either the judge's REWRITE verdict says the
 * fundamental approach is wrong, or a runtime error made the review
 * unreliable. Don't auto-rerun — a human must look.
 */
export type MatterStatus =
  | "open"
  | "in-review"
  | "complete"
  | "needs-revision"
  | "blocked"
  | "archived";
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

/**
 * Contract for matter storage. Both InMemoryMatterStore and
 * PostgresMatterStore implement this interface.
 */
export interface MatterStore {
  create(input: CreateMatterInput, organizationId?: string): Promise<Matter>;
  get(id: string): Promise<Matter | null>;
  list(organizationId?: string): Promise<Matter[]>;
  updateStatus(id: string, status: MatterStatus): Promise<Matter | null>;
  addDocument(
    matterId: string,
    filename: string,
    documentType: DocumentType,
    extras?: { sha256?: string; pageCount?: number },
  ): Promise<MatterDocument>;
  getDocuments(matterId: string): Promise<MatterDocument[]>;
  addChunks(
    matterId: string,
    docId: string,
    chunks: Array<Omit<StoredChunk, "matterId">>,
  ): Promise<StoredChunk[]>;
  getChunksByDoc(docId: string): Promise<StoredChunk[]>;
  getChunksByMatter(matterId: string): Promise<StoredChunk[]>;
  size(): Promise<number>;
}

export class InMemoryMatterStore implements MatterStore {
  private matters = new Map<string, Matter>();
  private documents = new Map<string, MatterDocument[]>();
  private chunksByDoc = new Map<string, StoredChunk[]>();
  private chunksByMatter = new Map<string, StoredChunk[]>();

  async create(input: CreateMatterInput, organizationId = "preview"): Promise<Matter> {
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

  async get(id: string): Promise<Matter | null> {
    return this.matters.get(id) ?? null;
  }

  async list(organizationId = "preview"): Promise<Matter[]> {
    return Array.from(this.matters.values())
      .filter((m) => m.organizationId === organizationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateStatus(id: string, status: MatterStatus): Promise<Matter | null> {
    const matter = this.matters.get(id);
    if (!matter) return null;
    matter.status = status;
    matter.updatedAt = new Date();
    return matter;
  }

  async addDocument(
    matterId: string,
    filename: string,
    documentType: DocumentType,
    extras: { sha256?: string; pageCount?: number } = {},
  ): Promise<MatterDocument> {
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

  async getDocuments(matterId: string): Promise<MatterDocument[]> {
    return this.documents.get(matterId) ?? [];
  }

  async addChunks(
    matterId: string,
    docId: string,
    chunks: Array<Omit<StoredChunk, "matterId">>,
  ): Promise<StoredChunk[]> {
    const stored: StoredChunk[] = chunks.map((c) => ({ ...c, matterId }));
    this.chunksByDoc.set(docId, stored);

    const matterChunks = this.chunksByMatter.get(matterId) ?? [];
    matterChunks.push(...stored);
    this.chunksByMatter.set(matterId, matterChunks);

    const docs = this.documents.get(matterId) ?? [];
    const doc = docs.find((d) => d.id === docId);
    if (doc) {
      doc.chunkCount = stored.length;
    }

    return stored;
  }

  async getChunksByDoc(docId: string): Promise<StoredChunk[]> {
    return this.chunksByDoc.get(docId) ?? [];
  }

  async getChunksByMatter(matterId: string): Promise<StoredChunk[]> {
    return this.chunksByMatter.get(matterId) ?? [];
  }

  async size(): Promise<number> {
    return this.matters.size;
  }
}

let _default: MatterStore | null = null;
let _override: MatterStore | null = null;

/**
 * Process-wide singleton. Picks Postgres backend when DATABASE_URL is set,
 * otherwise in-memory for dev/preview. Override with `setMatterStore` for
 * tests.
 *
 * Note: we import the Postgres backend lazily via require() at runtime. Only
 * works in a Node runtime (Next.js API routes set `runtime = "nodejs"`).
 */
export function getDefaultMatterStore(): MatterStore {
  if (_override) return _override;
  if (_default) return _default;

  if (process.env.DATABASE_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const mod = require("./postgres-matter-store") as typeof import("./postgres-matter-store");
      _default = new mod.PostgresMatterStore();
      return _default;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Postgres matter store unavailable, using in-memory:", err);
    }
  }

  _default = new InMemoryMatterStore();
  return _default;
}

/** Override the default store. Used by tests. */
export function setMatterStore(store: MatterStore | null): void {
  _override = store;
  if (store === null) _default = null;
}
