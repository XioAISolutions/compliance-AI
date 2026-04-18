/**
 * Postgres-backed MatterStore. Swapped in when DATABASE_URL is set.
 *
 * All reads/writes go through `withOrg()` to enforce RLS. The tenant id
 * currently defaults to "preview" — Layer 4 replaces this with the
 * authenticated session's organizationId.
 */

import {
  withOrg,
  schema,
  type MatterRow,
  type MatterDocumentRow,
  type DocumentChunkRow,
} from "@compliance-ai/db";
import { eq, desc } from "drizzle-orm";
import type {
  ClaimType,
  CourtLevel,
  CreateMatterInput,
  DocumentType,
  Jurisdiction,
  LegalRegime,
  Matter,
  MatterDocument,
  MatterListFilters,
  MatterStatus,
  MatterStore,
  ProceduralPosture,
  RegistrationCategory,
  StoredChunk,
  TaskType,
} from "./matter-store";

const PREVIEW_ORG_ID = "preview";

export class PostgresMatterStore implements MatterStore {
  async create(input: CreateMatterInput, organizationId = PREVIEW_ORG_ID): Promise<Matter> {
    return withOrg(organizationId, async (tx) => {
      const [row] = await tx
        .insert(schema.matters)
        .values({
          organizationId,
          title: input.title,
          jurisdiction: input.jurisdiction,
          registrationCategory: input.registrationCategory,
          taskType: input.taskType,
          status: "open",
          // Consumer-law fields — nullable, passed through when present
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
        })
        .returning();
      if (!row) throw new Error("Insert failed");
      return toMatter(row);
    });
  }

  async get(id: string): Promise<Matter | null> {
    // We don't know the org yet; do a scoped read using PREVIEW_ORG_ID
    // (which will be replaced with session.organizationId in Layer 4).
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      const [row] = await tx.select().from(schema.matters).where(eq(schema.matters.id, id));
      return row ? toMatter(row) : null;
    });
  }

  async list(organizationId = PREVIEW_ORG_ID, _filters?: MatterListFilters): Promise<Matter[]> {
    return withOrg(organizationId, async (tx) => {
      // Filters are applied in-memory after fetching the org-scoped rows.
      // For large datasets, push these into SQL WHERE clauses with Drizzle
      // conditions. At current scale (< 1000 matters), post-fetch filtering
      // is simpler and avoids complex query composition.
      let rows = await tx
        .select()
        .from(schema.matters)
        .where(eq(schema.matters.organizationId, organizationId))
        .orderBy(desc(schema.matters.createdAt));

      if (_filters) {
        if (_filters.status) rows = rows.filter((r) => r.status === _filters.status);
        if (_filters.claimType) rows = rows.filter((r) => r.claimType === _filters.claimType);
        if (_filters.proceduralPosture)
          rows = rows.filter((r) => r.proceduralPosture === _filters.proceduralPosture);
        if (_filters.classActionOnly) rows = rows.filter((r) => r.classActionFlag === true);
        if (_filters.search) {
          const q = _filters.search.toLowerCase();
          rows = rows.filter(
            (r) =>
              r.title.toLowerCase().includes(q) ||
              r.clientName?.toLowerCase().includes(q) ||
              r.opposingParty?.toLowerCase().includes(q),
          );
        }
      }

      return rows.map(toMatter);
    });
  }

  async update(id: string, fields: Partial<CreateMatterInput>): Promise<Matter | null> {
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      const [row] = await tx
        .update(schema.matters)
        .set({ ...fields, updatedAt: new Date() } as Record<string, unknown>)
        .where(eq(schema.matters.id, id))
        .returning();
      return row ? toMatter(row) : null;
    });
  }

  async updateStatus(id: string, status: MatterStatus): Promise<Matter | null> {
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      const [row] = await tx
        .update(schema.matters)
        .set({ status, updatedAt: new Date() })
        .where(eq(schema.matters.id, id))
        .returning();
      return row ? toMatter(row) : null;
    });
  }

  async addDocument(
    matterId: string,
    filename: string,
    documentType: DocumentType,
    extras: { sha256?: string; pageCount?: number } = {},
  ): Promise<MatterDocument> {
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      const [row] = await tx
        .insert(schema.matterDocuments)
        .values({
          matterId,
          organizationId: PREVIEW_ORG_ID,
          filename,
          documentType,
          chunkCount: 0,
          sha256: extras.sha256 ?? "",
          pageCount: extras.pageCount ?? null,
        })
        .returning();
      if (!row) throw new Error("Insert failed");
      return toMatterDocument(row);
    });
  }

  async getDocuments(matterId: string): Promise<MatterDocument[]> {
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.matterDocuments)
        .where(eq(schema.matterDocuments.matterId, matterId));
      return rows.map(toMatterDocument);
    });
  }

  async addChunks(
    matterId: string,
    docId: string,
    chunks: Array<Omit<StoredChunk, "matterId">>,
  ): Promise<StoredChunk[]> {
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      if (chunks.length === 0) return [];

      const rows = await tx
        .insert(schema.documentChunks)
        .values(
          chunks.map((c) => ({
            documentId: docId,
            matterId,
            organizationId: PREVIEW_ORG_ID,
            ordinal: c.ordinal,
            content: c.content,
            charStart: c.charStart,
            charEnd: c.charEnd,
            page: c.page ?? null,
            tokenCount: c.tokenCount,
          })),
        )
        .returning();

      // Update the document's chunkCount in the same transaction.
      await tx
        .update(schema.matterDocuments)
        .set({ chunkCount: rows.length })
        .where(eq(schema.matterDocuments.id, docId));

      return rows.map(toStoredChunk);
    });
  }

  async getChunksByDoc(docId: string): Promise<StoredChunk[]> {
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.documentChunks)
        .where(eq(schema.documentChunks.documentId, docId));
      return rows.map(toStoredChunk);
    });
  }

  async getChunksByMatter(matterId: string): Promise<StoredChunk[]> {
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.documentChunks)
        .where(eq(schema.documentChunks.matterId, matterId));
      return rows.map(toStoredChunk);
    });
  }

  async size(): Promise<number> {
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      const rows = await tx
        .select({ id: schema.matters.id })
        .from(schema.matters)
        .where(eq(schema.matters.organizationId, PREVIEW_ORG_ID));
      return rows.length;
    });
  }
}

