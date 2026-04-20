/**
 * Canadian Source Packs — preset authority bundles keyed to matter lane.
 *
 * A source pack is a named bundle of authorities with shared provenance
 * (e.g., "federal securities", "Ontario-specific securities",
 * "pan-Canadian consumer protection"). The purpose of packs is governance:
 *
 *  1. A reviewer can see exactly which authorities were in scope for a
 *     matter, not just a flat list of items.
 *  2. A matter wizard can offer "lanes" that pre-select the relevant packs
 *     instead of making the user pick jurisdiction + registration
 *     category + task type independently.
 *  3. An operator can load a minimal pack set for a narrow deployment
 *     (e.g., BC-only privacy counsel doesn't need Ontario securities).
 *  4. The audit log can record which packs were in scope when a review
 *     ran, making a future corpus change traceable to the matters it
 *     would have affected.
 *
 * Packs are additive: the pan-Canadian consumer protection pack includes
 * every province's consumer-protection corpus so that a multi-provincial
 * matter can retrieve across jurisdictions without loading each provincial
 * pack separately.
 */

import type { CognitionItem } from "./types.js";
import { ONTARIO_EMD_AUTHORITIES, FINTRAC_KYC_AUTHORITIES } from "./authorities.js";
import { CANADA_CONSUMER_PROTECTION_AUTHORITIES } from "./canada-consumer-protection-authorities.js";
import { COURT_AI_USE_AUTHORITIES } from "./court-ai-use-authorities.js";
import { PIPEDA_AUTHORITIES } from "./pipeda-authorities.js";

/**
 * A named bundle of authorities. `items` holds the actual CognitionItems;
 * the selector layer unions + dedupes by id when a matter's selection
 * overlaps several packs.
 */
export interface SourcePack {
  /** Stable id — used by selector, audit, and API responses. */
  id: string;
  /** Human-readable label for wizard / UI. */
  label: string;
  /** One-sentence description of what's in the pack. */
  description: string;
  /**
   * Matter jurisdictions this pack applies to. "federal" + "multi-provincial"
   * packs are considered universally applicable.
   */
  jurisdictions: readonly string[];
  /** Practice areas this pack speaks to. */
  practiceAreas: readonly string[];
  /** The underlying seed authorities. */
  items: readonly CognitionItem[];
}

/**
 * Matter lane — the narrow slice of law a matter sits in. Drives pack
 * selection. Deliberately not the same as taskType — multiple task types
 * (om-review, marketing-signoff, kyc-gap-check) share the same lane
 * (securities-emd), and a single taskType (missing-authority-scan) spans
 * every lane.
 */
export type MatterLane =
  | "securities-emd"
  | "securities-pm"
  | "securities-iiroc"
  | "securities-issuer"
  | "consumer-protection"
  | "privacy"
  | "court-ai-disclosure"
  | "regulator-response"
  | "cross-cutting"; // scan / verify modes that run across everything

/**
 * Canadian federal + Ontario securities corpus — NI 45-106 + companion
 * instruments, NI 31-103 Part 13, NI 81-102 Part 15, OSC Rule 45-501,
 * Securities Act (Ontario) s. 130.1, CSA staff notices, OSC/CIRO/FINTRAC
 * deficiency patterns. Shipped as one pack because every Ontario
 * securities matter (EMD, PM, IIROC, issuer) cites across this bundle.
 */
export const CA_SECURITIES_ONTARIO_PACK: SourcePack = {
  id: "ca-securities-ontario",
  label: "Canadian securities — Ontario (EMD / PM / IIROC / issuer)",
  description:
    "NI 45-106 + companion, NI 31-103 Part 13, NI 81-102 Part 15, OSC Rule 45-501, Securities Act (Ontario) s. 130.1, CSA staff notices, and OSC/CIRO/FINTRAC deficiency patterns.",
  jurisdictions: ["ontario", "federal", "multi-provincial"],
  practiceAreas: ["securities", "securities-emd", "securities-pm", "securities-iiroc", "securities-issuer"],
  items: ONTARIO_EMD_AUTHORITIES,
};

