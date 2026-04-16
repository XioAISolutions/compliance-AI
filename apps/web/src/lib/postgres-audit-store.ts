/**
 * Postgres-backed AuditStore. Swapped in when DATABASE_URL is set.
 *
 * Hash chain computation happens in-transaction so concurrent appends to
 * the same matter can't interleave and break the chain. The `prevRowHash`
 * is derived from the most recent entry for this matter.
 */

import { withOrg, schema } from "@compliance-ai/db";
import { eq, desc, count } from "drizzle-orm";
import {
  sha256,
  type AuditAction,
  type AuditEntry,
  type AuditStore,
} from "./audit-store";

const PREVIEW_ORG_ID = "preview";

export class PostgresAuditStore implements AuditStore {
  async append(
    matterId: string,
    entry: Omit<AuditEntry, "id" | "timestamp" | "prevRowHash">,
  ): Promise<AuditEntry> {
    return withOrg(entry.organizationId, async (tx) => {
      // Read the most recent row for this matter to compute prevRowHash.
      const [latest] = await tx
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.matterId, matterId))
        .orderBy(desc(schema.auditLog.timestamp))
        .limit(1);

      // We hash the full row shape (minus id/timestamp, which don't exist yet)
      // to compute the chain. Storing prevRowHash = sha256(JSON(latest)) keeps
      // the chain verifiable against any future row shape change because we
      // hash the stored form.
      const prevRowHash = latest
        ? sha256(
            JSON.stringify({
              id: latest.id,
              matterId: latest.matterId,
              organizationId: latest.organizationId,
              timestamp: latest.timestamp,
              actor: latest.actor,
              action: latest.action,
              inputHash: latest.inputHash,
              authoritiesUsed: latest.authoritiesUsed,
              outputHash: latest.outputHash,
              judgeVerdict: latest.judgeVerdict,
              prevRowHash: latest.prevRowHash,
              inputContent: latest.inputContent,
              outputContent: latest.outputContent,
            }),
          )
        : null;

      const [row] = await tx
        .insert(schema.auditLog)
        .values({
          matterId,
          organizationId: entry.organizationId,
          actor: entry.actor,
          action: entry.action,
          inputHash: entry.inputHash,
          authoritiesUsed: entry.authoritiesUsed,
          outputHash: entry.outputHash ?? null,
          judgeVerdict: entry.judgeVerdict ?? null,
          prevRowHash,
          inputContent: entry.inputContent ?? null,
          outputContent: entry.outputContent ?? null,
        })
        .returning();

      if (!row) throw new Error("Audit log insert failed");
      return rowToEntry(row);
    });
  }

  async getByMatter(matterId: string): Promise<AuditEntry[]> {
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.matterId, matterId))
        .orderBy(desc(schema.auditLog.timestamp));
      return rows.map(rowToEntry);
    });
  }

  async verify(matterId: string): Promise<boolean> {
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.matterId, matterId))
        .orderBy(schema.auditLog.timestamp);

      let expectedPrev: string | null = null;
      for (const row of rows) {
        if (row.prevRowHash !== expectedPrev) return false;
        expectedPrev = sha256(
          JSON.stringify({
            id: row.id,
            matterId: row.matterId,
            organizationId: row.organizationId,
            timestamp: row.timestamp,
            actor: row.actor,
            action: row.action,
            inputHash: row.inputHash,
            authoritiesUsed: row.authoritiesUsed,
            outputHash: row.outputHash,
            judgeVerdict: row.judgeVerdict,
            prevRowHash: row.prevRowHash,
            inputContent: row.inputContent,
            outputContent: row.outputContent,
          }),
        );
      }
      return true;
    });
  }

  async size(matterId?: string): Promise<number> {
    return withOrg(PREVIEW_ORG_ID, async (tx) => {
      const query = tx.select({ c: count() }).from(schema.auditLog);
      const [result] = matterId
        ? await query.where(eq(schema.auditLog.matterId, matterId))
        : await query;
      return Number(result?.c ?? 0);
    });
  }
}

function rowToEntry(row: typeof schema.auditLog.$inferSelect): AuditEntry {
  return {
    id: row.id,
    matterId: row.matterId,
    organizationId: row.organizationId,
    timestamp: row.timestamp,
    actor: row.actor,
    action: row.action as AuditAction,
    inputHash: row.inputHash,
    authoritiesUsed: (row.authoritiesUsed as string[]) ?? [],
    outputHash: row.outputHash,
    judgeVerdict: row.judgeVerdict,
    prevRowHash: row.prevRowHash,
    inputContent: row.inputContent,
    outputContent: row.outputContent,
  };
}
