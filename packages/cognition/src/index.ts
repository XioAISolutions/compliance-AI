export type { CognitionItem, CognitionStore, RetrievalQuery, RetrievalResult, SourceType } from "./types.js";
export { InMemoryCognitionStore } from "./in-memory.js";
export { inferSourceType } from "./source-type.js";
export type { SourceHints } from "./source-type.js";
export { ONTARIO_EMD_AUTHORITIES, FINTRAC_KYC_AUTHORITIES } from "./authorities.js";
export { NI_45_106_AUTHORITIES } from "./ni-45-106-authorities.js";
export {
  NI_45_102_RESALE_AUTHORITIES,
  CP_45_106_COMPANION_POLICY_AUTHORITIES,
  CSA_STAFF_NOTICES_45,
  NI_45_106_COMPANION_AUTHORITIES,
} from "./ni-45-106-companion-authorities.js";
export { US_SECURITIES_AUTHORITIES } from "./us-securities-authorities.js";

// Pan-Canadian consumer protection corpus — every province/territory +
// Federal + Multi-provincial harmonisation templates. See
// canada-consumer-protection-authorities.ts for the aggregator and the
// per-jurisdiction files for the individual exports.
export { FEDERAL_CONSUMER_PROTECTION_AUTHORITIES } from "./federal-consumer-protection-authorities.js";
export { ONTARIO_CONSUMER_PROTECTION_AUTHORITIES } from "./ontario-consumer-protection-authorities.js";
export { QUEBEC_CONSUMER_PROTECTION_AUTHORITIES } from "./quebec-consumer-protection-authorities.js";
export { BC_BPCPA_AUTHORITIES } from "./british-columbia-consumer-protection-authorities.js";
export { ALBERTA_CPA_AUTHORITIES } from "./alberta-consumer-protection-authorities.js";
export {
  SASKATCHEWAN_CPBPA_AUTHORITIES,
  MANITOBA_CONSUMER_PROTECTION_AUTHORITIES,
} from "./prairies-consumer-protection-authorities.js";
export {
  NOVA_SCOTIA_CPA_AUTHORITIES,
  NEW_BRUNSWICK_CPA_AUTHORITIES,
  NEWFOUNDLAND_CPBPA_AUTHORITIES,
  PEI_CPA_AUTHORITIES,
} from "./atlantic-consumer-protection-authorities.js";
export {
  YUKON_CPA_AUTHORITIES,
  NWT_CPA_AUTHORITIES,
  NUNAVUT_CPA_AUTHORITIES,
} from "./territories-consumer-protection-authorities.js";
export { MULTI_PROVINCIAL_CONSUMER_PROTECTION_AUTHORITIES } from "./multi-provincial-consumer-protection-authorities.js";
export { CANADA_CONSUMER_PROTECTION_AUTHORITIES } from "./canada-consumer-protection-authorities.js";
export { rrfFuse } from "./in-memory.js";

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