/**
 * Federal AML / PCMLTFA / FINTRAC pack. Subset of the Ontario securities
 * pack (FINTRAC items are included there too), but surfaced separately so
 * a pure AML matter can load just the AML items without the broader
 * securities corpus.
 */
export const CA_FEDERAL_AML_PACK: SourcePack = {
  id: "ca-federal-aml",
  label: "Canadian federal AML — PCMLTFA / FINTRAC",
  description:
    "PCMLTFA s. 6.2 ascertaining identity, FINTRAC Guideline 6G record keeping, FINTRAC examination deficiency patterns.",
  jurisdictions: ["federal", "multi-provincial", "ontario", "quebec", "british-columbia", "alberta"],
  practiceAreas: ["aml", "kyc", "securities"],
  items: FINTRAC_KYC_AUTHORITIES,
};

/**
 * Pan-Canadian consumer-protection corpus. Already bundled in
 * CANADA_CONSUMER_PROTECTION_AUTHORITIES — this pack wraps the existing
 * aggregator so it participates in the source-pack registry.
 */
export const CA_CONSUMER_PROTECTION_PACK: SourcePack = {
  id: "ca-consumer-protection",
  label: "Canadian consumer protection — pan-Canadian",
  description:
    "Federal (Competition Act, CASL, Criminal Code fraud), Ontario CPA 2002, Quebec CPA, BC BPCPA, AB/SK/MB/NS/NB/NL/PEI/YT/NT/NU consumer-protection acts, plus multi-provincial harmonization templates.",
  jurisdictions: [
    "federal",
    "multi-provincial",
    "ontario",
    "quebec",
    "british-columbia",
    "alberta",
    "saskatchewan",
    "manitoba",
    "nova-scotia",
    "new-brunswick",
    "newfoundland",
    "pei",
    "yukon",
    "northwest-territories",
    "nunavut",
  ],
  practiceAreas: ["consumer-protection", "competition", "privacy-marketing"],
  items: CANADA_CONSUMER_PROTECTION_AUTHORITIES,
};

/**
 * Canadian privacy law — PIPEDA + OPC guidance + Quebec Law 25 + AB PIPA
 * + BC PIPA.
 */
export const CA_PRIVACY_PACK: SourcePack = {
  id: "ca-privacy",
  label: "Canadian privacy — PIPEDA / Law 25 / AB PIPA / BC PIPA",
  description:
    "PIPEDA Schedule 1 + s. 10.1 breach regime, OPC guidance on consent + cross-border + privacy management, Quebec Law 25, Alberta PIPA, BC PIPA.",
  jurisdictions: ["federal", "multi-provincial", "ontario", "quebec", "alberta", "british-columbia"],
  practiceAreas: ["privacy", "data-protection"],
  items: PIPEDA_AUTHORITIES,
};

/**
 * Court AI-use practice directions + law society / CBA guidance. Applied
 * whenever a matter is preparing court-filed material.
 */
export const CA_COURT_AI_PACK: SourcePack = {
  id: "ca-court-ai",
  label: "Canadian court AI-use practice directions",
  description:
    "Federal Court + Ontario SC + Alberta KB + BC SC AI practice directions, LSO practice management guidance, CBA guidance, duty-of-candour summary.",
  jurisdictions: [
    "federal",
    "multi-provincial",
    "ontario",
    "alberta",
    "british-columbia",
    "quebec",
    "saskatchewan",
    "manitoba",
    "nova-scotia",
    "new-brunswick",
  ],
  practiceAreas: ["litigation", "court-filing", "ai-disclosure"],
  items: COURT_AI_USE_AUTHORITIES,
};

/**
 * Full registry — authoritative source of truth. Add a new pack here and
 * every downstream (selector, API, bootstrap, UI) picks it up.
 */
export const SOURCE_PACKS: readonly SourcePack[] = [
  CA_SECURITIES_ONTARIO_PACK,
  CA_FEDERAL_AML_PACK,
  CA_CONSUMER_PROTECTION_PACK,
  CA_PRIVACY_PACK,
  CA_COURT_AI_PACK,
];

