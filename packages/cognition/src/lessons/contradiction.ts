/**
 * Lightweight contradiction heuristic for the sidecar layer.
 *
 * Two lessons CONTRADICT when they cover the same subject (high cosine
 * similarity already established by the caller) but disagree on
 * directionality. The signal we look for, in order:
 *
 *   1. One side carries a negation marker the other lacks ("must not",
 *      "no longer", "do not", "never") — this is the cleanest case.
 *   2. Numeric thresholds disagree ("over 25%" vs "over 50%",
 *      "within 30 days" vs "within 14 days") — common in regulatory
 *      lessons where a rule's threshold gets revised.
 *
 * The heuristic is deliberately conservative: false positives waste
 * the garden's time but don't lose data (supersession is reversible
 * via the relation graph). False negatives let stale lessons coexist
 * with fresh ones until the garden's deeper pass catches them.
 *
 * The garden uses a more expensive model-backed contradiction check.
 * This is the fast Layer 1 version.
 */

const NEGATION_PATTERNS: RegExp[] = [
  /\bmust not\b/i,
  /\bdo not\b/i,
  /\bdon'?t\b/i,
  /\bnever\b/i,
  /\bno longer\b/i,
  /\bnot allowed\b/i,
  /\bnot required\b/i,
  /\bcannot\b/i,
  /\bshall not\b/i,
];

const NUMBER_AND_UNIT = /([\d.]+)\s*(%|percent|days?|hours?|years?|months?|weeks?|business days?)/gi;

export interface ContradictionResult {
  contradicts: boolean;
  /** Short reason for the audit log; "" when contradicts is false. */
  reason: string;
}

export function detectContradiction(a: string, b: string): ContradictionResult {
  const aNeg = NEGATION_PATTERNS.some((p) => p.test(a));
  const bNeg = NEGATION_PATTERNS.some((p) => p.test(b));
  if (aNeg !== bNeg) {
    return {
      contradicts: true,
      reason: aNeg
        ? "candidate negates assertion in existing lesson"
        : "existing lesson negates assertion in candidate",
    };
  }
  const aNums = extractNumbers(a);
  const bNums = extractNumbers(b);
  for (const unit of new Set([...aNums.keys(), ...bNums.keys()])) {
    const aVals = aNums.get(unit) ?? [];
    const bVals = bNums.get(unit) ?? [];
    if (aVals.length === 0 || bVals.length === 0) continue;
    // If neither side shares ANY value, treat as a threshold revision.
    const overlap = aVals.some((v) => bVals.includes(v));
    if (!overlap) {
      return {
        contradicts: true,
        reason: `numeric threshold disagrees on ${unit}: existing=${aVals.join(",")} candidate=${bVals.join(",")}`,
      };
    }
  }
  return { contradicts: false, reason: "" };
}

function extractNumbers(text: string): Map<string, number[]> {
  const out = new Map<string, number[]>();
  const re = new RegExp(NUMBER_AND_UNIT.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const value = parseFloat(m[1]!);
    if (Number.isNaN(value)) continue;
    const unit = m[2]!.toLowerCase().replace(/s$/, "");
    const list = out.get(unit) ?? [];
    list.push(value);
    out.set(unit, list);
  }
  return out;
}
