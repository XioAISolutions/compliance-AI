import { DRAFTER_SYSTEM } from "./drafter.js";
import { REVIEWER_SYSTEM } from "./reviewer.js";
import { EVIDENCE_COLLECTOR_SYSTEM } from "./evidence-collector.js";
import { RISK_ASSESSOR_SYSTEM } from "./risk-assessor.js";
import type { PersonaId } from "../types.js";

export const PERSONA_SYSTEM_PROMPTS: Record<PersonaId, string> = {
  drafter: DRAFTER_SYSTEM,
  reviewer: REVIEWER_SYSTEM,
  "evidence-collector": EVIDENCE_COLLECTOR_SYSTEM,
  "risk-assessor": RISK_ASSESSOR_SYSTEM,
};

export const PERSONA_LABELS: Record<PersonaId, string> = {
  drafter: "Drafter",
  reviewer: "Reviewer",
  "evidence-collector": "Evidence collector",
  "risk-assessor": "Risk assessor",
};
