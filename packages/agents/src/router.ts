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
