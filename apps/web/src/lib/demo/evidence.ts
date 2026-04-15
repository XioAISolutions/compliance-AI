import type { DemoControlFinding, DemoEvidenceItem } from "./types";

function requestTemplate(finding: DemoControlFinding): string {
  return `Please upload or link the latest evidence for ${finding.code} — ${finding.title}. We need the artifact, owner, effective date, and any reviewer approval notes. Current status: ${finding.evidenceStatus}.`;
}

export function buildEvidencePack(findings: DemoControlFinding[]): DemoEvidenceItem[] {
  return findings.slice(0, 8).map((finding, index) => ({
    id: `ev-${index + 1}`,
    title: `${finding.code} evidence request`,
    status: finding.evidenceStatus,
    framework: finding.framework,
    controlSlug: finding.slug,
    source:
      finding.evidenceStatus === "missing"
        ? "Not yet supplied"
        : finding.evidenceStatus === "stale"
          ? "Prior-period artifact needs refresh"
          : "Preview demo artifact",
    whyItMatters: finding.rationale,
    requestedFrom: finding.owner,
    sampleRequest: requestTemplate(finding),
  }));
}

export function evidenceStatusLabel(status: DemoEvidenceItem["status"]): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "present":
      return "Present";
    case "stale":
      return "Needs refresh";
    case "missing":
      return "Missing";
  }
}
