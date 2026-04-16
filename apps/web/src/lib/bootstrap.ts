/**
 * Tenant bootstrap — ensures a tenant's core seed data is present.
 *
 * Called lazily from route handlers on first hit. Idempotent:
 * repeated calls are no-ops once the tenant has been seeded.
 *
 * For the preview tenant, this seeds the Ontario/EMD authority corpus so
 * reviewer context has something to retrieve against. For real tenants
 * (Layer 4+) this is where onboarding-time provisioning hooks attach.
 */

import {
  getDefaultCognitionStore,
  ONTARIO_EMD_AUTHORITIES,
} from "@compliance-ai/cognition";

const _seeded = new Set<string>();

/**
 * Ensure the given tenant has baseline seed data. Safe to call on every
 * request — the first call does the work, subsequent calls short-circuit.
 */
export async function ensureTenant(organizationId = "preview"): Promise<void> {
  if (_seeded.has(organizationId)) return;

  const cognition = getDefaultCognitionStore();
  const existing = await cognition.size();
  if (existing === 0) {
    // Tag every seed item with the tenant id so retrieval filtering works.
    const items = ONTARIO_EMD_AUTHORITIES.map((item) => ({
      ...item,
      organizationId,
    }));
    await cognition.addBatch(items);
  }

  _seeded.add(organizationId);
}

/** Reset the in-memory seeded set. Test-only. */
export function resetBootstrapState(): void {
  _seeded.clear();
}
