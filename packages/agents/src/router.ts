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
  ],
  "kyc-reviewer": [
    /\b(KYC|know[- ]your[- ]client|AML|anti[- ]money[- ]laundering)\b/i,
    /\b(client\s+file|account\s+opening|relationship\s+disclosure)\b/i,
    /\b(FINTRAC|PCMLTFA|PEP|politically\s+exposed)\b/i,
    /\b(suitability)\b.*\b(review|check|assess|file)\b/i,
    /\b(NI\s*31-103\s+Part\s+13)\b/i,
  ],
  "marketing-reviewer": [
    /\b(marketing|sales\s+communication|pitch\s+deck|brochure|one-?pager)\b/i,
    /\b(NI\s*81-102|81-102)\b/i,
    /\b(marketing|advertisement|sales)\b.*\b(review|check|sign[- ]off|approve)\b/i,
    /\b(misleading|prohibited\s+representation|performance\s+claim)\b/i,
  ],
  "response-memo-drafter": [
    /\b(deficiency|inquiry|regulator|regulatory)\b.*\b(letter|response|memo)\b/i,
    /\b(respond|draft\s+response|reply)\b.*\b(OSC|CIRO|IIROC|FINTRAC|AMF|regulator)\b/i,
    /\b(OSC|CIRO|IIROC|FINTRAC|AMF)\b.*\b(letter|inquiry|review|audit)\b/i,
  ],
  "court-ai-disclosure-drafter": [
    /\b(AI[- ]use|AI[- ]disclosure|generative\s+AI)\b.*\b(disclosure|memo|filing)\b/i,
    /\b(court\s+filing|factum|pleading)\b.*\b(AI|generative)\b/i,
    /\b(practice\s+direction|consolidated\s+notice)\b.*\b(AI|artificial\s+intelligence)\b/i,
  ],
  "missing-authority-scanner": [
    /\b(missing|uncited|hallucinat|fabricat)\b.*\b(authorit|citation|cite)\b/i,
    /\b(citation\s+risk|cite[- ]check|audit\s+the\s+citations)\b/i,
    /\b(verify|verification)\b.*\b(citation|authority|source)\b/i,
  ],
  "pipeda-reviewer": [
    /\b(PIPEDA|privacy\s+policy|privacy\s+impact|PIA)\b/i,
    /\b(personal\s+information|data\s+breach|breach\s+notification)\b/i,
    /\b(Law\s*25|Quebec\s+privacy|Alberta\s+PIPA|BC\s+PIPA)\b/i,
    /\b(OPC|Privacy\s+Commissioner|cross[- ]border\s+transfer)\b/i,
  ],
  // Judge is never selected by the heuristic router — it's invoked only by
  // the loop coordinator (`runAgentLoop`) which forces the persona explicitly.
  // We keep the empty entry so `Record<PersonaId, RegExp[]>` stays exhaustive.
  judge: [],
  // QA responder is only selected via `forcePersona` from /api/ask. Empty
  // keyword list so the router never reaches for it from a free-text matter
  // chat (where the user expects drafter/reviewer behaviour).
  "qa-responder": [],
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
    "response-memo-drafter": 0,
    "court-ai-disclosure-drafter": 0,
    "missing-authority-scanner": 0,
    "pipeda-reviewer": 0,
    judge: 0, // Never picked by router; kept here so the Record is exhaustive.
    "qa-responder": 0, // Force-only; exhaustive-Record placeholder.
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
