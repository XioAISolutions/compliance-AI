import { DRAFTER_SYSTEM } from "./drafter.js";
import { REVIEWER_SYSTEM } from "./reviewer.js";
import { EVIDENCE_COLLECTOR_SYSTEM } from "./evidence-collector.js";
import { RISK_ASSESSOR_SYSTEM } from "./risk-assessor.js";
import { JUDGE_SYSTEM } from "./judge.js";
import { OM_REVIEWER_SYSTEM } from "./om-reviewer.js";
import { KYC_REVIEWER_SYSTEM } from "./kyc-reviewer.js";
import { MARKETING_REVIEWER_SYSTEM } from "./marketing-reviewer.js";
import { RESPONSE_MEMO_DRAFTER_SYSTEM } from "./response-memo-drafter.js";
import { COURT_AI_DISCLOSURE_DRAFTER_SYSTEM } from "./court-ai-disclosure-drafter.js";
import { MISSING_AUTHORITY_SCANNER_SYSTEM } from "./missing-authority-scanner.js";
import { PIPEDA_REVIEWER_SYSTEM } from "./pipeda-reviewer.js";
import { QA_RESPONDER_SYSTEM } from "./qa-responder.js";
import type { PersonaId } from "../types.js";

export const PERSONA_SYSTEM_PROMPTS: Record<PersonaId, string> = {
  drafter: DRAFTER_SYSTEM,
  reviewer: REVIEWER_SYSTEM,
  "evidence-collector": EVIDENCE_COLLECTOR_SYSTEM,
  "risk-assessor": RISK_ASSESSOR_SYSTEM,
  judge: JUDGE_SYSTEM,
  "om-reviewer": OM_REVIEWER_SYSTEM,
  "kyc-reviewer": KYC_REVIEWER_SYSTEM,
  "marketing-reviewer": MARKETING_REVIEWER_SYSTEM,
  "response-memo-drafter": RESPONSE_MEMO_DRAFTER_SYSTEM,
  "court-ai-disclosure-drafter": COURT_AI_DISCLOSURE_DRAFTER_SYSTEM,
  "missing-authority-scanner": MISSING_AUTHORITY_SCANNER_SYSTEM,
  "pipeda-reviewer": PIPEDA_REVIEWER_SYSTEM,
  "qa-responder": QA_RESPONDER_SYSTEM,
};

export const PERSONA_LABELS: Record<PersonaId, string> = {
  drafter: "Drafter",
  reviewer: "Reviewer",
  "evidence-collector": "Evidence collector",
  "risk-assessor": "Risk assessor",
  judge: "Judge",
  "om-reviewer": "OM Reviewer",
  "kyc-reviewer": "KYC Reviewer",
  "marketing-reviewer": "Marketing Reviewer",
  "response-memo-drafter": "Response Drafter",
  "court-ai-disclosure-drafter": "Court AI-Disclosure Drafter",
  "missing-authority-scanner": "Missing-Authority Scanner",
  "pipeda-reviewer": "PIPEDA Reviewer",
  "qa-responder": "Q&A Responder",
};

export { parseVerdict } from "./judge.js";
export type { JudgeVerdict } from "../types.js";
