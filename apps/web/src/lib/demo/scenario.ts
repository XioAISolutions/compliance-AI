import type { DemoCompanyProfile } from "./types";

export const PREVIEW_PROFILE: DemoCompanyProfile = {
  name: "Northstar Fintech Advisory",
  industry: "Canadian financial services / AI-enabled advisory operations",
  employeeCount: 42,
  frameworks: ["soc2", "gdpr", "eu-ai-act", "iso-27001"],
  handlesPersonalData: true,
  usesAi: true,
  hasSecurityOwner: false,
  hasVendorRegister: false,
  hasIncidentPlan: true,
  targetAuditDays: 60,
};

export const DEMO_TALK_TRACK = [
  "Import a company profile and target frameworks.",
  "Map controls into one cross-framework work queue.",
  "Prioritize what needs review first using risk, deadline, evidence state, and business exposure.",
  "Generate evidence requests and lawyer/compliance review notes.",
  "Use the existing control chat + judge loop for draft/review iteration.",
];

export const SAFE_DEMO_DISCLAIMER =
  "Demo output is for workflow triage and product evaluation only. It is not legal advice and should be reviewed by a qualified compliance professional or lawyer before external use.";
