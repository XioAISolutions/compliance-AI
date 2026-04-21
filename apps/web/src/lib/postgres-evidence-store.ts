/**
 * Postgres-backed EvidenceStore. Swapped in when DATABASE_URL is set.
 *
 * Same pattern as postgres-matter-store / postgres-approvals-store.
 * withOrg()-scoped for tenant isolation via RLS.
 *
 * The status-transition rules mirror the in-memory store:
 *   - Any update refreshes updatedAt.
 *   - Transitioning into "present" or "approved" sets collectedAt if
 *     not already set. This is the "first time the artifact was
 *     actually captured" timestamp.
 *   - Transitioning into "approved" sets reviewedAt (always; we do
 *     not preserve a prior reviewedAt because a re-approval is a
 *     new attestation).
 */

import { withOrg, schema } from "@compliance-ai/db";
import { asc, eq } from "drizzle-orm";
import type {
  CreateEvidenceInput,
  EvidenceItem,
  EvidenceStatus,
  EvidenceStore,
} from "./evidence-store";

function rowToItem(row: typeof schema.evidenceItems.$inferSelect): EvidenceItem {
  return {
    id: row.id,
    organizationId: row.organizationId,
    matterId: row.matterId,
    title: row.title,
    description: row.description,
    ...(row.source ? { source: row.source } : {}),
    status: row.status as EvidenceStatus,
    ...(row.requestedFrom ? { requestedFrom: row.requestedFrom } : {}),
    ...(row.fileUri ? { fileUri: row.fileUri } : {}),
    ...(row.sha256 ? { sha256: row.sha256 } : {}),
    ...(row.collectedAt ? { collectedAt: row.collectedAt } : {}),
    ...(row.reviewedAt ? { reviewedAt: row.reviewedAt } : {}),
    ...(row.reviewedBy ? { reviewedBy: row.reviewedBy } : {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PostgresEvidenceStore implements EvidenceStore {
  async create(
    input: CreateEvidenceInput,
    organizationId = "preview",
  ): Promise<EvidenceItem> {
    return withOrg(organizationId, async (tx) => {
      const [row] = await tx
        .insert(schema.evidenceItems)
        .values({
          organizationId,
          matterId: input.matterId,
          title: input.title,
          description: input.description,
          source: input.source ?? null,
          status: input.status ?? "missing",
          requestedFrom: input.requestedFrom ?? null,
        })
        .returning();
      if (!row) throw new Error("evidence insert returned no rows");
      return rowToItem(row);
    });
  }

  async get(id: string): Promise<EvidenceItem | null> {
    return withOrg("preview", async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.evidenceItems)
        .where(eq(schema.evidenceItems.id, id))
        .limit(1);
      return row ? rowToItem(row) : null;
    });
  }

  async list(matterId: string): Promise<EvidenceItem[]> {
    return withOrg("preview", async (tx) => {
      const rows = await tx
        .select()
        .from(schema.evidenceItems)
        .where(eq(schema.evidenceItems.matterId, matterId))
        .orderBy(asc(schema.evidenceItems.createdAt));
      return rows.map(rowToItem);
    });
  }

  async updateStatus(
    id: string,
    status: EvidenceStatus,
    extras: { fileUri?: string; sha256?: string; reviewedBy?: string } = {},
  ): Promise<EvidenceItem | null> {
    return withOrg("preview", async (tx) => {
      // Pull the current row first so we can decide whether to set
      // collectedAt (only on first transition into present/approved,
      // not on re-updates).
      const [current] = await tx
        .select()
        .from(schema.evidenceItems)
        .where(eq(schema.evidenceItems.id, id))
        .limit(1);
      if (!current) return null;

      const now = new Date();
      const updates: Record<string, unknown> = {
        status,
        updatedAt: now,
      };
      if (extras.fileUri !== undefined) updates.fileUri = extras.fileUri;
      if (extras.sha256 !== undefined) updates.sha256 = extras.sha256;
      if (extras.reviewedBy !== undefined) updates.reviewedBy = extras.reviewedBy;
      if ((status === "present" || status === "approved") && !current.collectedAt) {
        updates.collectedAt = now;
      }
      if (status === "approved") {
        updates.reviewedAt = now;
      }

      const [row] = await tx
        .update(schema.evidenceItems)
        .set(updates)
        .where(eq(schema.evidenceItems.id, id))
        .returning();
      return row ? rowToItem(row) : null;
    });
  }

  async delete(id: string): Promise<boolean> {
    return withOrg("preview", async (tx) => {
      const deleted = await tx
        .delete(schema.evidenceItems)
        .where(eq(schema.evidenceItems.id, id))
        .returning({ id: schema.evidenceItems.id });
      return deleted.length > 0;
    });
  }

  async size(matterId?: string): Promise<number> {
    return withOrg("preview", async (tx) => {
      if (matterId) {
        const rows = await tx
          .select({ id: schema.evidenceItems.id })
          .from(schema.evidenceItems)
          .where(eq(schema.evidenceItems.matterId, matterId));
        return rows.length;
      }
      const rows = await tx.select({ id: schema.evidenceItems.id }).from(schema.evidenceItems);
      return rows.length;
    });
  }
}
