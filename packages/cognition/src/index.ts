export type { CognitionItem, CognitionStore, RetrievalQuery, RetrievalResult } from "./types.js";
export { InMemoryCognitionStore } from "./in-memory.js";
export { ONTARIO_EMD_AUTHORITIES } from "./authorities.js";

import { InMemoryCognitionStore } from "./in-memory.js";
import type { CognitionStore } from "./types.js";

/**
 * The product surfaces two distinct cognition corpora:
 *   - "securities" — Ontario/EMD authorities seeded for matter-scoped work
 *   - "infosec"    — SOC 2 / GDPR / EU AI Act / ISO 27001 artifacts for the
 *                    `/controls` surface (not seeded yet, but kept isolated)
 *
 * A single default store previously meant the two surfaces shared items.
 * With matter-scoped filters, the damage was limited, but a user browsing the
 * infosec catalog would still retrieve securities authorities for any query
 * that matched the Jaccard threshold. Keying the singleton by surface makes
 * cross-surface contamination impossible.
 */
export type CognitionSurface = "securities" | "infosec";

const _surfaceStores = new Map<CognitionSurface, CognitionStore>();

export function getDefaultCognitionStore(
  surface: CognitionSurface = "securities",
): CognitionStore {
  let store = _surfaceStores.get(surface);
  if (!store) {
    store = new InMemoryCognitionStore();
    _surfaceStores.set(surface, store);
  }
  return store;
}

export function setDefaultCognitionStore(
  store: CognitionStore,
  surface: CognitionSurface = "securities",
): void {
  _surfaceStores.set(surface, store);
}

/** Test helper — reset all surface stores back to empty. */
export function resetDefaultCognitionStores(): void {
  _surfaceStores.clear();
}
