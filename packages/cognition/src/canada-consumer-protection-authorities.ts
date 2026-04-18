/**
 * Pan-Canadian consumer protection authority corpus aggregator.
 *
 * Rolls up every hand-authored consumer protection file in this package
 * into a single array that `bootstrap.ts` seeds into the cognition store
 * alongside the securities corpus. Individual jurisdiction exports
 * remain available for surface-specific retrieval and tests.
 *
 * Coverage — 13 provinces/territories + Federal + Multi-provincial:
 *   - Federal (Competition Act, CPLA, CCPSA, PIPEDA, CASL, Bank Act FCPF)
 *   - Ontario (CPA, 2002)
 *   - Quebec (Consumer Protection Act + Civil Code arts. 1435-1437)
 *   - British Columbia (BPCPA)
 *   - Alberta (CPA + payday loans regime)
 *   - Saskatchewan (CPBPA)
 *   - Manitoba (Business Practices Act + CPA)
 *   - Nova Scotia (CPA + Direct Sellers' Regulation Act)
 *   - New Brunswick (CPWLA + Direct Sellers Act)
 *   - Newfoundland and Labrador (CPBPA + Direct Sellers Act)
 *   - Prince Edward Island (BPA + CPA)
 *   - Yukon (CPA)
 *   - Northwest Territories (CPA)
 *   - Nunavut (continued-in-force NWT CPA)
 *   - Multi-provincial harmonisation templates (ISCHT, CCDHT, debit-card
 *     code, CCIR/CISRO FTC guidance, Competition Bureau Deceptive
 *     Marketing Digest)
 */

import type { CognitionItem } from "./types.js";
import { FEDERAL_CONSUMER_PROTECTION_AUTHORITIES } from "./federal-consumer-protection-authorities.js";
import { ONTARIO_CONSUMER_PROTECTION_AUTHORITIES } from "./ontario-consumer-protection-authorities.js";
import { QUEBEC_CONSUMER_PROTECTION_AUTHORITIES } from "./quebec-consumer-protection-authorities.js";
import { BC_BPCPA_AUTHORITIES } from "./british-columbia-consumer-protection-authorities.js";
import { ALBERTA_CPA_AUTHORITIES } from "./alberta-consumer-protection-authorities.js";
import {
  SASKATCHEWAN_CPBPA_AUTHORITIES,
  MANITOBA_CONSUMER_PROTECTION_AUTHORITIES,
} from "./prairies-consumer-protection-authorities.js";
import {
  NOVA_SCOTIA_CPA_AUTHORITIES,
  NEW_BRUNSWICK_CPA_AUTHORITIES,
  NEWFOUNDLAND_CPBPA_AUTHORITIES,
  PEI_CPA_AUTHORITIES,
} from "./atlantic-consumer-protection-authorities.js";
import {
  YUKON_CPA_AUTHORITIES,
  NWT_CPA_AUTHORITIES,
  NUNAVUT_CPA_AUTHORITIES,
} from "./territories-consumer-protection-authorities.js";
import { MULTI_PROVINCIAL_CONSUMER_PROTECTION_AUTHORITIES } from "./multi-provincial-consumer-protection-authorities.js";

export const CANADA_CONSUMER_PROTECTION_AUTHORITIES: CognitionItem[] = [
  ...FEDERAL_CONSUMER_PROTECTION_AUTHORITIES,
  ...ONTARIO_CONSUMER_PROTECTION_AUTHORITIES,
  ...QUEBEC_CONSUMER_PROTECTION_AUTHORITIES,
  ...BC_BPCPA_AUTHORITIES,
  ...ALBERTA_CPA_AUTHORITIES,
  ...SASKATCHEWAN_CPBPA_AUTHORITIES,
  ...MANITOBA_CONSUMER_PROTECTION_AUTHORITIES,
  ...NOVA_SCOTIA_CPA_AUTHORITIES,
  ...NEW_BRUNSWICK_CPA_AUTHORITIES,
  ...NEWFOUNDLAND_CPBPA_AUTHORITIES,
  ...PEI_CPA_AUTHORITIES,
  ...YUKON_CPA_AUTHORITIES,
  ...NWT_CPA_AUTHORITIES,
  ...NUNAVUT_CPA_AUTHORITIES,
  ...MULTI_PROVINCIAL_CONSUMER_PROTECTION_AUTHORITIES,
];
