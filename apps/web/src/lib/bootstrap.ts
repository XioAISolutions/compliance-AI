/**
 * Tenant bootstrap — ensures a tenant's core seed data is present.
 *
 * Called lazily from route handlers on first hit. Idempotent:
 * repeated calls are no-ops once the tenant has been seeded.
 *
 * For the preview tenant, this seeds the Canadian authority corpus so
 * reviewer context has something to retrieve against. US authorities
 * are NOT seeded by default — the /api/ask cross-jurisdiction endpoint
 * can load them on-demand when a US comparison is requested, but they
 * should never pollute the default Authority Library shown on the home
 * page or the matter review context.
 */

import {
  getDefaultCognitionStore,
  type CognitionSurface,
  ONTARIO_EMD_AUTHORITIES,
} from "@compliance-ai/cognition";

const _seeded = new Set<string>();

/**
 * Ensure the given tenant has baseline seed data. Safe to call on every
 * request — the first call does the work, subsequent calls short-circuit.
 *
 * Seeds the Canadian authority corpus only. US authorities are available
 * via US_SECURITIES_AUTHORITIES in @compliance-ai/cognition but are not
 * loaded into the default store — they're loaded on-demand by the /api/ask
 * endpoint when doing cross-jurisdiction comparisons.
 */
export async function ensureTenant(
  organizationId = "preview",
  surface: CognitionSurface = "securities",
): Promise<void> {
  const key = `${surface}:${organizationId}`;
  if (_seeded.has(key)) return;

  const cognition = getDefaultCognitionStore(surface);
  const existing = await cognition.size();
  if (surface === "securities" && existing === 0) {
    const items = ONTARIO_EMD_AUTHORITIES.map((item) => ({
      ...item,
      organizationId,
    }));
    await cognition.addBatch(items);
  }

  _seeded.add(key);
}

/** Reset the in-memory seeded set. Test-only. */
export function resetBootstrapState(): void {
  _seeded.clear();
}
