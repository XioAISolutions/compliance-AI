/**
 * Approvals store factory — Postgres-backed when DATABASE_URL is set,
 * in-memory otherwise. Hard-signoff export gates rely on approvals
 * surviving a service restart; on Railway preview without a DB,
 * matters + approvals + audit all live in-memory and die with the
 * process.
 */

import { InMemoryApprovalStore, type ApprovalStore } from "@compliance-ai/approvals";

let _default: ApprovalStore | null = null;
let _override: ApprovalStore | null = null;

export function getDefaultApprovalStore(): ApprovalStore {
  if (_override) return _override;
  if (_default) return _default;

  if (process.env.DATABASE_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const mod = require("./postgres-approvals-store") as typeof import("./postgres-approvals-store");
      _default = new mod.PostgresApprovalStore();
      return _default;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("Postgres approval store unavailable, using in-memory:", err);
    }
  }

  _default = new InMemoryApprovalStore();
  return _default;
}

export function setApprovalStore(store: ApprovalStore | null): void {
  _override = store;
  if (store === null) _default = null;
}
