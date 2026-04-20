/**
 * POST /api/matters/[id]/export-redline
 *
 * Renders the contract-redliner persona's inline diff-token output as a
 * visually-marked DOCX (strikethrough red deletions, underlined blue
 * insertions, footnoted rationale). Gated by the same hard-signoff
 * invariant as /export: an approved approval must bind to the output
 * hash unless an X-Approval-Override header is present.
 *
 * Visual track-changes (the strikethrough/underline/footnote style) is
 * what lawyers actually ship — true OOXML <w:del>/<w:ins> markup is
 * harder to author directly with the `docx` lib and most firms
 * "accept all changes" on receipt anyway. The visual redline preserves
 * the change audit trail in a format the reader can scan without
 * flipping track-changes mode on in Word.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  FootnoteReferenceRun,
} from "docx";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";
import { getDefaultAuditStore, sha256 } from "../../../../../lib/audit-store";
import { getDefaultApprovalStore } from "../../../../../lib/approvals-store";
import { parseRedline, redlineStats, type RedlineSegment } from "../../../../../lib/redline-diff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExportRedlineBody {
  /** The redliner persona's output — markdown prose with inline diff tokens. */
  output: string;
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

  let body: ExportRedlineBody;
  try {
    body = (await req.json()) as ExportRedlineBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.output || typeof body.output !== "string") {
    return NextResponse.json({ error: "`output` is required" }, { status: 400 });
  }

  // Hard-signoff gate — same contract as /export. Approval binds to the
  // SHA-256 of the raw redliner output (diff tokens included), because
  // that's what a reviewer approved. If the user edits the redline
  // post-approval, the hash changes and approval is invalidated.
  const outputHash = sha256(body.output);
  const override = req.headers.get("x-approval-override")?.trim() ?? "";
  const approvalStore = getDefaultApprovalStore();
  const matterApprovals = await approvalStore.listByMatter(matterId);
  const bindingApproval = matterApprovals.find(
    (a) => a.status === "approved" && a.outputHash === outputHash,
  );
  if (!bindingApproval && !override) {
    const audit = getDefaultAuditStore();
    await audit.append(matterId, {
      matterId,
      organizationId: matter.organizationId,
      actor: "system",
      action: "export-blocked",
      inputHash: outputHash,
      authoritiesUsed: [],
      outputHash: null,
      judgeVerdict: null,
      inputContent: `Redline export blocked: no approved approval for hash ${outputHash.slice(0, 12)}…`,
      outputContent: null,
    });
    return NextResponse.json(
      {
        error: "approval-required",
        message:
          "Redline export is blocked until a reviewer approves this exact output. The approval binds to the redline text; any edit invalidates a prior approval.",
        outputHash,
      },
      { status: 403 },
    );
  }

  const segments = parseRedline(body.output);
  const stats = redlineStats(segments);

  let docBytes: Buffer;
  try {
    docBytes = await renderRedlineDocx({
      matterTitle: matter.title,
      segments,
      stats,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[export-redline] render failed for matter ${matterId}:`, msg);
    return NextResponse.json({ error: `Redline DOCX render failed: ${msg}` }, { status: 500 });
  }

  const audit = getDefaultAuditStore();
  const signoffNote = bindingApproval
    ? `approval=${bindingApproval.id} reviewer=${bindingApproval.reviewedBy ?? "unknown"}`
    : `OVERRIDE reason=${override.slice(0, 200)}`;
  await audit.append(matterId, {
    matterId,
    organizationId: matter.organizationId,
    actor: "user",
    action: "export",
    inputHash: outputHash,
    authoritiesUsed: [],
    outputHash: sha256(docBytes.toString("base64")),
    judgeVerdict: null,
    inputContent: `Redline export ${matter.title} (${stats.insertions} ins / ${stats.deletions} del / ${stats.notes} notes) — ${signoffNote}`,
    outputContent: `Redline DOCX, ${docBytes.byteLength} bytes`,
  });

  return new Response(new Uint8Array(docBytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="redline.docx"`,
      "X-Redline-Insertions": String(stats.insertions),
      "X-Redline-Deletions": String(stats.deletions),
      "X-Redline-Notes": String(stats.notes),
    },
  });
}

async function renderRedlineDocx(opts: {
  matterTitle: string;
  segments: readonly RedlineSegment[];
  stats: { insertions: number; deletions: number; notes: number; unchangedChars: number };
}): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Title page
  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: opts.matterTitle, bold: true, size: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [
        new TextRun({
          text: `Redline — ${opts.stats.insertions} insertion${opts.stats.insertions === 1 ? "" : "s"}, ${opts.stats.deletions} deletion${opts.stats.deletions === 1 ? "" : "s"}, ${opts.stats.notes} note${opts.stats.notes === 1 ? "" : "s"}`,
          italics: true,
          color: "666666",
        }),
      ],
    }),
  );

  // Build runs from segments. Paragraph breaks are implied by `\n\n` in
  // the unchanged text; we split the text segments on blank lines so
  // the DOCX reader sees proper paragraphs rather than one giant wall
  // of text.
  //
  // Footnotes are numbered sequentially and accumulated into the
  // Document `footnotes` map.
  const footnotes: Record<number, { children: Paragraph[] }> = {};
  let footnoteNo = 0;
  let currentRuns: (TextRun | FootnoteReferenceRun)[] = [];

  function flushParagraph() {
    if (currentRuns.length === 0) return;
    children.push(
      new Paragraph({
        children: currentRuns,
        spacing: { after: 120 },
      }),
    );
    currentRuns = [];
  }

  for (const seg of opts.segments) {
    if (seg.kind === "text") {
      // Split on paragraph boundaries (blank lines). Single newlines
      // inside a paragraph are kept as soft breaks via a space.
      const parts = seg.content.split(/\n\s*\n/);
      for (let i = 0; i < parts.length; i += 1) {
        const part = parts[i]!.replace(/\s*\n\s*/g, " ").trim();
        if (part) currentRuns.push(new TextRun({ text: part }));
        if (i < parts.length - 1) flushParagraph();
      }
    } else if (seg.kind === "delete") {
      currentRuns.push(
        new TextRun({
          text: seg.content,
          strike: true,
          color: "B91C1C",
        }),
      );
    } else if (seg.kind === "insert") {
      currentRuns.push(
        new TextRun({
          text: seg.content,
          underline: { color: "1D4ED8", type: "single" },
          color: "1D4ED8",
        }),
      );
    } else if (seg.kind === "note") {
      footnoteNo += 1;
      footnotes[footnoteNo] = {
        children: [
          new Paragraph({
            children: [new TextRun({ text: seg.content })],
          }),
        ],
      };
      currentRuns.push(new FootnoteReferenceRun(footnoteNo));
    }
  }
  flushParagraph();

  const doc = new Document({
    creator: "XIO Compliance Brain",
    title: opts.matterTitle,
    description: `Redline export for ${opts.matterTitle}`,
    sections: [{ children }],
    footnotes,
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
