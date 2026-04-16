/**
 * Approvals store factory — reuses the in-memory backend from the
 * @compliance-ai/approvals package. Postgres backend would swap in via the
 * same factory pattern as matter-store / audit-store (deferred to follow-up).
 */

import { InMemoryApprovalStore, type ApprovalStore } from "@compliance-ai/approvals";

let _default: ApprovalStore | null = null;
let _override: ApprovalStore | null = null;

export function getDefaultApprovalStore(): ApprovalStore {
  if (_override) return _override;
  if (_default) return _default;
  _default = new InMemoryApprovalStore();
  return _default;
}

export function setApprovalStore(store: ApprovalStore | null): void {
  _override = store;
  if (store === null) _default = null;
}
