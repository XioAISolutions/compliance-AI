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
  createdAt: Date;
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
    opts: { chunkCount?: number } = {},
  ): MatterDocument {
    const doc: MatterDocument = {
      id: randomUUID(),
      matterId,
      filename,
      documentType,
      chunkCount: opts.chunkCount ?? 0,
      createdAt: new Date(),
    };
    const docs = this.documents.get(matterId) ?? [];
    docs.push(doc);
    this.documents.set(matterId, docs);
    return doc;
  }

  /** Update the chunk count on an existing document (after async ingestion). */
  setDocumentChunkCount(docId: string, chunkCount: number): MatterDocument | null {
    for (const docs of this.documents.values()) {
      const match = docs.find((d) => d.id === docId);
      if (match) {
        match.chunkCount = chunkCount;
        return match;
      }
    }
    return null;
  }

  getDocuments(matterId: string): MatterDocument[] {
    return this.documents.get(matterId) ?? [];
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
