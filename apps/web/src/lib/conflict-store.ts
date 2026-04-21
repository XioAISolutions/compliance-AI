/**
 * Conflict store — pre-matter conflict-search snapshots.
 *
 * Mirrors `packages/db/src/schema/conflict_checks.ts`. The matter-
 * creation route requires a cleared conflict-check id (or an explicit
 * operator override) before opening a new file — that's how we enforce
 * the LSO-mandated conflict-of-interest screen.
 *
 * In-memory backend used in tests + preview; Postgres backend swaps in
 * via the same factory pattern as matter-store / approvals-store /
 * audit-store / evidence-store.
 */

import { randomUUID } from "node:crypto";

export type ConflictDecision = "pending" | "cleared" | "declined";

export interface ConflictCheck {
  id: string;
  organizationId: string;
  clientName: string;
  opposingParty?: string;
  scope?: string;
  /** Matter ids that came back as potential conflicts. Empty array = no hits. */
  hitMatterIds: string[];
  decision: ConflictDecision;
  searchedBy: string;
  searchedAt: Date;
  decidedBy?: string;
  decidedAt?: Date;
  rationale?: string;
}

export interface CreateConflictCheckInput {
  clientName: string;
  opposingParty?: string;
  scope?: string;
  hitMatterIds: string[];
  searchedBy: string;
}

export interface DecideConflictCheckInput {
  id: string;
  decision: "cleared" | "declined";
  decidedBy: string;
  rationale?: string;
}

export interface ConflictStore {
  create(input: CreateConflictCheckInput, organizationId?: string): Promise<ConflictCheck>;
  get(id: string): Promise<ConflictCheck | null>;
  decide(input: DecideConflictCheckInput): Promise<ConflictCheck | null>;
  listRecent(organizationId?: string, limit?: number): Promise<ConflictCheck[]>;
  /** True iff the check exists and is in `cleared` state. Used by
   * /api/matters POST to gate matter creation. */
  isCleared(id: string): Promise<boolean>;
  size(): Promise<number>;
}

export class InMemoryConflictStore implements ConflictStore {
  private items = new Map<string, ConflictCheck>();

  async create(
    input: CreateConflictCheckInput,
    organizationId = "preview",
  ): Promise<ConflictCheck> {
    // No-hits checks land already-cleared because there is nothing for
    // a partner to review. The audit chain still records the search,
    // so the absence of conflicts is provable after the fact.
    const decision: ConflictDecision = input.hitMatterIds.length === 0 ? "cleared" : "pending";
    const item: ConflictCheck = {
      id: randomUUID(),
      organizationId,
      clientName: input.clientName,
      ...(input.opposingParty !== undefined ? { opposingParty: input.opposingParty } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      hitMatterIds: [...input.hitMatterIds],
      decision,
      searchedBy: input.searchedBy,
      searchedAt: new Date(),
      ...(decision === "cleared"
        ? { decidedBy: input.searchedBy, decidedAt: new Date() }
        : {}),
    };
    this.items.set(item.id, item);
    return item;
  }

  async get(id: string): Promise<ConflictCheck | null> {
    return this.items.get(id) ?? null;
  }

  async decide(input: DecideConflictCheckInput): Promise<ConflictCheck | null> {
    const item = this.items.get(input.id);
    if (!item) return null;
    if (item.decision !== "pending") return item; // terminal states are immutable
    item.decision = input.decision;
    item.decidedBy = input.decidedBy;
    item.decidedAt = new Date();
    if (input.rationale !== undefined) item.rationale = input.rationale;
    return item;
  }

  async listRecent(organizationId?: string, limit = 50): Promise<ConflictCheck[]> {
    const out = Array.from(this.items.values()).filter(
      (c) => organizationId === undefined || c.organizationId === organizationId,
    );
    out.sort((a, b) => b.searchedAt.getTime() - a.searchedAt.getTime());
    return out.slice(0, limit);
  }

  async isCleared(id: string): Promise<boolean> {
    const item = this.items.get(id);
    return Boolean(item && item.decision === "cleared");
  }

  async size(): Promise<number> {
    return this.items.size;
  }
}

let _default: ConflictStore | null = null;
let _override: ConflictStore | null = null;

export function getDefaultConflictStore(): ConflictStore {
  if (_override) return _override;
  if (_default) return _default;

  if (process.env.DATABASE_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const mod = require("./postgres-conflict-store") as typeof import("./postgres-conflict-store");
      _default = new mod.PostgresConflictStore();
      return _default;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Postgres conflict store unavailable, using in-memory:", err);
    }
  }

  _default = new InMemoryConflictStore();
  return _default;
}

export function setConflictStore(store: ConflictStore | null): void {
  _override = store;
  if (store === null) _default = null;
}

/**
 * Search live matters in the given store for potential conflicts with
 * the supplied parties. Match heuristic:
 *
 *   1. Case-insensitive substring match on `clientName` + `opposingParty`
 *      against historical `clientName` and `opposingParty` of every
 *      non-archived matter in the same org.
 *   2. We ALSO swap-search: a new client whose name matches a prior
 *      opposing party is the most dangerous case (the firm has been
 *      adverse to them before and may not represent them now).
 *
 * Returns the list of matter ids that came back as potential conflicts.
 * The decision (clear / decline / further review) belongs to a partner;
 * this function only flags candidates.
 */
export interface MatterLite {
  id: string;
  organizationId: string;
  status: string;
  clientName?: string;
  opposingParty?: string;
}

export function findConflictHits(
  candidates: readonly MatterLite[],
  query: { clientName: string; opposingParty?: string; organizationId: string },
): string[] {
  const newClient = norm(query.clientName);
  const newOpposing = query.opposingParty ? norm(query.opposingParty) : "";
  const hits: string[] = [];
  for (const m of candidates) {
    if (m.organizationId !== query.organizationId) continue;
    if (m.status === "archived") continue;
    const priorClient = norm(m.clientName ?? "");
    const priorOpposing = norm(m.opposingParty ?? "");
    // Direct same-side matches (we already represent this client OR
    // we are already adverse to this counterparty — both are
    // potential conflicts that need partner review).
    if (newClient && (priorClient.includes(newClient) || newClient.includes(priorClient)) && priorClient.length > 0) {
      hits.push(m.id);
      continue;
    }
    if (newOpposing && (priorOpposing.includes(newOpposing) || newOpposing.includes(priorOpposing)) && priorOpposing.length > 0) {
      hits.push(m.id);
      continue;
    }
    // Swap matches — adverse-to-prior-client or new-client-was-prior-opposing.
    if (newClient && priorOpposing.length > 0 && (priorOpposing.includes(newClient) || newClient.includes(priorOpposing))) {
      hits.push(m.id);
      continue;
    }
    if (newOpposing && priorClient.length > 0 && (priorClient.includes(newOpposing) || newOpposing.includes(priorClient))) {
      hits.push(m.id);
      continue;
    }
  }
  return hits;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
