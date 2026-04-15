export * from "./control.js";
export { SOC2_COMMON_CRITERIA } from "./soc2.js";
export { GDPR_CORE } from "./gdpr.js";
export { EU_AI_ACT_CORE } from "./eu-ai-act.js";
export { ISO_27001_CORE } from "./iso-27001.js";

import { SOC2_COMMON_CRITERIA, type SOC2CatalogEntry } from "./soc2.js";
import { GDPR_CORE, type GDPRCatalogEntry } from "./gdpr.js";
import { EU_AI_ACT_CORE, type EUAIActCatalogEntry } from "./eu-ai-act.js";
import { ISO_27001_CORE, type ISO27001CatalogEntry } from "./iso-27001.js";
import type { FrameworkId } from "./control.js";

export type CatalogEntry =
  | SOC2CatalogEntry
  | GDPRCatalogEntry
  | EUAIActCatalogEntry
  | ISO27001CatalogEntry;

/** All seed catalogs keyed by framework id. */
export const CATALOGS: Record<FrameworkId, CatalogEntry[]> = {
  soc2: SOC2_COMMON_CRITERIA,
  gdpr: GDPR_CORE,
  "eu-ai-act": EU_AI_ACT_CORE,
  "iso-27001": ISO_27001_CORE,
};
