/**
 * Content-based document classification.
 *
 * The filename heuristic in `apps/web/src/app/api/matters/[id]/documents/route.ts`
 * is fast but brittle — "file.pdf" tells us nothing. This module inspects the
 * first ~2000 characters of parsed content and infers:
 *   - documentType (offering-memo / kyc-aml-file / marketing-material / etc.)
 *   - inferred task type (om-review / kyc-gap-check / marketing-signoff / response-memo)
 *   - inferred jurisdiction (ontario / quebec / etc.) when detectable
 *   - inferred registration category when detectable
 *
 * Classification is deterministic and regex-based so it runs synchronously
 * and doesn't need an LLM call. Precision matters more than recall — when
 * we're unsure we return null and let the caller fall back to "other".
 */

import type { DocumentChunk, ParsedDocument } from "./types.js";

export type InferredDocumentType =
  | "authority-rule"
  | "regulatory-guidance"
  | "offering-memo"
  | "kyc-aml-file"
  | "marketing-material"
  | "regulator-inquiry"
  | "reference-material"
  | "other";

export type InferredTaskType =
  | "om-review"
  | "kyc-gap-check"
  | "marketing-signoff"
  | "response-memo";

export type InferredJurisdiction =
  | "ontario"
  | "quebec"
  | "british-columbia"
  | "alberta"
  | "federal";

export type InferredRegistrationCategory = "emd" | "pm" | "iiroc" | "issuer" | "none";

export interface Classification {
  documentType: InferredDocumentType;
  /** Task type inferred from document type. Null for references/authorities. */
  taskType: InferredTaskType | null;
  /** Jurisdiction if confidently detected. */
  jurisdiction: InferredJurisdiction | null;
  /** Registration category if confidently detected. */
  registrationCategory: InferredRegistrationCategory | null;
  /** 0..1 confidence that the document-type call is right. */
  confidence: number;
  /** Short human-readable title inferred from the content (first heading-like line). */
  suggestedTitle: string | null;
}

/**
 * Classify a parsed document by inspecting its content. Uses the first
 * ~2000 characters — enough to catch cover pages, headers, and opening
 * paragraphs without scanning a 100-page OM end to end.
 */
export function classifyDocument(
  input: ParsedDocument | { text: string } | { chunks: DocumentChunk[] },
): Classification {
  const sample = extractSample(input);
  const normalized = sample.toLowerCase();

  const omScore = scoreOfferingMemo(normalized);
  const kycScore = scoreKyc(normalized);
  const marketingScore = scoreMarketing(normalized);
  const inquiryScore = scoreRegulatorInquiry(normalized);
  const authorityScore = scoreAuthority(normalized);
  const guidanceScore = scoreRegulatoryGuidance(normalized);

  const scores: Array<[InferredDocumentType, number]> = [
    ["offering-memo", omScore],
    ["kyc-aml-file", kycScore],
    ["marketing-material", marketingScore],
    ["regulator-inquiry", inquiryScore],
    ["authority-rule", authorityScore],
    ["regulatory-guidance", guidanceScore],
  ];

  scores.sort((a, b) => b[1] - a[1]);
  const [topType, topScore] = scores[0]!;
  const [, secondScore] = scores[1]!;

  // Require the winner to beat runner-up by at least 1 point AND have >= 2
  // positive signals; otherwise fall back to "other".
  const documentType: InferredDocumentType =
    topScore >= 2 && topScore - secondScore >= 1 ? topType : "other";

  const confidence = documentType === "other" ? 0 : Math.min(1, topScore / 6);

  const taskType = taskTypeFromDocType(documentType);
  const jurisdiction = inferJurisdiction(normalized);
  const registrationCategory = inferRegistrationCategory(normalized);
  const suggestedTitle = extractTitle(sample);

  return {
    documentType,
    taskType,
    jurisdiction,
    registrationCategory,
    confidence,
    suggestedTitle,
  };
}

function extractSample(
  input: ParsedDocument | { text: string } | { chunks: DocumentChunk[] },
): string {
  if ("chunks" in input) {
    return input.chunks
      .slice(0, 3)
      .map((c) => c.content)
      .join("\n")
      .slice(0, 2000);
  }
  return (input.text ?? "").slice(0, 2000);
}

function taskTypeFromDocType(d: InferredDocumentType): InferredTaskType | null {
  switch (d) {
    case "offering-memo":
      return "om-review";
    case "kyc-aml-file":
      return "kyc-gap-check";
    case "marketing-material":
      return "marketing-signoff";
    case "regulator-inquiry":
      return "response-memo";
    default:
      return null;
  }
}

// --- Scorers --------------------------------------------------------------
// Each scorer returns an integer: +1 per hit on a distinctive phrase.

