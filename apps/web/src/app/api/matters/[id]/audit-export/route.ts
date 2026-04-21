/**
 * GET /api/matters/[id]/audit-export?format=json|docx
 *
 * Produces a downloadable AI-use audit bundle for a matter. Answers
 * the question a lawyer's client (or a regulator, or the law society)
 * will ask: "show me every AI-assisted step on this file, in order,
 * with cryptographic integrity evidence."
 *
 * Format=json (default): machine-readable bundle with the full hash
 *   chain + approvals + chain-integrity verdict. Safe to archive; the
 *   `prevRowHash` fields make tampering detectable.
 *
 * Format=docx: human-readable Word document with the same content
 *   formatted for review — one section per audit action, each row with
 *   timestamp, actor, action, input/output hash prefixes, and the
 *   human-readable message. Suitable for client transparency or a
 *   firm's annual AI-use audit.
 *
 * Both formats are served with Content-Disposition: attachment so the
 * browser saves them rather than rendering.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";
import { getDefaultAuditStore, type AuditEntry } from "../../../../../lib/audit-store";
import { getDefaultApprovalStore } from "../../../../../lib/approvals-store";
import type { ApprovalRequest } from "@compliance-ai/approvals";
import {
  countPrivileged,
  redactAuditEntry,
  resolveRedactionPolicy,
} from "../../../../../lib/privilege";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  const matter = await getDefaultMatterStore().get(matterId);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const auditStore = getDefaultAuditStore();
  const approvalStore = getDefaultApprovalStore();
  const [entries, approvals, hashChainValid] = await Promise.all([
    auditStore.getByMatter(matterId),
    approvalStore.listByMatter(matterId),
    auditStore.verify(matterId),
  ]);
  // entries come back newest-first; flip to chronological for export
  const chronological = [...entries].reverse();

  // Privilege redaction: /audit-export is an EXTERNAL-audience
  // endpoint (the bundle is the artifact most likely to leave the
  // firm), so the default strips privileged content. The operator
  // may opt back into visibility with ?show=privilege; this choice
  // is audited via the response metadata so the decision is
  // provable.
  const url = new URL(req.url);
  const policy = resolveRedactionPolicy(url, "external");
  const privilegedCount = countPrivileged(chronological);
  const redactedEntries = policy.redactPrivileged
    ? chronological.map((e) => redactAuditEntry(e, true))
    : chronological;

  const format = (url.searchParams.get("format") ?? "json").toLowerCase();
  const filenameBase = `audit-${matter.title.replace(/[^a-z0-9-]+/gi, "-").slice(0, 60)}`;

  if (format === "docx") {
    const bytes = await renderDocx({
      matter,
      entries: redactedEntries,
      approvals,
      hashChainValid,
    });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filenameBase}.docx"`,
        "X-Privilege-Redacted": policy.redactPrivileged ? "true" : "false",
        "X-Privilege-Count": String(privilegedCount),
        "X-Privilege-Policy-Source": policy.source,
      },
    });
  }

  // JSON bundle (default). Shape kept stable — external tools will
  // rely on it.
  const bundle = {
    matter: {
      id: matter.id,
      title: matter.title,
      jurisdiction: matter.jurisdiction,
      registrationCategory: matter.registrationCategory,
      taskType: matter.taskType,
      status: matter.status,
      createdAt: matter.createdAt,
    },
    hashChainValid,
    privilege: {
      redactionApplied: policy.redactPrivileged,
      policySource: policy.source,
      privilegedEntryCount: privilegedCount,
    },
    auditTrail: redactedEntries.map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      actor: e.actor,
      action: e.action,
      inputHash: e.inputHash,
      outputHash: e.outputHash,
      prevRowHash: e.prevRowHash,
      authoritiesUsed: e.authoritiesUsed,
      judgeVerdict: e.judgeVerdict,
      inputContent: e.inputContent,
      outputContent: e.outputContent,
    })),
    approvals: approvals.map((a) => ({
      id: a.id,
      status: a.status,
      outputHash: a.outputHash,
      summary: a.summary,
      requestedBy: a.requestedBy,
      requestedAt: a.requestedAt,
      reviewedBy: a.reviewedBy,
      reviewedAt: a.reviewedAt,
      rationale: a.rationale,
    })),
    generatedAt: new Date().toISOString(),
  };

  const body = JSON.stringify(bundle, null, 2);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameBase}.json"`,
      "X-Privilege-Redacted": policy.redactPrivileged ? "true" : "false",
      "X-Privilege-Count": String(privilegedCount),
      "X-Privilege-Policy-Source": policy.source,
    },
  });
}

interface DocxOpts {
  matter: {
    title: string;
    jurisdiction: string;
    registrationCategory: string;
    taskType: string;
    status: string;
    createdAt?: Date;
  };
  entries: AuditEntry[];
  approvals: ApprovalRequest[];
  hashChainValid: boolean;
}

async function renderDocx(opts: DocxOpts): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [];

  // Title page
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: opts.matter.title, bold: true, size: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `AI-Use Audit Trail · ${opts.matter.taskType} · ${opts.matter.jurisdiction}/${opts.matter.registrationCategory}`,
          italics: true,
          color: "666666",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: opts.hashChainValid
            ? `Hash chain verified (${opts.entries.length} entries)`
            : `Hash chain BROKEN — do NOT rely on this audit as tamper-evident`,
          bold: !opts.hashChainValid,
          color: opts.hashChainValid ? "047857" : "B91C1C",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Generated ${new Date().toISOString()}`,
          color: "737373",
          size: 18,
        }),
      ],
    }),
  );

  // Timeline
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Timeline", bold: true })],
    }),
  );
  if (opts.entries.length === 0) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "No audit entries recorded.", italics: true })],
      }),
    );
  } else {
    children.push(auditTable(opts.entries));
  }

  // Approvals
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 120 },
      children: [new TextRun({ text: "Approvals", bold: true })],
    }),
  );
  if (opts.approvals.length === 0) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "No approval requests recorded for this matter.",
            italics: true,
          }),
        ],
      }),
    );
  } else {
    for (const a of opts.approvals) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 160, after: 60 },
          children: [
            new TextRun({
              text: `${a.status.toUpperCase()} — ${a.summary}`,
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Bound to output hash ${a.outputHash.slice(0, 16)}…   Requested by ${a.requestedBy} at ${a.requestedAt.toISOString()}.` +
                (a.reviewedBy
                  ? `   Reviewed by ${a.reviewedBy}${a.reviewedAt ? ` at ${a.reviewedAt.toISOString()}` : ""}.`
                  : "   Not yet reviewed."),
              size: 20,
            }),
          ],
        }),
        ...(a.rationale
          ? [
              new Paragraph({
                spacing: { after: 120 },
                children: [
                  new TextRun({ text: `Rationale: ${a.rationale}`, italics: true, size: 20 }),
                ],
              }),
            ]
          : []),
      );
    }
  }

  const doc = new Document({
    creator: "XIO Compliance Brain",
    title: `${opts.matter.title} — Audit Trail`,
    description: "AI-use audit trail export",
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
  });
  return Packer.toBuffer(doc) as unknown as Buffer;
}

function auditTable(entries: AuditEntry[]): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      tableCell("Time", { bold: true }),
      tableCell("Actor", { bold: true }),
      tableCell("Action", { bold: true }),
      tableCell("Notes", { bold: true }),
      tableCell("Hashes", { bold: true }),
    ],
  });
  const rows = entries.map(
    (e) =>
      new TableRow({
        children: [
          tableCell(e.timestamp.toISOString().slice(0, 19).replace("T", " ")),
          tableCell(e.actor),
          tableCell(e.action),
          tableCell(
            [
              e.inputContent ? e.inputContent.slice(0, 300) : "",
              e.outputContent ? `→ ${e.outputContent.slice(0, 300)}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          ),
          tableCell(
            [
              `in:  ${e.inputHash.slice(0, 12)}…`,
              e.outputHash ? `out: ${e.outputHash.slice(0, 12)}…` : null,
              e.prevRowHash ? `prev: ${e.prevRowHash.slice(0, 12)}…` : "prev: —",
            ]
              .filter(Boolean)
              .join("\n"),
            { mono: true },
          ),
        ],
      }),
  );
  return new Table({
    rows: [header, ...rows],
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" },
    },
  });
}

function tableCell(text: string, opts: { bold?: boolean; mono?: boolean } = {}): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: opts.bold === true,
            font: opts.mono ? "Consolas" : undefined,
            size: 18,
          }),
        ],
      }),
    ],
  });
}
