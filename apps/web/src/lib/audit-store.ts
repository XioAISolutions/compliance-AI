/**
 * Audit log — interface + in-memory backend.
 *
 * Hash-chained: each entry includes the SHA-256 of the previous entry,
 * making retroactive tampering detectable.
 *
 * The interface is async so the Postgres-backed implementation can satisfy
 * it. Factory picks backend based on DATABASE_URL.
 */

import { createHash, randomUUID } from "node:crypto";

export type AuditAction =
  | "query"
  | "retrieval"
  | "generation"
  | "verdict"
  | "export"
  /**
   * Hard human signoff gate denied an export attempt. The audit entry
   * records the output hash and any pending approvals so a compliance
   * review can see why the export was blocked.
   */
  | "export-blocked";

export interface AuditEntry {
  id: string;
  matterId: string;
  organizationId: string;
  timestamp: Date;
  actor: string;
  action: AuditAction;
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

export interface AuditStore {
  append(
    matterId: string,
    entry: Omit<AuditEntry, "id" | "timestamp" | "prevRowHash">,
  ): Promise<AuditEntry>;
  getByMatter(matterId: string): Promise<AuditEntry[]>;
  verify(matterId: string): Promise<boolean>;
  size(matterId?: string): Promise<number>;
}

export class InMemoryAuditStore implements AuditStore {
  private entries = new Map<string, AuditEntry[]>();
  private lastHash = new Map<string, string>();

  async append(
    matterId: string,
    entry: Omit<AuditEntry, "id" | "timestamp" | "prevRowHash">,
  ): Promise<AuditEntry> {
    const prevRowHash = this.lastHash.get(matterId) ?? null;
    const full: AuditEntry = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date(),
      prevRowHash,
    };

    const rowHash = sha256(JSON.stringify(full));
    this.lastHash.set(matterId, rowHash);

    const list = this.entries.get(matterId) ?? [];
    list.push(full);
    this.entries.set(matterId, list);
    return full;
  }

  async getByMatter(matterId: string): Promise<AuditEntry[]> {
    return (this.entries.get(matterId) ?? []).slice().reverse();
  }

  async verify(matterId: string): Promise<boolean> {
    const list = this.entries.get(matterId) ?? [];
    let expectedPrev: string | null = null;
    for (const entry of list) {
      if (entry.prevRowHash !== expectedPrev) return false;
      expectedPrev = sha256(JSON.stringify(entry));
    }
    return true;
  }

  async size(matterId?: string): Promise<number> {
    if (matterId) return (this.entries.get(matterId) ?? []).length;
    let total = 0;
    for (const list of this.entries.values()) total += list.length;
    return total;
  }
}

let _default: AuditStore | null = null;
let _override: AuditStore | null = null;

export function getDefaultAuditStore(): AuditStore {
  if (_override) return _override;
  if (_default) return _default;

  if (process.env.DATABASE_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const mod = require("./postgres-audit-store") as typeof import("./postgres-audit-store");
      _default = new mod.PostgresAuditStore();
      return _default;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Postgres audit store unavailable, using in-memory:", err);
    }
  }

  _default = new InMemoryAuditStore();
  return _default;
}

export function setAuditStore(store: AuditStore | null): void {
  _override = store;
  if (store === null) _default = null;
}
