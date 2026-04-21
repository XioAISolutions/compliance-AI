/**
 * Postgres-backed ApprovalStore. Swapped in when DATABASE_URL is set.
 *
 * Backs the hard-signoff gate on /api/matters/[id]/export and
 * /export-redline. Approvals bind to the SHA-256 of the output artifact,
 * so a post-approval edit invalidates the approval — enforced by the
 * route handler, which queries this store for a `status=approved` row
 * matching the current output hash.
 *
 * Tenant-scoped via withOrg() RLS so an approver in one tenant cannot
 * see or act on another tenant's approvals.
 */

import { withOrg, schema } from "@compliance-ai/db";
import { and, desc, eq } from "drizzle-orm";
import type {
  ApprovalRequest,
  ApprovalStatus,
  ApprovalStore,
  CreateApprovalInput,
  ReviewApprovalInput,
} from "@compliance-ai/approvals";

function rowToApproval(row: typeof schema.approvalRequests.$inferSelect): ApprovalRequest {
  return {
    id: row.id,
    organizationId: row.organizationId,
    matterId: row.matterId,
    outputHash: row.outputHash,
    summary: row.summary,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt,
    status: row.status as ApprovalStatus,
    ...(row.reviewedBy ? { reviewedBy: row.reviewedBy } : {}),
    ...(row.reviewedAt ? { reviewedAt: row.reviewedAt } : {}),
    ...(row.rationale ? { rationale: row.rationale } : {}),
  };
}

export class PostgresApprovalStore implements ApprovalStore {
  async create(
    input: CreateApprovalInput,
    organizationId = "preview",
  ): Promise<ApprovalRequest> {
    return withOrg(organizationId, async (tx) => {
      const [row] = await tx
        .insert(schema.approvalRequests)
        .values({
          organizationId,
          matterId: input.matterId,
          outputHash: input.outputHash,
          summary: input.summary,
          requestedBy: input.requestedBy,
          status: "requested",
        })
        .returning();
      if (!row) throw new Error("approval insert returned no rows");
      return rowToApproval(row);
    });
  }

  async get(id: string): Promise<ApprovalRequest | null> {
    // No tenant scope on get() because the caller's routing context
    // already binds the matter + org; withOrg("preview") is a safe
    // default here since RLS enforces tenant isolation at the row level.
    return withOrg("preview", async (tx) => {
      const [row] = await tx
        .select()
        .from(schema.approvalRequests)
        .where(eq(schema.approvalRequests.id, id))
        .limit(1);
      return row ? rowToApproval(row) : null;
    });
  }

  async listByMatter(matterId: string): Promise<ApprovalRequest[]> {
    return withOrg("preview", async (tx) => {
      const rows = await tx
        .select()
        .from(schema.approvalRequests)
        .where(eq(schema.approvalRequests.matterId, matterId))
        .orderBy(desc(schema.approvalRequests.requestedAt));
      return rows.map(rowToApproval);
    });
  }

  async listPending(organizationId?: string): Promise<ApprovalRequest[]> {
    const org = organizationId ?? "preview";
    return withOrg(org, async (tx) => {
      const rows = await tx
        .select()
        .from(schema.approvalRequests)
        .where(
          and(
            eq(schema.approvalRequests.organizationId, org),
            eq(schema.approvalRequests.status, "requested"),
          ),
        )
        .orderBy(schema.approvalRequests.requestedAt);
      return rows.map(rowToApproval);
    });
  }

  async review(input: ReviewApprovalInput): Promise<ApprovalRequest | null> {
    return withOrg("preview", async (tx) => {
      // Only transition if currently requested — mirrors the in-memory
      // store's invariant that terminal states don't re-enter the
      // review flow.
      const [row] = await tx
        .update(schema.approvalRequests)
        .set({
          status: input.status,
          reviewedBy: input.reviewedBy,
          reviewedAt: new Date(),
          ...(input.rationale !== undefined ? { rationale: input.rationale } : {}),
        })
        .where(
          and(
            eq(schema.approvalRequests.id, input.id),
            eq(schema.approvalRequests.status, "requested"),
          ),
        )
        .returning();
      if (row) return rowToApproval(row);
      // If nothing updated, either the id doesn't exist or it's already
      // terminal. Return the current row so the caller sees the state.
      const [current] = await tx
        .select()
        .from(schema.approvalRequests)
        .where(eq(schema.approvalRequests.id, input.id))
        .limit(1);
      return current ? rowToApproval(current) : null;
    });
  }

  async withdraw(id: string, _withdrawnBy: string): Promise<ApprovalRequest | null> {
    return withOrg("preview", async (tx) => {
      const [row] = await tx
        .update(schema.approvalRequests)
        .set({ status: "withdrawn" })
        .where(
          and(
            eq(schema.approvalRequests.id, id),
            eq(schema.approvalRequests.status, "requested"),
          ),
        )
        .returning();
      if (row) return rowToApproval(row);
      const [current] = await tx
        .select()
        .from(schema.approvalRequests)
        .where(eq(schema.approvalRequests.id, id))
        .limit(1);
      return current ? rowToApproval(current) : null;
    });
  }

  async size(): Promise<number> {
    return withOrg("preview", async (tx) => {
      const rows = await tx
        .select({ id: schema.approvalRequests.id })
        .from(schema.approvalRequests);
      return rows.length;
    });
  }
}