function scoreOfferingMemo(text: string): number {
  let score = 0;
  if (/\boffering memorandum\b/.test(text)) score += 2;
  if (/\bform 45-106f[23]\b/.test(text)) score += 2;
  if (/\buse of proceeds\b/.test(text)) score += 1;
  if (/\brisk factors\b/.test(text)) score += 1;
  if (/\brights of action\b/.test(text)) score += 1;
  if (/\baccredited investor\b/.test(text)) score += 1;
  if (/\bsubscription (price|agreement)\b/.test(text)) score += 1;
  if (/\bprivate placement\b/.test(text)) score += 1;
  return score;
}

function scoreKyc(text: string): number {
  let score = 0;
  if (/\b(know[-\s]your[-\s]client|kyc)\b/.test(text)) score += 2;
  if (/\b(anti[-\s]money[-\s]laundering|aml)\b/.test(text)) score += 1;
  if (/\b(client identification|ascertaining identity)\b/.test(text)) score += 2;
  if (/\b(beneficial owner(ship)?)\b/.test(text)) score += 1;
  if (/\b(politically exposed person|\bpep\b)\b/.test(text)) score += 2;
  if (/\b(source of funds|source of wealth)\b/.test(text)) score += 1;
  if (/\bsuitability (assessment|determination)\b/.test(text)) score += 1;
  if (/\brelationship disclosure\b/.test(text)) score += 1;
  return score;
}

function scoreMarketing(text: string): number {
  let score = 0;
  if (/\b(sales communication|marketing material)\b/.test(text)) score += 2;
  if (/\b(pitch deck|investor presentation|one-pager)\b/.test(text)) score += 2;
  if (/\b(past performance|track record)\b/.test(text)) score += 1;
  if (/\b(annualized returns?|total return)\b/.test(text)) score += 1;
  if (/\b(target return|projected return)\b/.test(text)) score += 1;
  if (/\b(why invest|why now|opportunity)\b/.test(text)) score += 1;
  return score;
}

function scoreRegulatorInquiry(text: string): number {
  let score = 0;
  if (/\b(deficiency letter|notice of deficiency)\b/.test(text)) score += 3;
  if (/\b(staff (review|examination|inquiry))\b/.test(text)) score += 2;
  if (/\b(ontario securities commission|osc)\b/.test(text)) score += 1;
  if (/\b(iiroc|ciro|canadian investment regulatory)\b/.test(text)) score += 1;
  if (/\bfintrac\b/.test(text)) score += 1;
  if (/\b(please (explain|provide|describe|confirm))\b/.test(text)) score += 1;
  if (/\b(compliance (review|field review|examination))\b/.test(text)) score += 2;
  if (/\b(response (is )?required|respond by)\b/.test(text)) score += 2;
  return score;
}

function scoreAuthority(text: string): number {
  let score = 0;
  if (/\b(national instrument|ni \d{2}-\d{3})\b/.test(text)) score += 2;
  if (/\b(securities act|companion policy)\b/.test(text)) score += 1;
  if (/\b(subsection|paragraph \([a-z]\))\b/.test(text)) score += 1;
  if (/\b(prescribed|shall not|is required to)\b/.test(text)) score += 1;
  if (/\b(regulation \d+)\b/.test(text)) score += 1;
  return score;
}

function scoreRegulatoryGuidance(text: string): number {
  let score = 0;
  if (/\b(staff notice \d{2}-\d{3})\b/.test(text)) score += 3;
  if (/\b(guidance|best practices?)\b/.test(text)) score += 1;
  if (/\b(csa|canadian securities administrators)\b/.test(text)) score += 1;
  return score;
}

// --- Jurisdiction + registration inference --------------------------------

function inferJurisdiction(text: string): InferredJurisdiction | null {
  // Quebec first because AMF + Québec are unambiguous.
  if (/\b(autorité des marchés financiers|\bamf\b|quebec|québec)\b/.test(text)) return "quebec";
  if (/\b(bcsc|british columbia securities|vancouver)\b/.test(text)) return "british-columbia";
  if (/\b(alberta securities commission|\basc\b|calgary|edmonton)\b/.test(text)) return "alberta";
  if (/\b(ontario securities commission|\bosc\b|\bontario\b|toronto)\b/.test(text)) return "ontario";
  return null;
}

function inferRegistrationCategory(text: string): InferredRegistrationCategory | null {
  if (/\b(exempt market dealer|\bemd\b)\b/.test(text)) return "emd";
  if (/\b(portfolio manager|\bpm\b(?!\d))\b/.test(text)) return "pm";
  if (/\b(iiroc|ciro|dealer member)\b/.test(text)) return "iiroc";
  if (/\b(reporting issuer)\b/.test(text)) return "issuer";
  return null;
}

// --- Title extraction -----------------------------------------------------

function extractTitle(sample: string): string | null {
  const lines = sample.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 10)) {
    // Heuristic: first non-trivial line that looks like a title
    // (length 8..120, not all uppercase noise, not starting with boilerplate)
    if (line.length < 8 || line.length > 120) continue;
    if (/^(page |figure |table |\d+$)/i.test(line)) continue;
    return line;
  }
  return null;
}
