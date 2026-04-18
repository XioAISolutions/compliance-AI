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
  CANADA_CONSUMER_PROTECTION_AUTHORITIES,
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
  if (surface === "securities") {
    // Ontario EMD / NI 45-106 securities corpus plus the pan-Canadian
    // consumer protection corpus — every province and territory + federal.
    // Retrieval is scoped per matter by jurisdiction + registrationCategory,
    // so a securities matter still sees only securities items and a
    // consumer-protection matter still sees only consumer-protection items.
    //
    // Additive seed: we filter the target corpus against the store's
    // existing items (by id within the tenant scope) and only add the
    // missing ones. This keeps the bootstrap idempotent across process
    // restarts AND lets new corpus entries land on existing tenants
    // without a manual reset. Before this change the bootstrap gated on
    // `existing === 0`, which silently skipped newly-added seeds on any
    // tenant that had already been initialised.
    const existing = await cognition.getAll();
    const existingIds = new Set(
      existing
        .filter((item) => item.organizationId === organizationId)
        .map((item) => item.id)
        .filter((id): id is string => Boolean(id)),
    );
    const target = [
      ...ONTARIO_EMD_AUTHORITIES,
      ...CANADA_CONSUMER_PROTECTION_AUTHORITIES,
    ];
    const missing = target
      .filter((item) => item.id && !existingIds.has(item.id))
      .map((item) => ({ ...item, organizationId }));
    if (missing.length > 0) {
      await cognition.addBatch(missing);
    }
  }

  _seeded.add(key);
}

/** Reset the in-memory seeded set. Test-only. */
export function resetBootstrapState(): void {
  _seeded.clear();
}
