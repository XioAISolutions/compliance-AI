/**
 * Auto-classifier for uploaded documents.
 *
 * Signals (in descending strength):
 *   1. First-page text — most reliable for securities OMs, which always
 *      have a cover page with "OFFERING MEMORANDUM" prominently displayed.
 *   2. Filename — regex match over the lowercased name.
 *
 * If neither signals, default to `other`. The document-type chip in the
 * UI is editable, so a miss costs one click — a wrong confident guess
 * costs trust, so we default conservatively.
 */

import type { ClassifiedDocType } from "./types.js";

interface ClassifyInput {
  filename: string;
  firstPagePreview?: string;
}

const CONTENT_RULES: Array<{
  pattern: RegExp;
  type: ClassifiedDocType;
  /** Higher = stronger signal; ties broken by declaration order. */
  strength: number;
}> = [
  { pattern: /offering\s+memorandum/i, type: "offering-memo", strength: 5 },
  { pattern: /private\s+placement\s+memorandum/i, type: "offering-memo", strength: 4 },
  { pattern: /\bNI\s*45-106\b/i, type: "authority-rule", strength: 4 },
  { pattern: /\bNI\s*31-103\b/i, type: "authority-rule", strength: 4 },
  { pattern: /\bOSC\s+Rule\b/i, type: "authority-rule", strength: 4 },
  { pattern: /staff\s+notice/i, type: "regulatory-guidance", strength: 3 },
  { pattern: /know\s+your\s+client|KYC\s+questionnaire/i, type: "kyc-aml-file", strength: 3 },
  { pattern: /anti[-\s]money\s+laundering|FINTRAC/i, type: "kyc-aml-file", strength: 3 },
  { pattern: /sales\s+communication|marketing\s+material|fund\s+fact\s+sheet/i, type: "marketing-material", strength: 3 },
];

const FILENAME_RULES: Array<{ pattern: RegExp; type: ClassifiedDocType; strength: number }> = [
  { pattern: /offering[-_\s]?memo(?:randum)?|\bom\b/i, type: "offering-memo", strength: 3 },
  { pattern: /\bni[-_\s]?\d{2,3}-\d{3}\b|authority|rule|regulation/i, type: "authority-rule", strength: 2 },
  { pattern: /kyc|aml|know[-_\s]?your/i, type: "kyc-aml-file", strength: 2 },
  { pattern: /marketing|brochure|pitch|deck|factsheet/i, type: "marketing-material", strength: 2 },
  { pattern: /guidance|staff[-_\s]?notice|bulletin/i, type: "regulatory-guidance", strength: 2 },
];

export interface ClassificationResult {
  type: ClassifiedDocType;
  /** 0..1 confidence. 1 = content rule fired; 0 = default fallback. */
  confidence: number;
  /** The rule that fired (filename / content / default). Useful for UI tooltips. */
  signal: "content" | "filename" | "default";
}

export function classifyDocument(input: ClassifyInput): ClassificationResult {
  const previewSample = input.firstPagePreview?.slice(0, 2000) ?? "";

  // Content rules first — they're strictly stronger signals.
  let best: { rule: (typeof CONTENT_RULES)[number]; signal: "content" | "filename" } | null = null;
  for (const rule of CONTENT_RULES) {
    if (rule.pattern.test(previewSample)) {
      if (!best || rule.strength > best.rule.strength) {
        best = { rule, signal: "content" };
      }
    }
  }
  if (!best) {
    for (const rule of FILENAME_RULES) {
      if (rule.pattern.test(input.filename)) {
        if (!best || rule.strength > best.rule.strength) {
          best = { rule, signal: "filename" };
        }
      }
    }
  }

  if (best) {
    return {
      type: best.rule.type,
      confidence: Math.min(1, best.rule.strength / 5),
      signal: best.signal,
    };
  }
  return { type: "other", confidence: 0, signal: "default" };
}
