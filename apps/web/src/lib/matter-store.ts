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

export type Jurisdiction =
  | "ontario"
  | "quebec"
  | "british-columbia"
  | "alberta"
  | "saskatchewan"
  | "manitoba"
  | "nova-scotia"
  | "new-brunswick"
  | "newfoundland"
  | "pei"
  | "northwest-territories"
  | "yukon"
  | "nunavut"
  | "federal"
  | "multi-provincial";
export type RegistrationCategory = "emd" | "pm" | "iiroc" | "issuer" | "none";
export type TaskType =
  | "om-review"
  | "kyc-gap-check"
  | "marketing-signoff"
  | "response-memo"
  | "court-ai-disclosure"
  | "missing-authority-scan"
  | "pipeda-check"
  | "contract-redline";
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

// ---------------------------------------------------------------------------
// Consumer-law enums — additive to the existing securities-focused types.
// ---------------------------------------------------------------------------

export type CourtLevel =
  | "superior"
  | "federal"
  | "small-claims"
  | "divisional"
  | "court-of-appeal"
  | "supreme";

export type LegalRegime =
  | "cpa-ontario"
  | "cpa-quebec"
  | "cpa-bc"
  | "cpa-alberta"
  | "cpa-saskatchewan"
  | "cpa-manitoba"
  | "cpa-nova-scotia"
  | "cpa-new-brunswick"
  | "cpa-newfoundland"
  | "cpa-pei"
  | "competition-act"
  | "pipeda"
  | "casl"
  | "securities-act"
  | "ni-45-106"
  | "ni-31-103"
  | "ni-81-102"
  | "criminal-code"
  | "other";

export type ClaimType =
  | "false-advertising"
  | "defective-product"
  | "hidden-fees"
  | "data-breach"
  | "privacy-misuse"
  | "unfair-terms"
  | "telemarketing-spam"
  | "price-fixing"
  | "other";

export type ProceduralPosture =
  | "investigation"
  | "pre-litigation"
  | "proposed-class"
  | "certification"
  | "discovery"
  | "settlement"
  | "trial"
  | "appeal"
  | "closed";

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
  // Consumer-law fields — all optional for back-compat with existing
  // securities matters. Populated via the /matters/new wizard when the
  // user selects "Consumer Law" as the matter type.
  clientName?: string;
  opposingParty?: string;
  courtLevel?: CourtLevel;
  legalRegime?: LegalRegime[];
  claimType?: ClaimType;
  classActionFlag?: boolean;
  estimatedClassSize?: string;
  harmDescription?: string;
  proceduralPosture?: ProceduralPosture;
  limitationDate?: Date;
  certificationDate?: Date;
  nextDeadline?: Date;
  nextDeadlineLabel?: string;
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
  // Consumer-law fields — all optional for back-compat.
  clientName?: string;
  opposingParty?: string;
  courtLevel?: CourtLevel;
  legalRegime?: LegalRegime[];
  claimType?: ClaimType;
  classActionFlag?: boolean;
  estimatedClassSize?: string;
  harmDescription?: string;
  proceduralPosture?: ProceduralPosture;
  limitationDate?: Date;
  certificationDate?: Date;
  nextDeadline?: Date;
  nextDeadlineLabel?: string;
}

/** Filter parameters for the list() query. All optional — no filter = return all. */
export interface MatterListFilters {
  status?: MatterStatus;
  claimType?: ClaimType;
  proceduralPosture?: ProceduralPosture;
  classActionOnly?: boolean;
  hasOverdueDeadline?: boolean;
  search?: string;
}

/**
 * Contract for matter storage. Both InMemoryMatterStore and
 * PostgresMatterStore implement this interface.
 */
export interface MatterStore {
  create(input: CreateMatterInput, organizationId?: string): Promise<Matter>;
  get(id: string): Promise<Matter | null>;
  list(organizationId?: string, filters?: MatterListFilters): Promise<Matter[]>;
  update(id: string, fields: Partial<CreateMatterInput>): Promise<Matter | null>;
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
      // Consumer-law fields — pass through from input
      ...(input.clientName ? { clientName: input.clientName } : {}),
      ...(input.opposingParty ? { opposingParty: input.opposingParty } : {}),
      ...(input.courtLevel ? { courtLevel: input.courtLevel } : {}),
      ...(input.legalRegime ? { legalRegime: input.legalRegime } : {}),
      ...(input.claimType ? { claimType: input.claimType } : {}),
      ...(input.classActionFlag !== undefined ? { classActionFlag: input.classActionFlag } : {}),
      ...(input.estimatedClassSize ? { estimatedClassSize: input.estimatedClassSize } : {}),
      ...(input.harmDescription ? { harmDescription: input.harmDescription } : {}),
      ...(input.proceduralPosture ? { proceduralPosture: input.proceduralPosture } : {}),
      ...(input.limitationDate ? { limitationDate: input.limitationDate } : {}),
      ...(input.certificationDate ? { certificationDate: input.certificationDate } : {}),
      ...(input.nextDeadline ? { nextDeadline: input.nextDeadline } : {}),
      ...(input.nextDeadlineLabel ? { nextDeadlineLabel: input.nextDeadlineLabel } : {}),
    };
    this.matters.set(id, matter);
    this.documents.set(id, []);
    return matter;
  }

  async get(id: string): Promise<Matter | null> {
    return this.matters.get(id) ?? null;
  }

  async list(organizationId = "preview", filters?: MatterListFilters): Promise<Matter[]> {
    let results = Array.from(this.matters.values()).filter(
      (m) => m.organizationId === organizationId,
    );
    if (filters?.status) results = results.filter((m) => m.status === filters.status);
    if (filters?.claimType) results = results.filter((m) => m.claimType === filters.claimType);
    if (filters?.proceduralPosture)
      results = results.filter((m) => m.proceduralPosture === filters.proceduralPosture);
    if (filters?.classActionOnly) results = results.filter((m) => m.classActionFlag === true);
    if (filters?.hasOverdueDeadline) {
      const now = new Date();
      results = results.filter((m) => m.nextDeadline && m.nextDeadline < now);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      results = results.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.clientName?.toLowerCase().includes(q) ||
          m.opposingParty?.toLowerCase().includes(q),
      );
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async update(id: string, fields: Partial<CreateMatterInput>): Promise<Matter | null> {
    const matter = this.matters.get(id);
    if (!matter) return null;
    Object.assign(matter, fields, { updatedAt: new Date() });
    return matter;
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
