import type { FrameworkId } from "@compliance-ai/frameworks";

export type DemoMaturity = "low" | "medium" | "high";
export type DemoRiskLevel = "critical" | "high" | "medium" | "low";
export type DemoEvidenceStatus = "missing" | "stale" | "present" | "approved";

export interface DemoCompanyProfile {
  name: string;
  industry: string;
  employeeCount: number;
  frameworks: FrameworkId[];
  handlesPersonalData: boolean;
  usesAi: boolean;
  hasSecurityOwner: boolean;
  hasVendorRegister: boolean;
  hasIncidentPlan: boolean;
  targetAuditDays: number;
}

export interface DemoControlFinding {
  slug: string;
  framework: FrameworkId;
  code: string;
  title: string;
  description: string;
  riskLevel: DemoRiskLevel;
  priorityScore: number;
  evidenceStatus: DemoEvidenceStatus;
  owner: string;
  dueInDays: number;
  rationale: string;
  recommendedAction: string;
  demoValue: string;
}

export interface DemoEvidenceItem {
  id: string;
  title: string;
  status: DemoEvidenceStatus;
  framework: FrameworkId;
  controlSlug: string;
  source: string;
  whyItMatters: string;
  requestedFrom: string;
  sampleRequest: string;
}

export interface DemoAssessmentResult {
  profile: DemoCompanyProfile;
  readinessScore: number;
  executiveSummary: string;
  findings: DemoControlFinding[];
  evidencePack: DemoEvidenceItem[];
  nextSteps: string[];
  safeDemoDisclaimer: string;
}
