/**
 * Evidence store — per-matter evidence items (requests, artifacts, approvals).
 *
 * Mirrors the DB schema in packages/db/src/schema/evidence_items.ts. The
 * in-memory backend is used in tests and preview. A Postgres backend can
 * be added alongside via the same factory pattern as matter-store / audit-store.
 */

import { randomUUID } from "node:crypto";

export type EvidenceStatus = "missing" | "requested" | "stale" | "present" | "approved";

export interface EvidenceItem {
  id: string;
  organizationId: string;
  matterId: string;
  title: string;
  description: string;
  source?: string;
  status: EvidenceStatus;
  requestedFrom?: string;
  fileUri?: string;
  sha256?: string;
  collectedAt?: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateEvidenceInput {
  matterId: string;
  title: string;
  description: string;
  source?: string;
  status?: EvidenceStatus;
  requestedFrom?: string;
}

export interface EvidenceStore {
  create(input: CreateEvidenceInput, organizationId?: string): Promise<EvidenceItem>;
  get(id: string): Promise<EvidenceItem | null>;
  list(matterId: string): Promise<EvidenceItem[]>;
  updateStatus(
    id: string,
    status: EvidenceStatus,
    extras?: {
      fileUri?: string;
      sha256?: string;
      reviewedBy?: string;
    },
  ): Promise<EvidenceItem | null>;
  delete(id: string): Promise<boolean>;
  size(matterId?: string): Promise<number>;
}

export class InMemoryEvidenceStore implements EvidenceStore {
  private items = new Map<string, EvidenceItem>();

  async create(input: CreateEvidenceInput, organizationId = "preview"): Promise<EvidenceItem> {
    const now = new Date();
    const item: EvidenceItem = {
      id: randomUUID(),
      organizationId,
      matterId: input.matterId,
      title: input.title,
      description: input.description,
      ...(input.source !== undefined ? { source: input.source } : {}),
      status: input.status ?? "missing",
      ...(input.requestedFrom !== undefined ? { requestedFrom: input.requestedFrom } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(item.id, item);
    return item;
  }

  async get(id: string): Promise<EvidenceItem | null> {
    return this.items.get(id) ?? null;
  }

  async list(matterId: string): Promise<EvidenceItem[]> {
    return Array.from(this.items.values())
      .filter((e) => e.matterId === matterId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async updateStatus(
    id: string,
    status: EvidenceStatus,
    extras: { fileUri?: string; sha256?: string; reviewedBy?: string } = {},
  ): Promise<EvidenceItem | null> {
    const item = this.items.get(id);
    if (!item) return null;
    item.status = status;
    item.updatedAt = new Date();
    if (extras.fileUri !== undefined) item.fileUri = extras.fileUri;
    if (extras.sha256 !== undefined) item.sha256 = extras.sha256;
    if (extras.reviewedBy !== undefined) item.reviewedBy = extras.reviewedBy;
    if (status === "present" || status === "approved") {
      if (!item.collectedAt) item.collectedAt = new Date();
    }
    if (status === "approved") {
      item.reviewedAt = new Date();
    }
    return item;
  }

  async delete(id: string): Promise<boolean> {
    return this.items.delete(id);
  }

  async size(matterId?: string): Promise<number> {
    if (!matterId) return this.items.size;
    return Array.from(this.items.values()).filter((e) => e.matterId === matterId).length;
  }
}

let _default: EvidenceStore | null = null;
let _override: EvidenceStore | null = null;

export function getDefaultEvidenceStore(): EvidenceStore {
  if (_override) return _override;
  if (_default) return _default;
  _default = new InMemoryEvidenceStore();
  // Postgres swap mirrors matter-store; omitted for brevity — same pattern.
  return _default;
}

export function setEvidenceStore(store: EvidenceStore | null): void {
  _override = store;
  if (store === null) _default = null;
}

/**
 * Parse the reviewer's output to extract PARTIAL/MISSING checklist rows and
 * auto-generate evidence requests.
 *
 * Heuristic: look for markdown table rows with status FOUND/PARTIAL/MISSING.
 * Each PARTIAL or MISSING row becomes an evidence item. Extract the
 * Requirement column as the title, Notes column as description, Rule
 * Reference column as source.
 */
export function extractEvidenceRequests(
  reviewerOutput: string,
): Array<Omit<CreateEvidenceInput, "matterId">> {
  const requests: Array<Omit<CreateEvidenceInput, "matterId">> = [];
  const lines = reviewerOutput.split("\n");

  for (const line of lines) {
    // Table row pattern: | # | Requirement | Rule Reference | Status | Notes |
    if (!line.startsWith("|") || !line.includes("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cells.length < 4) continue;
    const statusCell = cells.find((c) => /\b(FOUND|PARTIAL|MISSING)\b/i.test(c));
    if (!statusCell) continue;
    const upperStatus = statusCell.toUpperCase();
    if (!upperStatus.includes("PARTIAL") && !upperStatus.includes("MISSING")) continue;

    // Heuristic column positions: [#, Requirement, Rule Reference, Status, Notes]
    const [, requirement, ruleRef, , notes] = cells;
    if (!requirement) continue;

    const title = stripMarkdown(requirement);
    const description = notes ? stripMarkdown(notes) : `Evidence needed to satisfy: ${title}`;
    const source = ruleRef ? stripMarkdown(ruleRef) : undefined;

    requests.push({
      title,
      description,
      source,
      status: upperStatus.includes("MISSING") ? "missing" : "requested",
    });
  }

  return requests;
}

function stripMarkdown(s: string): string {
  return (
    s
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/`/g, "")
      // Strip inline citation markers like [c1][c2] that the OM reviewer
      // routinely embeds in checklist cells. The [cN] markers resolve to
      // the citations JSON in the review deliverable — in an evidence
      // request title or description they just add visual noise and make
      // a reviewer scanning the list guess what "[c4]" means out of
      // context. Two passes: first drop markers preceded by whitespace
      // (so " [c1]" next to a period becomes "."), then drop any
      // remaining markers; finally collapse multi-space runs.
      .replace(/\s+\[c\d+\]/g, "")
      .replace(/\[c\d+\]/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}
