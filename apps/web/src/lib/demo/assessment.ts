import { CATALOGS, type CatalogEntry, type FrameworkId } from "@compliance-ai/frameworks";
import { buildEvidencePack } from "./evidence";
import { calculatePriorityScore, prioritizeFindings } from "./optimizer";
import { PREVIEW_PROFILE, SAFE_DEMO_DISCLAIMER } from "./scenario";
import type {
  DemoAssessmentResult,
  DemoCompanyProfile,
  DemoControlFinding,
  DemoEvidenceStatus,
  DemoRiskLevel,
} from "./types";

const OWNER_BY_FRAMEWORK: Record<FrameworkId, string> = {
  soc2: "Security / IT Owner",
  gdpr: "Privacy / Legal Owner",
  "eu-ai-act": "AI Governance Owner",
  "iso-27001": "Information Security Owner",
};

function riskFor(entry: CatalogEntry, profile: DemoCompanyProfile): DemoRiskLevel {
  if (entry.framework === "eu-ai-act" && profile.usesAi) return "critical";
  if (entry.framework === "gdpr" && profile.handlesPersonalData) return "high";
  if (entry.framework === "soc2" && !profile.hasSecurityOwner) return "high";
  if (entry.framework === "iso-27001" && !profile.hasIncidentPlan) return "high";
  return "medium";
}

function evidenceFor(entry: CatalogEntry, profile: DemoCompanyProfile): DemoEvidenceStatus {
  if (entry.framework === "eu-ai-act" && profile.usesAi) return "missing";
  if (entry.framework === "gdpr" && !profile.hasVendorRegister) return "missing";
  if (entry.framework === "soc2" && !profile.hasSecurityOwner) return "stale";
  if (entry.framework === "iso-27001" && profile.hasIncidentPlan) return "present";
  return "stale";
}

function dueDateFor(entry: CatalogEntry, profile: DemoCompanyProfile): number {
  const pressure = Math.max(7, Math.min(profile.targetAuditDays, 90));
  if (entry.framework === "eu-ai-act") return Math.max(7, pressure - 30);
  if (entry.framework === "gdpr") return Math.max(10, pressure - 20);
  if (entry.framework === "soc2") return Math.max(14, pressure - 12);
  return pressure;
}

function actionFor(entry: CatalogEntry, status: DemoEvidenceStatus): string {
  if (status === "missing") {
    return `Collect first-pass evidence for ${entry.code}, assign an owner, and run the judge loop before marking this ready.`;
  }
  if (status === "stale") {
    return `Refresh the evidence and produce an updated control narrative for ${entry.code}.`;
  }
  return `Review the existing artifact and prepare it for approval/export.`;
}

function demoValueFor(entry: CatalogEntry): string {
  if (entry.framework === "eu-ai-act") return "Shows AI governance readiness instead of just generic security compliance.";
  if (entry.framework === "gdpr") return "Shows privacy evidence requests and lawyer-reviewable output.";
  if (entry.framework === "soc2") return "Shows auditor-style evidence collection and control narrative drafting.";
  return "Shows ISO-aligned security management workflow in the same queue.";
}

export function buildFindings(profile: DemoCompanyProfile): DemoControlFinding[] {
  const selected: CatalogEntry[] = [];
  for (const framework of profile.frameworks) {
    selected.push(...CATALOGS[framework].slice(0, 3));
  }

  return prioritizeFindings(
    selected.map((entry) => {
      const riskLevel = riskFor(entry, profile);
      const evidenceStatus = evidenceFor(entry, profile);
      const dueInDays = dueDateFor(entry, profile);
      const priorityScore = calculatePriorityScore({
        riskLevel,
        evidenceStatus,
        dueInDays,
        aiExposure: entry.framework === "eu-ai-act" && profile.usesAi,
        personalDataExposure: entry.framework === "gdpr" && profile.handlesPersonalData,
        regulatorExposure: entry.framework === "soc2" || entry.framework === "gdpr",
      });

      return {
        slug: entry.slug,
        framework: entry.framework,
        code: entry.code,
        title: entry.title,
        description: entry.description,
        riskLevel,
        priorityScore,
        evidenceStatus,
        owner: OWNER_BY_FRAMEWORK[entry.framework],
        dueInDays,
        rationale: `${entry.code} is prioritized because ${profile.name} is targeting review in ${profile.targetAuditDays} days and the current evidence state is ${evidenceStatus}.`,
        recommendedAction: actionFor(entry, evidenceStatus),
        demoValue: demoValueFor(entry),
      };
    }),
  );
}

function readinessScore(findings: DemoControlFinding[]): number {
  if (findings.length === 0) return 0;
  const max = findings.length * 160;
  const openRisk = findings.reduce((sum, finding) => sum + finding.priorityScore, 0);
  return Math.max(5, Math.min(95, Math.round(100 - (openRisk / max) * 100)));
}

export function runDemoAssessment(profile: DemoCompanyProfile = PREVIEW_PROFILE): DemoAssessmentResult {
  const findings = buildFindings(profile);
  const score = readinessScore(findings);

  return {
    profile,
    readinessScore: score,
    executiveSummary:
      `${profile.name} is ${score}% demo-ready across ${profile.frameworks.length} frameworks. ` +
      `The highest leverage move is to resolve the top ${Math.min(3, findings.length)} evidence gaps, then use the compliance agent judge loop to turn them into reviewable control language.`,
    findings,
    evidencePack: buildEvidencePack(findings),
    nextSteps: [
      "Open the risk queue and resolve the top three findings first.",
      "Generate evidence requests for missing or stale artifacts.",
      "Use the control detail chat panel to draft the control narrative.",
      "Toggle Iterate with judge before showing a draft externally.",
      "Keep DB persistence and pgvector behind the existing package seams before production launch.",
    ],
    safeDemoDisclaimer: SAFE_DEMO_DISCLAIMER,
  };
}
