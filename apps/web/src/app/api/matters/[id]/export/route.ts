/**
 * DOCX export — POST /api/matters/[id]/export
 *
 * Renders the review output as a Word document with:
 *   - Title page (matter title, date)
 *   - Body text with footnote markers [c1], [c2], ... that match the citations
 *   - Appended "Exhibits" section: full text of each cited authority
 *
 * Body shape: model-emitted markdown. We do a lightweight markdown parser
 * (headings, paragraphs, bullet lists, tables, bold/italic) — good enough
 * for the reviewer's typical output without pulling in a full AST library.
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
import { getDefaultMatterStore } from "../../../../../lib/matter-store";
import { getDefaultAuditStore, sha256 } from "../../../../../lib/audit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Citation {
  id: string;
  authorityId: string;
  section: string;
  quote: string;
  docId: string;
  chunkId: string;
  page?: number;
  /** Source-locker fields — preserved through DOCX export so the exhibits
   * appendix can render the jurisdiction, source type, authority date, and
   * confidence a Canadian lawyer needs to verify each cited authority. */
  jurisdiction?: string;
  sourceType?: string;
  authorityDate?: string;
  pinpoint?: string;
  confidence?: number;
}

interface ExportBody {
  format?: "docx" | "md";
  output: string;
  citations?: Citation[];
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: matterId } = await params;
  const matterStore = getDefaultMatterStore();
  const matter = await matterStore.get(matterId);

  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  let body: ExportBody;
  try {
    body = (await req.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.output || typeof body.output !== "string") {
    return NextResponse.json({ error: "`output` is required" }, { status: 400 });
  }

  const citations = body.citations ?? [];

  // DOCX rendering has to succeed — the client no longer falls back to
  // markdown on failure. Wrap the primary renderer so a parser bug on a
  // single markdown pattern can't break the entire export; on failure,
  // fall through to a plaintext-only DOCX that still delivers a .docx
  // file the user can open in Word.
  let docBytes: Buffer;
  let renderMode: "full" | "plaintext" = "full";
  try {
    docBytes = await renderDocx({
      matterTitle: matter.title,
      jurisdiction: matter.jurisdiction,
      registrationCategory: matter.registrationCategory,
      taskType: matter.taskType,
      output: body.output,
      citations,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[export] full DOCX render failed for matter ${matterId}:`, msg);
    try {
      docBytes = await renderPlaintextDocx({
        matterTitle: matter.title,
        jurisdiction: matter.jurisdiction,
        registrationCategory: matter.registrationCategory,
        taskType: matter.taskType,
        output: body.output,
      });
      renderMode = "plaintext";
    } catch (plainErr) {
      const plainMsg = plainErr instanceof Error ? plainErr.message : String(plainErr);
      console.error(`[export] plaintext DOCX fallback failed for matter ${matterId}:`, plainMsg);
      return NextResponse.json(
        {
          error: `DOCX render failed: ${msg}`,
          fallbackError: plainMsg,
        },
        { status: 500 },
      );
    }
  }

  // Audit entry for the export
  const auditStore = getDefaultAuditStore();
  await auditStore.append(matterId, {
    matterId,
    organizationId: matter.organizationId,
    actor: "user",
    action: "export",
    inputHash: sha256(body.output),
    authoritiesUsed: citations.map((c) => c.authorityId),
    outputHash: sha256(docBytes.toString("base64")),
    judgeVerdict: null,
    inputContent: `Export ${matter.title} (${citations.length} citations)`,
    outputContent: `DOCX export (${renderMode}), ${docBytes.byteLength} bytes`,
  });

  return new Response(new Uint8Array(docBytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="compliance-review.docx"`,
      "X-Docx-Render-Mode": renderMode,
    },
  });
}

/**
 * Plaintext DOCX fallback — used when the primary markdown-aware renderer
 * throws on a pathological input. We still emit a valid .docx file with
 * the title page and the raw review text split line-by-line, so the user
 * always gets a Word document even when the markdown→docx parser can't
 * cope.
 */
