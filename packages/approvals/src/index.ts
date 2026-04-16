/**
 * @compliance-ai/approvals — review-and-approve workflow.
 *
 * An approval request is created when a reviewer reaches READY_TO_SUBMIT and
 * the user clicks "Request approval." The request gets routed to org
 * admins/owners. An approver reviews, then either approves or rejects with a
 * rationale. Both events write to the audit trail, so the chain records:
 *
 *   ... → generation → verdict(READY_TO_SUBMIT) → approval-requested →
 *   approval-granted → export
 *
 * This is the thinnest viable version — a full-featured multi-reviewer
 * workflow with attestations + e-signatures can layer in after this ships.
 */

import { randomUUID } from "node:crypto";

export type ApprovalStatus = "requested" | "approved" | "rejected" | "withdrawn";

export interface ApprovalRequest {
  id: string;
  organizationId: string;
  matterId: string;
  /** SHA-256 of the output being approved — binds the approval to a specific artifact. */
  outputHash: string;
  /** Short summary for the approver's queue view. */
  summary: string;
  /** Who requested the approval. */
  requestedBy: string;
  requestedAt: Date;
  status: ApprovalStatus;
  /** Who acted on the request. */
  reviewedBy?: string;
  reviewedAt?: Date;
  /** Approver's rationale / conditions. */
  rationale?: string;
}

export interface CreateApprovalInput {
  matterId: string;
  outputHash: string;
  summary: string;
  requestedBy: string;
}

export interface ReviewApprovalInput {
  id: string;
  status: "approved" | "rejected";
  reviewedBy: string;
  rationale?: string;
}

export interface ApprovalStore {
  create(input: CreateApprovalInput, organizationId?: string): Promise<ApprovalRequest>;
  get(id: string): Promise<ApprovalRequest | null>;
  listByMatter(matterId: string): Promise<ApprovalRequest[]>;
  listPending(organizationId?: string): Promise<ApprovalRequest[]>;
  review(input: ReviewApprovalInput): Promise<ApprovalRequest | null>;
  withdraw(id: string, withdrawnBy: string): Promise<ApprovalRequest | null>;
  size(): Promise<number>;
}

export class InMemoryApprovalStore implements ApprovalStore {
  private items = new Map<string, ApprovalRequest>();

  async create(
    input: CreateApprovalInput,
    organizationId = "preview",
  ): Promise<ApprovalRequest> {
    const item: ApprovalRequest = {
      id: randomUUID(),
      organizationId,
      matterId: input.matterId,
      outputHash: input.outputHash,
      summary: input.summary,
      requestedBy: input.requestedBy,
      requestedAt: new Date(),
      status: "requested",
    };
    this.items.set(item.id, item);
    return item;
  }

  async get(id: string): Promise<ApprovalRequest | null> {
    return this.items.get(id) ?? null;
  }

  async listByMatter(matterId: string): Promise<ApprovalRequest[]> {
    return Array.from(this.items.values())
      .filter((a) => a.matterId === matterId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  async listPending(organizationId?: string): Promise<ApprovalRequest[]> {
    return Array.from(this.items.values())
      .filter(
        (a) =>
          a.status === "requested" &&
          (organizationId === undefined || a.organizationId === organizationId),
      )
      .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime());
  }

  async review(input: ReviewApprovalInput): Promise<ApprovalRequest | null> {
    const item = this.items.get(input.id);
    if (!item) return null;
    if (item.status !== "requested") return item; // cannot re-review terminal states
    item.status = input.status;
    item.reviewedBy = input.reviewedBy;
    item.reviewedAt = new Date();
    if (input.rationale !== undefined) item.rationale = input.rationale;
    return item;
  }

  async withdraw(id: string, _withdrawnBy: string): Promise<ApprovalRequest | null> {
    const item = this.items.get(id);
    if (!item || item.status !== "requested") return item ?? null;
    item.status = "withdrawn";
    return item;
  }

  async size(): Promise<number> {
    return this.items.size;
  }
}
