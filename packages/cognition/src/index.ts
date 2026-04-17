export type { CognitionItem, CognitionStore, RetrievalQuery, RetrievalResult } from "./types.js";
export { InMemoryCognitionStore } from "./in-memory.js";
export { ONTARIO_EMD_AUTHORITIES, FINTRAC_KYC_AUTHORITIES } from "./authorities.js";
export { NI_45_106_AUTHORITIES } from "./ni-45-106-authorities.js";
export {
  NI_45_102_RESALE_AUTHORITIES,
  CP_45_106_COMPANION_POLICY_AUTHORITIES,
  CSA_STAFF_NOTICES_45,
  NI_45_106_COMPANION_AUTHORITIES,
} from "./ni-45-106-companion-authorities.js";

import { InMemoryCognitionStore } from "./in-memory.js";
import type { CognitionStore } from "./types.js";

export type CognitionSurface = "securities" | "infosec";

/**
 * Returns a process-wide singleton store per surface. The default backend is in-memory;
 * production code should construct a Postgres-backed store explicitly via
 * `packages/db` (Day 3+) and pass it where needed instead of using this.
 */
const _defaults = new Map<CognitionSurface, CognitionStore>();

export function getDefaultCognitionStore(surface: CognitionSurface = "securities"): CognitionStore {
  let store = _defaults.get(surface);
  if (!store) {
    store = new InMemoryCognitionStore();
    _defaults.set(surface, store);
  }
  return store;
}

export function setDefaultCognitionStore(
  store: CognitionStore | null,
  surface: CognitionSurface = "securities",
): void {
  if (store) {
    _defaults.set(surface, store);
  } else {
    _defaults.delete(surface);
  }
}
