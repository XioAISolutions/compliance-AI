/**
 * Cognitive risk scoring — the BrainSNN proof layer the Milan submission
 * pitches as the differentiator. Compliance review answers "is this
 * allowed?"; this helper answers "what is this message doing to the
 * reader's judgment?"
 *
 * Implementation is intentionally lexical: it counts occurrences of
 * pressure / urgency / certainty / trust-erosion patterns in the input
 * text and normalizes each dimension into a 0-100 score. A judge who
 * opens devtools should be able to read the patterns, change the input,
 * and watch the numbers move — which is the credibility test the
 * hard-coded version failed.
 *
 * The composite score is a weighted blend that intentionally biases
 * toward urgency + certainty, because those are the two dimensions that
 * regulators and consumer-protection regimes actually penalize.
 */
export interface CognitiveRiskDimensions {
  emotionalActivation: number;
  certaintyPressure: number;
  trustErosion: number;
  urgencyCompression: number;
}

export interface CognitiveRisk {
  score: number;
  dimensions: CognitiveRiskDimensions;
}

interface DimensionSpec {
  patterns: RegExp[];
  /** Hit count that maps to a 100 score for this dimension. */
  saturationHits: number;
}

const DIMENSIONS: Record<keyof CognitiveRiskDimensions, DimensionSpec> = {
  emotionalActivation: {
    patterns: [
      /\bexclusive\b/g,
      /\b(miss|missing) out\b/g,
      /\bdon'?t miss\b/g,
      /\bregret\b/g,
      /\b(only|exclusive) (for )?you\b/g,
      /\blife[- ]changing\b/g,
      /\bonce[- ]in[- ]a[- ]lifetime\b/g,
      /\b(amazing|incredible|unbelievable|perfect)\b/g,
      /\byou (must|need to|have to|deserve)\b/g,
    ],
    saturationHits: 8,
  },
  certaintyPressure: {
    patterns: [
      /\bguarantee(d|s)?\b/g,
      /\bprotected returns?\b/g,
      /\b(predictable|stable) returns?\b/g,
      /\b(always|never) (loses?|fails?|wrong)\b/g,
      /\b100\s?%\b/g,
      /\brisk[- ]free\b/g,
      /\bzero[- ]risk\b/g,
      /\bcertain(ty)?\b/g,
      /\bwill (return|deliver|make)\b/g,
    ],
    saturationHits: 6,
  },
  trustErosion: {
    patterns: [
      /\binstant approvals?\b/g,
      /\bauto[- ]approved?\b/g,
      /\bno (paperwork|review|questions)\b/g,
      /\bai[- ]reviewed\b/g,
      /\bai reviews? everything\b/g,
      /\bskip(ping)? (the )?(review|approval|paperwork)\b/g,
      /\btrust (us|me)\b/g,
      /\bproprietary (model|algorithm)\b/g,
    ],
    saturationHits: 6,
  },
  urgencyCompression: {
    patterns: [
      /\b(act|sign|decide|reply) (now|today|fast)\b/g,
      /\blimited (spots?|seats?|time|availability)\b/g,
      /\bonly a few (left|spots?|seats?)\b/g,
      /\bclos(es|ing) (today|tonight|soon|in \d+)\b/g,
      /\bexpires?\b/g,
      /\blast chance\b/g,
      /\bhurry\b/g,
      /\bdeadline\b/g,
      /\binstant(ly)?\b/g,
      /\b(today|tonight|right now)\b/g,
    ],
    saturationHits: 10,
  },
};

const COMPOSITE_WEIGHTS: Record<keyof CognitiveRiskDimensions, number> = {
  urgencyCompression: 0.3,
  certaintyPressure: 0.3,
  emotionalActivation: 0.2,
  trustErosion: 0.2,
};

function dimensionScore(text: string, spec: DimensionSpec): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const pattern of spec.patterns) {
    hits += lower.match(pattern)?.length ?? 0;
  }
  const ratio = hits / spec.saturationHits;
  return Math.min(100, Math.round(ratio * 100));
}

export function computeCognitiveRisk(text: string): CognitiveRisk {
  const dimensions: CognitiveRiskDimensions = {
    emotionalActivation: dimensionScore(text, DIMENSIONS.emotionalActivation),
    certaintyPressure: dimensionScore(text, DIMENSIONS.certaintyPressure),
    trustErosion: dimensionScore(text, DIMENSIONS.trustErosion),
    urgencyCompression: dimensionScore(text, DIMENSIONS.urgencyCompression),
  };
  const composite =
    dimensions.urgencyCompression * COMPOSITE_WEIGHTS.urgencyCompression +
    dimensions.certaintyPressure * COMPOSITE_WEIGHTS.certaintyPressure +
    dimensions.emotionalActivation * COMPOSITE_WEIGHTS.emotionalActivation +
    dimensions.trustErosion * COMPOSITE_WEIGHTS.trustErosion;
  return {
    score: Math.round(composite),
    dimensions,
  };
}

/**
 * The canonical Milan demo scenario — deck excerpt + sales-call
 * transcript + marketing claim, concatenated. Kept in this module so
 * the API route, page, and smoke test all evaluate the same input.
 */
export const MILAN_SCENARIO_TEXT = [
  "[deck] Protected returns. Guaranteed performance — our model is risk-free.",
  "We've delivered predictable returns for every cohort. 100% of investors stayed in.",
  "Limited spots remain in this round. Closing today.",
  "[call] You need to act now before the round closes. Only a few seats left.",
  "Our AI reviews everything in seconds — instant approval, no paperwork.",
  "Don't miss out — this is a once-in-a-lifetime, exclusive allocation for you.",
  "[claim] Protected returns, limited spots, AI-reviewed onboarding, and instant approval.",
].join("\n");
