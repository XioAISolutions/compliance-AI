/**
 * In-memory audit log — preview mode.
 *
 * Hash-chained: each entry includes the SHA-256 of the previous entry,
 * making retroactive tampering detectable. Day 3 swaps this for the
 * Drizzle-backed audit_log table.
 */

import { createHash, randomUUID } from "node:crypto";

export interface AuditEntry {
  id: string;
  matterId: string;
  organizationId: string;
  timestamp: Date;
  actor: string;
  action: "query" | "retrieval" | "generation" | "verdict" | "export" | "upload";
  inputHash: string;
  authoritiesUsed: string[];
  outputHash: string | null;
  judgeVerdict: string | null;
  prevRowHash: string | null;
  inputContent: string | null;
  outputContent: string | null;
}

export function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

class AuditStore {
  private entries = new Map<string, AuditEntry[]>();
  private lastHash = new Map<string, string>();

  append(
    matterId: string,
    entry: Omit<AuditEntry, "id" | "timestamp" | "prevRowHash">,
  ): AuditEntry {
    const prevRowHash = this.lastHash.get(matterId) ?? null;
    const full: AuditEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date(),
      prevRowHash,
    };

    // Compute this row's hash for chaining
    const rowHash = sha256(JSON.stringify(full));
    this.lastHash.set(matterId, rowHash);

    const list = this.entries.get(matterId) ?? [];
    list.push(full);
    this.entries.set(matterId, list);
    return full;
  }

  getByMatter(matterId: string): AuditEntry[] {
    return (this.entries.get(matterId) ?? []).slice().reverse();
  }

  verify(matterId: string): boolean {
    const list = this.entries.get(matterId) ?? [];
    let expectedPrev: string | null = null;
    for (const entry of list) {
      if (entry.prevRowHash !== expectedPrev) return false;
      expectedPrev = sha256(JSON.stringify(entry));
    }
    return true;
  }

  size(matterId?: string): number {
    if (matterId) return (this.entries.get(matterId) ?? []).length;
    let total = 0;
    for (const list of this.entries.values()) total += list.length;
    return total;
  }
}

let _default: AuditStore | null = null;
export function getDefaultAuditStore(): AuditStore {
  if (!_default) _default = new AuditStore();
  return _default;
}