async function renderPlaintextDocx(opts: {
  matterTitle: string;
  jurisdiction: string;
  registrationCategory: string;
  taskType: string;
  output: string;
}): Promise<Buffer> {
  const children: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: opts.matterTitle, bold: true, size: 40 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${labelForTask(opts.taskType)} · ${labelForJurisdiction(opts.jurisdiction)} / ${opts.registrationCategory.toUpperCase()}`,
          italics: true,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  for (const rawLine of opts.output.split("\n")) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: rawLine })],
        spacing: { after: 60 },
      }),
    );
  }

  const doc = new Document({
    creator: "XIO Compliance Brain",
    title: opts.matterTitle,
    description: `Compliance review for ${opts.matterTitle} (plaintext fallback)`,
    sections: [{ children }],
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
  });

  return Packer.toBuffer(doc);
}

interface RenderOptions {
  matterTitle: string;
  jurisdiction: string;
  registrationCategory: string;
  taskType: string;
  output: string;
  citations: Citation[];
}

async function renderDocx(opts: RenderOptions): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  // Title page
  children.push(
    new Paragraph({
      children: [new TextRun({ text: opts.matterTitle, bold: true, size: 40 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${labelForTask(opts.taskType)} · ${labelForJurisdiction(
            opts.jurisdiction,
          )} / ${opts.registrationCategory.toUpperCase()}`,
          italics: true,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: new Date().toLocaleDateString("en-CA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
          italics: true,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // Body content parsed from markdown
  children.push(...parseMarkdownToDocx(opts.output, opts.citations));

  // Exhibits appendix (only if there are citations)
  if (opts.citations.length > 0) {
    children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Exhibits", bold: true })],
        spacing: { after: 200 },
      }),
    );

    opts.citations.forEach((c, idx) => {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({
              text: `Exhibit ${idx + 1}: ${c.authorityId} § ${c.section}${c.page ? `, p.${c.page}` : ""}${c.pinpoint ? `, ${c.pinpoint}` : ""}`,
              bold: true,
            }),
          ],
          spacing: { before: 300, after: 100 },
        }),
      );
      // Source-locker metadata line — renders as muted provenance text under
      // each exhibit heading so a reviewer can verify jurisdiction and
      // currency without leaving the filed document.
      const provenanceBits: string[] = [];
      if (c.jurisdiction) provenanceBits.push(`Jurisdiction: ${c.jurisdiction}`);
      if (c.sourceType) provenanceBits.push(`Type: ${c.sourceType}`);
      if (c.authorityDate) provenanceBits.push(`As-of: ${c.authorityDate}`);
      if (typeof c.confidence === "number") {
        provenanceBits.push(`Confidence: ${Math.round(c.confidence * 100)}%`);
      }
      if (provenanceBits.length > 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: provenanceBits.join(" · "),
                color: "737373",
                size: 18,
              }),
            ],
            spacing: { after: 80 },
          }),
        );
      }
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${c.id}] `,
              bold: true,
              color: "B45309",
            }),
            new TextRun({ text: `"${c.quote}"`, italics: true }),
          ],
          spacing: { after: 200 },
        }),
      );
    });
  }

  const doc = new Document({
    creator: "XIO Compliance Brain",
    title: opts.matterTitle,
    description: `Compliance review for ${opts.matterTitle}`,
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}

function labelForTask(taskType: string): string {
  switch (taskType) {
    case "om-review":
      return "Offering Memorandum Review";
    case "kyc-gap-check":
      return "KYC/AML Gap Check";
    case "marketing-signoff":
      return "Marketing Material Sign-off";
    case "response-memo":
      return "Response Memo";
    default:
      return taskType;
  }
}

function labelForJurisdiction(j: string): string {
  switch (j) {
    case "ontario":
      return "Ontario";
    case "quebec":
      return "Quebec";
    case "british-columbia":
      return "BC";
    case "alberta":
      return "Alberta";
    case "federal":
      return "Federal";
    default:
      return j;
  }
}

/**
 * Minimal markdown → docx paragraph list. Handles:
 *   - # / ## / ### headings
 *   - paragraphs (blank-line separated)
 *   - bullet lists (- or * prefix)
 *   - numbered lists (1. 2. prefix)
 *   - inline bold (**x**) and italic (*x*)
 *   - inline code (`x`) rendered as monospace
 *   - tables (pipe-delimited, GFM)
 *   - citation markers [cN] rendered as superscripts
 */
function parseMarkdownToDocx(markdown: string, citations: Citation[]): (Paragraph | Table)[] {
  const citationIds = new Set(citations.map((c) => c.id));
  const result: (Paragraph | Table)[] = [];
  const lines = markdown.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (trimmed === "") {
      i++;
      continue;
    }

    // Heading
    const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1]!.length;
      const text = heading[2]!;
      const headingLevel =
        level === 1
          ? HeadingLevel.HEADING_1
          : level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;
      result.push(
        new Paragraph({
          heading: headingLevel,
          children: [new TextRun({ text, bold: true })],
          spacing: { before: 240, after: 120 },
        }),
      );
      i++;
      continue;
    }

    // Table (GFM pipe syntax)
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|[\s\-|:]+\|\s*$/.test(lines[i + 1] ?? "")) {
      const tableLines: string[] = [line];
      i++; // consume header
      i++; // consume separator
      while (i < lines.length && (lines[i] ?? "").includes("|")) {
        tableLines.push(lines[i] ?? "");
        i++;
      }
      result.push(buildTable(tableLines, citationIds, citations));
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      const bulletText = trimmed.replace(/^[-*]\s+/, "");
      result.push(
        new Paragraph({
          bullet: { level: 0 },
          children: renderInline(bulletText, citationIds, citations),
          spacing: { after: 60 },
        }),
      );
      i++;
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const numText = trimmed.replace(/^\d+\.\s+/, "");
      result.push(
        new Paragraph({
          numbering: { reference: "ordered", level: 0 },
          children: renderInline(numText, citationIds, citations),
          spacing: { after: 60 },
        }),
      );
      i++;
      continue;
    }

    // Paragraph (collect continuation lines until blank)
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length && (lines[i] ?? "").trim() !== "" && !/^#{1,3}\s+/.test((lines[i] ?? "").trim())) {
      paraLines.push(lines[i] ?? "");
      i++;
    }
    result.push(
      new Paragraph({
        children: renderInline(paraLines.join(" "), citationIds, citations),
        spacing: { after: 120 },
      }),
    );
  }

  return result;
}

/**
 * Split inline text into TextRuns, handling **bold**, *italic*, `code`, and
 * [cN] citation markers.
 */
function renderInline(
  text: string,
  citationIds: Set<string>,
  _citations: Citation[],
): TextRun[] {
  const runs: TextRun[] = [];
  // Tokenize: **bold**, *italic*, `code`, [cN], or plain text.
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[c\d+\])/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index) }));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      runs.push(new TextRun({ text: token.slice(2, -2), bold: true }));
    } else if (token.startsWith("*") && token.endsWith("*")) {
      runs.push(new TextRun({ text: token.slice(1, -1), italics: true }));
    } else if (token.startsWith("`") && token.endsWith("`")) {
      runs.push(new TextRun({ text: token.slice(1, -1), font: "Courier New" }));
    } else if (token.match(/^\[c\d+\]$/)) {
      const citId = token.slice(1, -1);
      if (citationIds.has(citId)) {
        // Render as superscript footnote marker
        runs.push(
          new TextRun({
            text: `[${citId}]`,
            superScript: true,
            bold: true,
            color: "B45309",
          }),
        );
      } else {
        runs.push(new TextRun({ text: token }));
      }
    } else {
      runs.push(new TextRun({ text: token }));
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex) }));
  }

  return runs.length > 0 ? runs : [new TextRun({ text })];
}

function buildTable(
  tableLines: string[],
  citationIds: Set<string>,
  citations: Citation[],
): Table {
  const rows: TableRow[] = [];
  const parseRow = (line: string): string[] => {
    const cells = line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
    return cells.map((c) => c.trim());
  };

  const borders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    left: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
    right: { style: BorderStyle.SINGLE, size: 4, color: "999999" },
  };

  tableLines.forEach((line, idx) => {
    const cells = parseRow(line);
    const isHeader = idx === 0;
    rows.push(
      new TableRow({
        children: cells.map(
          (cellText) =>
            new TableCell({
              borders,
              children: [
                new Paragraph({
                  children: renderInline(cellText, citationIds, citations).map(
                    (run) => {
                      if (isHeader) {
                        return new TextRun({
                          text: (run as unknown as { options?: { text?: string } }).options?.text ?? "",
                          bold: true,
                        });
                      }
                      return run;
                    },
                  ),
                }),
              ],
            }),
        ),
      }),
    );
  });

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}
