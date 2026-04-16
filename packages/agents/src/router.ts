/**
 * Persona router.
 *
 * Heuristic-first (cheap, deterministic, observable). We can swap to an LLM
 * router later behind the same signature if the heuristic mis-routes too often.
 *
 * Returns `{ persona, reason }` so the caller can stream the routing decision
 * to the UI as the first SSE event — gives users a visible explanation of why
 * a particular agent answered, which matters for compliance auditability.
 */

import type { PersonaId } from "./types.js";

const KEYWORDS: Record<PersonaId, RegExp[]> = {
  drafter: [
    /\b(draft|write|generate|author|create)\b.*\b(policy|procedure|standard|statement|control|narrative)\b/i,
    /\bproduce\b.*\b(language|wording|text)\b/i,
  ],
  reviewer: [
    /\b(review|critique|assess|check|evaluate)\b.*\b(draft|policy|procedure|wording)\b/i,
    /\b(does|will)\b.*\b(this|the).*\b(satisfy|meet|cover|address)\b/i,
    /\b(gap|gaps|weakness|weaknesses|missing)\b/i,
  ],
  "evidence-collector": [
    /\b(evidence|artifact|artifacts|proof|demonstrate|show)\b/i,
    /\b(what.*(do|would).*(need|require)|how.*(prove|show))\b/i,
    /\b(audit.*(trail|log|sample))\b/i,
  ],
  "risk-assessor": [
    /\b(risk|threat|exposure|likelihood|impact|residual)\b/i,
    /\b(what.*(could|might).*(go wrong|fail))\b/i,
    /\b(compensating|mitigating)\b.*\bcontrol/i,
  ],
  "om-reviewer": [
    /\b(offering\s+memo|offering\s+memorandum|OM)\b/i,
    /\b(review|check|assess)\b.*\b(offering|OM|memorandum|prospectus)\b/i,
    /\b(NI\s*45-106|45-106|OSC\s+Rule\s+45-501)\b/i,
    /\b(disclosure|disclosures)\b.*\b(check|review|gap|missing)\b/i,
    /\b(securities)\b.*\b(compliance|review|check)\b/i,
  ],
  "kyc-reviewer": [
    /\b(KYC|know[-\s]?your[-\s]?client)\b/i,
    /\b(AML|anti[-\s]?money[-\s]?laundering|FINTRAC|PCMLTFA)\b/i,
    /\bNI\s*31-103\b.*\b(Part\s*13|KYC|suitability)\b/i,
    /\b(beneficial\s+owner|PEP|HIO|politically\s+exposed)\b/i,
    /\b(source\s+of\s+(funds|wealth))\b/i,
  ],
  "marketing-reviewer": [
    /\b(marketing|sales\s+communication|advertisement|advertising|brochure|pitch\s+deck)\b/i,
    /\bNI\s*81-102\b.*\b(Part\s*15|marketing|sales|communication)\b/i,
    /\b(sales\s+communication|prohibited\s+representation)\b/i,
    /\bCSA\s+Staff\s+Notice\s+81-330\b/i,
    /\b(past\s+performance|projection|target\s+return|hypothetical|back[-\s]?test)\b/i,
  ],
  "response-drafter": [
    /\b(deficiency\s+letter|exam\s+finding|staff\s+comment|regulatory\s+inquiry)\b/i,
    /\b(response|reply|comfort)\b.*\b(memo|letter|regulator)\b/i,
    /\b(OSC|CIRO|FINTRAC|CSA)\b.*\b(response|reply|answer)\b/i,
    /\b(remediation\s+plan|commitment\s+letter)\b/i,
  ],
  // Judge is never selected by the heuristic router — it's invoked only by
  // the loop coordinator (`runAgentLoop`) which forces the persona explicitly.
  // We keep the empty entry so `Record<PersonaId, RegExp[]>` stays exhaustive.
  judge: [],
};

export interface RoutingDecision {
  persona: PersonaId;
  reason: string;
}

export function routePersona(userMessage: string): RoutingDecision {
  const scores: Record<PersonaId, number> = {
    drafter: 0,
    reviewer: 0,
    "evidence-collector": 0,
    "risk-assessor": 0,
    "om-reviewer": 0,
    "kyc-reviewer": 0,
    "marketing-reviewer": 0,
    "response-drafter": 0,
    judge: 0, // Never picked by router; kept here so the Record is exhaustive.
  };

  for (const [persona, patterns] of Object.entries(KEYWORDS) as [PersonaId, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(userMessage)) scores[persona] += 1;
    }
  }

  const ranked = (Object.entries(scores) as [PersonaId, number][]).sort((a, b) => b[1] - a[1]);
  const top = ranked[0] ?? (["drafter", 0] satisfies [PersonaId, number]);
  const [topPersona, topScore] = top;

  // No signal → default to drafter. It's the most common compliance ask
  // ("write me an X policy") and produces output the user can react to,
  // which is more useful than a clarifying question.
  if (topScore === 0) {
    return {
      persona: "drafter",
      reason: "No clear intent signal — defaulting to drafter (most common ask).",
    };
  }

  return {
    persona: topPersona,
    reason: `Matched ${topScore} ${topPersona} keyword pattern${topScore === 1 ? "" : "s"}.`,
  };
}
