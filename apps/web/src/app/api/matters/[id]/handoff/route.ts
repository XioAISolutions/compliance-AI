/**
 * GET /api/matters/[id]/handoff — comprehensive handoff pack as DOCX.
 *
 * Replaces the old CRUMB text format with a filing-grade Word document
 * that a compliance lawyer can hand to a regulator, a CCO, or an auditor.
 *
 * Sections:
 *   1. Cover page — matter title, scope, status, export hash, timestamp
 *   2. Documents — uploaded files with chunk counts and SHA-256 hashes
 *   3. Review output — the latest generation (full text), verdict badge
 *   4. Citations — tabulated authority references from the review
 *   5. Evidence status — missing / requested / present / approved items
 *   6. Approval state — current approval request status + rationale
 *   7. Audit trail — reverse-chronological hash-chained log entries
 *   8. Provenance — export hash + matter id + timestamp for verification
 *
 * Query params:
 *   ?fmt=json  — returns the raw MatterContextBundle as JSON instead
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
} from "docx";
import {
  buildMatterContextBundle,
  type MatterContextBundle,
} from "../../../../../lib/matter-context";
import { sha256 } from "../../../../../lib/audit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, "[redacted-phone]")
    .trim();
}

function iso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : d;
}

const THIN_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
} as const;

function cell(text: string, opts: { bold?: boolean; width?: number } = {}): TableCell {
  return new TableCell({
    borders: THIN_BORDER,
    ...(opts.width ? { width: { size: opts.width, type: WidthType.PERCENTAGE } } : {}),
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts.bold, size: 20 })],
        spacing: { before: 40, after: 40 },
      }),
    ],
  });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1): Paragraph {
  return new Paragraph({ heading: level, children: [new TextRun({ text })] });
}

function body(text: string, opts: { italic?: boolean; size?: number; spacing?: number } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, italics: opts.italic, size: opts.size ?? 22 })],
    spacing: { after: opts.spacing ?? 120 },
  });
}

function renderHandoffDocx(bundle: MatterContextBundle): Document {
  const m = bundle.matter;
  const exportHash = sha256(m.id + bundle.exportedAt);
  const latestGen = bundle.audit
    .slice()
    .reverse()
    .find((e) => e.action === "generation");
  const latestVerdict = bundle.audit
    .slice()
    .reverse()
    .find((e) => e.judgeVerdict)?.judgeVerdict;
  const citations = [...new Set(bundle.audit.flatMap((e) => e.authoritiesUsed))];
  const missingEvidence = bundle.evidence.filter(
    (e) => e.status === "missing" || e.status === "requested" || e.status === "stale",
  );
  const approval = bundle.approvals[0];

  const children: (Paragraph | Table)[] = [];

  // ---- Cover page ----
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Compliance Review Handoff" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({ text: cleanText(m.title), size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: `${m.jurisdiction.toUpperCase()} / ${m.registrationCategory.toUpperCase()} · ${m.taskType.replace(/-/g, " ")}`,
          italics: true,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: `Status: ${m.status}${latestVerdict ? ` · Judge: ${latestVerdict}` : ""}`,
          bold: true,
          size: 22,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [
        new TextRun({
          text: new Date(bundle.exportedAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          size: 20,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ---- Documents ----
  children.push(heading("1. Documents"));
  if (bundle.documents.length === 0) {
    children.push(body("No documents uploaded to this matter.", { italic: true }));
  } else {
    children.push(
      new Table({
        rows: [
          new TableRow({
            children: [
              cell("Filename", { bold: true, width: 40 }),
              cell("Type", { bold: true, width: 20 }),
              cell("Chunks", { bold: true, width: 10 }),
              cell("SHA-256", { bold: true, width: 30 }),
            ],
          }),
          ...bundle.documents.map(
            (doc) =>
              new TableRow({
                children: [
                  cell(cleanText(doc.filename)),
                  cell(doc.documentType),
                  cell(String(doc.chunkCount)),
                  cell(doc.sha256?.slice(0, 16) ?? "—"),
                ],
              }),
          ),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );
    children.push(body(""));
  }

  // ---- Review output ----
  children.push(heading("2. Latest Review Output"));
  if (latestGen?.outputContent) {
    const outputText = cleanText(latestGen.outputContent);
    for (const para of outputText.split(/\n{2,}/)) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      if (/^#{1,3}\s/.test(trimmed)) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [new TextRun({ text: trimmed.replace(/^#+\s*/, "") })],
          }),
        );
      } else {
        children.push(body(trimmed));
      }
    }
  } else {
    children.push(body("No review output has been generated for this matter.", { italic: true }));
  }

  // ---- Citations ----
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("3. Cited Authorities"));
  if (citations.length === 0) {
    children.push(body("No authority citations were recorded.", { italic: true }));
  } else {
    children.push(
      new Table({
        rows: [
          new TableRow({
            children: [
              cell("#", { bold: true, width: 5 }),
              cell("Authority ID", { bold: true, width: 95 }),
            ],
          }),
          ...citations.slice(0, 30).map(
            (id, i) =>
              new TableRow({
                children: [cell(String(i + 1)), cell(id)],
              }),
          ),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );
    if (citations.length > 30) {
      children.push(body(`… and ${citations.length - 30} more.`, { italic: true }));
    }
    children.push(body(""));
  }

  // ---- Evidence gaps ----
  children.push(heading("4. Evidence Status"));
  if (bundle.evidence.length === 0) {
    children.push(body("No evidence items recorded.", { italic: true }));
  } else {
    children.push(
      new Table({
        rows: [
          new TableRow({
            children: [
              cell("Item", { bold: true, width: 50 }),
              cell("Status", { bold: true, width: 20 }),
              cell("Source", { bold: true, width: 30 }),
            ],
          }),
          ...bundle.evidence.slice(0, 20).map(
            (item) =>
              new TableRow({
                children: [
                  cell(cleanText(item.title)),
                  cell(item.status),
                  cell(cleanText(item.source ?? "—")),
                ],
              }),
          ),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );
    if (missingEvidence.length > 0) {
      children.push(
        body(
          `${missingEvidence.length} item(s) are missing, requested, or stale and must be resolved before submission.`,
          { italic: true },
        ),
      );
    }
    children.push(body(""));
  }

  // ---- Approval ----
  children.push(heading("5. Approval State"));
  if (approval) {
    children.push(body(`Status: ${approval.status}`));
    children.push(body(`Requested by: ${approval.requestedBy}`));
    if (approval.reviewedBy) children.push(body(`Reviewed by: ${approval.reviewedBy}`));
    if (approval.rationale) children.push(body(`Rationale: ${cleanText(approval.rationale)}`));
    children.push(body(`Output hash: ${approval.outputHash}`));
  } else {
    children.push(body("No approval request has been created for this matter.", { italic: true }));
  }

  // ---- Audit trail ----
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("6. Audit Trail"));
  const auditRows = bundle.audit.slice().reverse().slice(0, 25);
  if (auditRows.length === 0) {
    children.push(body("No audit entries.", { italic: true }));
  } else {
    children.push(
      new Table({
        rows: [
          new TableRow({
            children: [
              cell("Time", { bold: true, width: 20 }),
              cell("Actor", { bold: true, width: 15 }),
              cell("Action", { bold: true, width: 15 }),
              cell("Detail", { bold: true, width: 50 }),
            ],
          }),
          ...auditRows.map(
            (entry) =>
              new TableRow({
                children: [
                  cell(iso(entry.timestamp).slice(0, 19).replace("T", " ")),
                  cell(entry.actor),
                  cell(entry.action),
                  cell(
                    cleanText(entry.outputContent ?? entry.inputContent ?? "").slice(0, 120),
                  ),
                ],
              }),
          ),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      }),
    );
    if (bundle.audit.length > 25) {
      children.push(
        body(`Showing 25 of ${bundle.audit.length} entries. Full log available via /api/matters/[id]/transcript.`, {
          italic: true,
          size: 18,
        }),
      );
    }
  }

  // ---- Provenance ----
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("7. Provenance"));
  children.push(body(`Matter ID: ${m.id}`));
  children.push(body(`Export hash: ${exportHash}`));
  children.push(body(`Exported at: ${bundle.exportedAt}`));
  children.push(body(`Documents: ${bundle.documents.length}`));
  children.push(body(`Chunks indexed: ${bundle.chunks.length}`));
  children.push(body(`Audit entries: ${bundle.audit.length}`));
  children.push(body(`Evidence items: ${bundle.evidence.length}`));
  children.push(body(`Transcript events: ${bundle.transcript.length}`));
  children.push(body(`Graph nodes: ${bundle.graph.nodes.length} · Edges: ${bundle.graph.edges.length}`));
  children.push(
    body("Cloud inference via Anthropic / OpenAI with enterprise zero-retention on your documents.", {
      italic: true,
      size: 18,
    }),
  );

  return new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 22 } } } },
    sections: [{ children }],
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const bundle = await buildMatterContextBundle(id);
  if (!bundle) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  const fmt = req.nextUrl.searchParams.get("fmt");
  if (fmt === "json") {
    return NextResponse.json(bundle);
  }

  const doc = renderHandoffDocx(bundle);
  const buffer = await Packer.toBuffer(doc);
  const blob = new Blob(
    [new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) as unknown as BlobPart],
    { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  );
  const safeTitle = cleanText(bundle.matter.title)
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 48);

  return new Response(blob, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeTitle || "matter"}-handoff.docx"`,
      "Content-Length": String(blob.size),
    },
  });
}