/**
 * Pack selector — given a matter's lane (or task type as a fallback signal),
 * return the packs that should be in scope.
 *
 * Heuristics:
 *  - Securities lanes get the securities pack + AML pack.
 *  - Consumer-protection gets the consumer-protection pack.
 *  - Privacy gets the privacy pack.
 *  - Court AI-disclosure gets the court-AI pack.
 *  - Regulator-response pulls securities + AML (most OSC/CIRO/FINTRAC
 *    letters sit in one of those lanes).
 *  - Cross-cutting (missing-authority scan) returns ALL packs — the
 *    scanner audits whatever the matter's prior output cited, and that
 *    could be from any lane.
 */
export function selectPacksForLane(lane: MatterLane): SourcePack[] {
  switch (lane) {
    case "securities-emd":
    case "securities-pm":
    case "securities-iiroc":
    case "securities-issuer":
      return [CA_SECURITIES_ONTARIO_PACK, CA_FEDERAL_AML_PACK];
    case "consumer-protection":
      return [CA_CONSUMER_PROTECTION_PACK];
    case "privacy":
      return [CA_PRIVACY_PACK];
    case "court-ai-disclosure":
      return [CA_COURT_AI_PACK];
    case "regulator-response":
      return [CA_SECURITIES_ONTARIO_PACK, CA_FEDERAL_AML_PACK];
    case "cross-cutting":
      return [...SOURCE_PACKS];
    default:
      return [CA_SECURITIES_ONTARIO_PACK];
  }
}

/**
 * Map a task type (the signal the matter wizard captures today) to a
 * canonical lane, then select packs. Preserves compatibility with the
 * existing API while routing everything through the source-pack layer.
 */
export function selectPacksForTaskType(
  taskType: string,
  registrationCategory?: string,
): SourcePack[] {
  switch (taskType) {
    case "om-review":
    case "marketing-signoff":
      return selectPacksForLane(laneForRegistration(registrationCategory, "securities-emd"));
    case "kyc-gap-check":
      return selectPacksForLane(laneForRegistration(registrationCategory, "securities-emd"));
    case "response-memo":
      return selectPacksForLane("regulator-response");
    case "court-ai-disclosure":
      return selectPacksForLane("court-ai-disclosure");
    case "pipeda-check":
      return selectPacksForLane("privacy");
    case "missing-authority-scan":
      return selectPacksForLane("cross-cutting");
    default:
      return selectPacksForLane("securities-emd");
  }
}

function laneForRegistration(
  registrationCategory: string | undefined,
  fallback: MatterLane,
): MatterLane {
  switch (registrationCategory) {
    case "emd":
      return "securities-emd";
    case "pm":
      return "securities-pm";
    case "iiroc":
      return "securities-iiroc";
    case "issuer":
      return "securities-issuer";
    default:
      return fallback;
  }
}

/**
 * Union + dedupe by id across multiple packs. Used by the bootstrap and by
 * any caller that wants the "full authority deck" for a given selection.
 * Ordering is stable: first pack wins on id collisions.
 */
export function flattenPacks(packs: readonly SourcePack[]): CognitionItem[] {
  const seen = new Set<string>();
  const out: CognitionItem[] = [];
  for (const pack of packs) {
    for (const item of pack.items) {
      const id = item.id ?? "";
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(item);
    }
  }
  return out;
}

/**
 * Compact summary for API responses + UI — item count per pack, no content
 * bodies. Useful for `/api/source-packs` so the client doesn't have to pull
 * the full corpus to render pack selection chips.
 */
export interface SourcePackSummary {
  id: string;
  label: string;
  description: string;
  jurisdictions: readonly string[];
  practiceAreas: readonly string[];
  itemCount: number;
}

export function summarizePack(pack: SourcePack): SourcePackSummary {
  return {
    id: pack.id,
    label: pack.label,
    description: pack.description,
    jurisdictions: pack.jurisdictions,
    practiceAreas: pack.practiceAreas,
    itemCount: pack.items.length,
  };
}
