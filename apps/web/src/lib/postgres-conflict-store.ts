/**
 * Postgres-backed ConflictStore. Swapped in when DATABASE_URL is set.
 *
 * Same pattern as the other persistent stores. withOrg()-scoped for
 * tenant isolation via RLS.
 *
 * The hitMatterIds list is stored as a JSON-encoded string (the
 * schema uses text). Tradeoff: simpler schema, no array-overlap
 * indexing — the matter-creation gate only needs id-based lookup, so
 * nothing here pays for an array column.
 */

import { withOrg, schema } from "@compliance-ai/db";
import { and, desc, eq } from "drizzle-orm";
import type {
  ConflictCheck,
  ConflictDecision,
  ConflictStore,
  CreateConflictCheckInput,
  DecideConflictCheckInput,
} from "./conflict-store";

function rowToCheck(row: typeof schema.conflictChecks.$inferSelect): ConflictCheck {
  let hitIds: string[] = [];
  try {
    const parsed = JSON.parse(row.hitMatterIds);
    if (Array.isArray(parsed)) hitIds = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    // Tolerate malformed legacy rows by treating them as zero-hits;
    // that's a fail-open posture but the only safer alternative is
    // to refuse to load the row at all, which would silently break
    // the matters list. Surface the parse error to logs for ops.
    // eslint-disable-next-line no-console
    console.warn(`[conflict] malformed hitMatterIds for check ${row.id}`);
  }
  return {
    id: row.id,
    organizationId: row.organizationId,
    clientName: row.clientName,
    ...(row.opposingParty ? { opposingParty: row.opposingParty } : {}),
    ...(row.scope ? { scope: row.scope } : {}),
    hitMatterIds: hitIds,
    decision: row.decision as ConflictDecision,
    searchedBy: row.searchedBy,
    searchedAt: row.searchedAt,
    ...(row.decidedBy ? { decidedBy: row.decidedBy } : {}),
    ...(row.decidedAt ? { decidedAt: row.decidedAt } : {}),
    ...(row.rationale ? { rationale: row.rationale } : {}),
  };
}

export class PostgresConflictStore implements ConflictStore {
  async create(
    input: CreateConflictCheckInput,
    organizationId = "preview",
  ): Promise<ConflictCheck> {
    return withOrg(organizationId, async (tx) => {
      // Auto-clear no-hit checks (mirrors the in-memory store), so the
      // search itself is the audit record without needing a partner
      // ceremony for every empty result.
      const decision: ConflictDecision = input.hitMatterIds.length === 0 ? "cleared" : "pending";
      const now = new Date();
      const [row] = await tx
        .insert(schema.conflictChecks)
        .values({
          organizationId,
          clientName: input.clientName,
          opposingParty: input.opposingParty ?? null,
          scope: input.scope ?? null,
          hitMatterIds: JSON.stringify(input.hitMatterIds),
          decision,
          searchedBy: input.searchedBy,
          searchedAt: now,
          ...(decision === "cleared" ? { decidedBy: input.searchedBy, decidedAt: now } : {}),
        })
        .returning();
      if (!row) throw new Error("conflict_checks insert returned no rows");
      return rowToCheck(row);
    });
  }

  async get(id: string): Promise<ConflictCheck | null> {
    return withOrg("preview", async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.conflictChecks)
        .where(eq(schema.conflictChecks.id, id))
        .limit(1);
      return row ? rowToCheck(row) : null;
    });
  }

  async decide(input: DecideConflictCheckInput): Promise<ConflictCheck | null> {
    return withOrg("preview", async (tx) => {
      // Only transition pending → terminal. Mirrors the in-memory
      // invariant that terminal states are immutable.
      const [row] = await tx
        .update(schema.conflictChecks)
        .set({
          decision: input.decision,
          decidedBy: input.decidedBy,
          decidedAt: new Date(),
          ...(input.rationale !== undefined ? { rationale: input.rationale } : {}),
        })
        .where(
          and(
            eq(schema.conflictChecks.id, input.id),
            eq(schema.conflictChecks.decision, "pending"),
          ),
        )
        .returning();
      if (row) return rowToCheck(row);
      const [current] = await tx
        .select()
        .from(schema.conflictChecks)
        .where(eq(schema.conflictChecks.id, input.id))
        .limit(1);
      return current ? rowToCheck(current) : null;
    });
  }

  async listRecent(organizationId?: string, limit = 50): Promise<ConflictCheck[]> {
    const org = organizationId ?? "preview";
    return withOrg(org, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.conflictChecks)
        .where(eq(schema.conflictChecks.organizationId, org))
        .orderBy(desc(schema.conflictChecks.searchedAt))
        .limit(limit);
      return rows.map(rowToCheck);
    });
  }

  async isCleared(id: string): Promise<boolean> {
    return withOrg("preview", async (tx) => {
      const [row] = await tx
        .select({ decision: schema.conflictChecks.decision })
        .from(schema.conflictChecks)
        .where(eq(schema.conflictChecks.id, id))
        .limit(1);
      return row?.decision === "cleared";
    });
  }

  async size(): Promise<number> {
    return withOrg("preview", async (tx) => {
      const rows = await tx
        .select({ id: schema.conflictChecks.id })
        .from(schema.conflictChecks);
      return rows.length;
    });
  }
}
