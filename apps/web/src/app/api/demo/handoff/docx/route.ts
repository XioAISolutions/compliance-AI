/**
 * /api/demo/handoff/docx — DOCX export of the seeded Triad Review handoff.
 *
 * The judge demo at `/demo/judge` shows three export buttons: DOCX, redline
 * PDF, and CRUMB handoff pack. The CRUMB pack ships as plain text. This
 * route generates the same review content as a real Word document so a
 * judge can see what a production export actually looks like — the gate
 * story is preserved by the visible Approval state ("pending") on the
 * matter, but the artifact itself is now downloadable.
 *
 * Uses the `docx` package (already installed in apps/web) for pure-JS
 * Word-doc generation. No native bindings, Railway/Vercel runtime-safe.
 */

import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { resolveModelProvider } from "@compliance-ai/agents";
import {
  TRIAD_DEMO_MATTER,
  TRIAD_REVIEWERS,
  type TriadFinding,
} from "../../../../../lib/triad-seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEVERITY_LABEL: Record<TriadFinding["severity"], string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW",
};

function p(text: string, opts: { bold?: boolean; italic?: boolean; size?: number } = {}) {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italic,
        size: opts.size,
      }),
    ],
    spacing: { after: 120 },
  });
}

function h(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 240, after: 120 },
  });
}

function bullet(text: string, indent = 0) {
  return new Paragraph({
    text,
    bullet: { level: indent },
    spacing: { after: 80 },
  });
}

export async function GET() {
  const m = TRIAD_DEMO_MATTER;
  let providerLine = `${m.recordedProvider}/${m.recordedModel}`;
  let providerBaseUrl: string | undefined;
  try {
    const resolved = resolveModelProvider();
    providerLine = `${resolved.provider}/${resolved.model}`;
    providerBaseUrl = resolved.baseUrl;
  } catch {
    /* fall through to seed values */
  }

  const exportedAt = new Date().toISOString();
  const verifiedCount = m.findings
    .flatMap((f) => f.citations)
    .filter((c) => c.badge === "verified").length;
  const needsCheckCount = m.findings
    .flatMap((f) => f.citations)
    .filter((c) => c.badge === "needs-check").length;
  const jurisdictionMismatchCount = m.findings
    .flatMap((f) => f.citations)
    .filter((c) => c.badge === "jurisdiction-mismatch").length;

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "XIO Compliance Brain", bold: true, size: 36 })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Triad Review — Handoff Document", bold: true, size: 28 })],
      spacing: { after: 240 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "Demo seed · illustrative · not a real customer engagement",
          italics: true,
          size: 18,
        }),
      ],
      spacing: { after: 320 },
    }),

    h("Matter", HeadingLevel.HEADING_1),
    bullet(`Title: ${m.title}`),
    bullet(`Document type: ${m.documentType}`),
    bullet(`Jurisdiction: ${m.jurisdiction}`),
    bullet(`Registration: ${m.registrationCategory}`),
    bullet(`Task: ${m.taskType}`),
    bullet(`Compliance score: ${m.complianceScore}%`),
    bullet(`Critical gaps: ${m.criticalGapCount}`),
    bullet(`Verified citations: ${m.verifiedCitationCount}`),
    bullet(`Reviewer disagreement: ${m.reviewerDisagreementCount} material`),

    h("Excerpt under review", HeadingLevel.HEADING_2),
    new Paragraph({
      children: [new TextRun({ text: `"${m.documentExcerpt}"`, italics: true })],
      spacing: { after: 120 },
    }),

    h("Reviewer instruction", HeadingLevel.HEADING_2),
    p(m.reviewerInstruction),

    h("Findings by reviewer", HeadingLevel.HEADING_1),
  ];

  for (const rev of TRIAD_REVIEWERS) {
    const items = m.findings.filter((f) => f.raisedBy === rev.id);
    if (items.length === 0) continue;
    children.push(
      h(
        `${rev.name} — ${items.length} finding${items.length === 1 ? "" : "s"}`,
        HeadingLevel.HEADING_2,
      ),
    );
    children.push(p(rev.description, { italic: true }));
    for (const f of items) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `[${SEVERITY_LABEL[f.severity]}] `, bold: true }),
            new TextRun({ text: f.title, bold: true }),
          ],
          spacing: { before: 120, after: 80 },
        }),
      );
      children.push(p(f.detail));
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Recommended fix: ", bold: true }),
            new TextRun({ text: f.recommendedFix }),
          ],
          spacing: { after: 80 },
        }),
      );
      if (f.citations.length === 0) {
        children.push(
          p("No citations attached — Evidence Auditor refuses to sign off.", { italic: true }),
        );
      } else {
        children.push(p("Citations:", { bold: true }));
        for (const c of f.citations) {
          children.push(
            bullet(
              `${c.authorityTitle} §${c.section} [${c.badge}] — "${c.quote}" (${c.badgeReason})`,
              1,
            ),
          );
        }
      }
    }
  }

  children.push(h("Citation integrity", HeadingLevel.HEADING_1));
  children.push(
    bullet(
      `${verifiedCount} verified · ${needsCheckCount} needs manual check · ${jurisdictionMismatchCount} jurisdiction mismatch`,
    ),
  );
  children.push(
    bullet(
      `${m.findings.flatMap((f) => f.citations).length} citations across ${m.findings.length} findings`,
    ),
  );

  if (m.disagreements.length > 0) {
    children.push(h("Where reviewers disagreed", HeadingLevel.HEADING_1));
    for (const d of m.disagreements) {
      children.push(h(d.issue, HeadingLevel.HEADING_2));
      for (const rev of TRIAD_REVIEWERS) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${rev.name}: `, bold: true }),
              new TextRun({ text: d.views[rev.id] }),
            ],
            spacing: { after: 80 },
          }),
        );
      }
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Final action: ", bold: true }),
            new TextRun({ text: d.finalAction }),
          ],
          spacing: { before: 80, after: 120 },
        }),
      );
    }
  }

  children.push(h("Approval & export gate", HeadingLevel.HEADING_1));
  children.push(bullet(`Reviewer status: ${m.approval.reviewerStatus}`));
  children.push(bullet(`Approval state: ${m.approval.approvalState}`));
  children.push(bullet(`Export state: ${m.approval.exportState}`));
  children.push(bullet(`Output hash: ${m.approval.outputHash}`));
  children.push(
    bullet(
      "DOCX / redline export is BLOCKED in production until a human approver signs the output hash above.",
    ),
  );
  children.push(p("This file: demo render of the export shape.", { italic: true }));

  children.push(h("Engine receipt", HeadingLevel.HEADING_1));
  children.push(bullet(`Provider: ${providerLine}`));
  if (providerBaseUrl) children.push(bullet(`Base URL: ${providerBaseUrl}`));
  children.push(bullet(`Workflow: ${m.amd.workflow}`));
  children.push(bullet(`Hardware target: ${m.amd.hardwareTarget}`));
  children.push(
    bullet(`Recorded run: ${(m.recordedWallClockMs / 1000).toFixed(1)}s wall (${m.recordedAt})`),
  );
  children.push(bullet(`Exported at: ${exportedAt}`));

  const doc = new Document({
    creator: "XIO Compliance Brain",
    title: `Triad Review — ${m.title}`,
    description: "Demo seed handoff. Illustrative; not a real customer engagement.",
    sections: [{ children }],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `xio-triad-handoff-${m.id}.docx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