// Row → domain adapters. Kept in this file because the row types are
// implementation details of the Postgres backend.
function toMatter(row: MatterRow): Matter {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    jurisdiction: row.jurisdiction as Jurisdiction,
    registrationCategory: row.registrationCategory as RegistrationCategory,
    taskType: row.taskType as TaskType,
    status: row.status as MatterStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // Consumer-law fields — map from nullable DB columns to optional TS fields
    ...(row.clientName ? { clientName: row.clientName } : {}),
    ...(row.opposingParty ? { opposingParty: row.opposingParty } : {}),
    ...(row.courtLevel ? { courtLevel: row.courtLevel as CourtLevel } : {}),
    ...(row.legalRegime ? { legalRegime: row.legalRegime as LegalRegime[] } : {}),
    ...(row.claimType ? { claimType: row.claimType as ClaimType } : {}),
    ...(row.classActionFlag !== null && row.classActionFlag !== undefined
      ? { classActionFlag: row.classActionFlag }
      : {}),
    ...(row.estimatedClassSize ? { estimatedClassSize: row.estimatedClassSize } : {}),
    ...(row.harmDescription ? { harmDescription: row.harmDescription } : {}),
    ...(row.proceduralPosture
      ? { proceduralPosture: row.proceduralPosture as ProceduralPosture }
      : {}),
    ...(row.limitationDate ? { limitationDate: row.limitationDate } : {}),
    ...(row.certificationDate ? { certificationDate: row.certificationDate } : {}),
    ...(row.nextDeadline ? { nextDeadline: row.nextDeadline } : {}),
    ...(row.nextDeadlineLabel ? { nextDeadlineLabel: row.nextDeadlineLabel } : {}),
  };
}

function toMatterDocument(row: MatterDocumentRow): MatterDocument {
  return {
    id: row.id,
    matterId: row.matterId,
    filename: row.filename,
    documentType: row.documentType as DocumentType,
    chunkCount: row.chunkCount,
    ...(row.sha256 ? { sha256: row.sha256 } : {}),
    ...(row.pageCount !== null && row.pageCount !== undefined
      ? { pageCount: row.pageCount }
      : {}),
    createdAt: row.createdAt,
  };
}

function toStoredChunk(row: DocumentChunkRow): StoredChunk {
  return {
    id: row.id,
    docId: row.documentId,
    matterId: row.matterId,
    ordinal: row.ordinal,
    content: row.content,
    charStart: row.charStart,
    charEnd: row.charEnd,
    ...(row.page !== null && row.page !== undefined ? { page: row.page } : {}),
    tokenCount: row.tokenCount,
  };
}

