/**
 * POST /api/matters/[id]/export — render the current output as a Word
 * document, with cited rule extracts appended as numbered exhibits.
 *
 * Deliverable format (per `docs/redesign.md` — "Word memo with cited
 * rule extracts appended as exhibits"):
 *
 *   1. Cover page:        matter title, jurisdiction/registration/task,
 *                         date, verdict badge, a short provenance block.
 *   2. Body:              the output prose with [cN] markers rendered as
 *                         footnote markers pointing at Exhibit N.
 *   3. Exhibits:          one heading + full quote + authority §
 *                         section per cited chunk.
 *   4. Audit block:       input hash + authorities-used + output hash +
 *                         verdict — the same signed tuple the audit log
 *                         holds, so the export is self-contained.
 *
 * The request body carries the rendered output + parsed citations from
 * the client (what the user is seeing), so the export reflects the
 * state of the review as it stands — no server-side re-generation.
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
  PageBreak,
} from "docx";
import { getDefaultMatterStore } from "../../../../../lib/matter-store";
import { sha256 } from "../../../../../lib/audit-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ExportCitation {
  id: string;
  authorityId: string;
  section: string;
  quote: string;
  docId?: string;
  chunkId?: string;
  page?: number;
}

interface ExportBody {
  output: string;
  citations: ExportCitation[];
  verdict?: "READY_TO_SUBMIT" | "ITERATE" | "REWRITE" | null;
  totalRounds?: number | null;
  leadPersona?: string;
}

const CITE_MARKER = /\[(c\d+)\]/g;

const VERDICT_LABEL: Record<string, string> = {
  READY_TO_SUBMIT: "Ready to submit",
  ITERATE: "Iterating (not final)",
  REWRITE: "Rewriting (not final)",
};

const PERSONA_LABEL: Record<string, string> = {
  drafter: "Drafter",
  "om-reviewer": "OM Reviewer",
  "kyc-reviewer": "KYC Reviewer",
  "marketing-reviewer": "Marketing Reviewer",
  "response-drafter": "Response Drafter",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const matter = getDefaultMatterStore().get(id);
  if (!matter) {
    return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  }

  let body: ExportBody;
  try {
    body = (await req.json()) as ExportBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const output = (body.output ?? "").trim();
  if (!output) {
    return NextResponse.json({ error: "`output` is empty" }, { status: 400 });
  }

  const citations = Array.isArray(body.citations) ? body.citations : [];
  // Build a map: citation id → 1-indexed footnote number so we can reference
  // them in the body text AND render them as exhibits in the order they
  // first appeared in the prose.
  const footnoteIdByCiteId = new Map<string, number>();
  let nextFootnote = 1;
  for (const match of output.matchAll(CITE_MARKER)) {
    const cId = match[1]!;
    if (!footnoteIdByCiteId.has(cId)) {
      footnoteIdByCiteId.set(cId, nextFootnote++);
    }
  }
  // Any citations that appear in the array but never in the prose still
  // get an exhibit number at the end — nothing cited silently drops.
  for (const c of citations) {
    if (!footnoteIdByCiteId.has(c.id)) {
      footnoteIdByCiteId.set(c.id, nextFootnote++);
    }
  }

  // Convert `output` prose into docx Paragraphs. Split on double newlines
  // for paragraphs; within a paragraph, replace [cN] markers with
  // FootnoteReferenceRun pointing at the matching footnote id.
  const bodyParagraphs: Paragraph[] = [];
  for (const block of output.split(/\n{2,}/)) {
    const text = block.trim();
    if (!text) continue;
    const runs: (TextRun | FootnoteReferenceRun)[] = [];
    let cursor = 0;
    for (const match of text.matchAll(CITE_MARKER)) {
      const start = match.index ?? 0;
      if (start > cursor) runs.push(new TextRun({ text: text.slice(cursor, start) }));
      const footnoteId = footnoteIdByCiteId.get(match[1]!);
      if (footnoteId !== undefined) {
        runs.push(new FootnoteReferenceRun(footnoteId));
      }
      cursor = start + match[0].length;
    }
    if (cursor < text.length) runs.push(new TextRun({ text: text.slice(cursor) }));
    if (runs.length === 0) runs.push(new TextRun({ text }));

    // Headings heuristics — if the first line starts with `#` markdown or
    // "###", promote to a docx Heading. Otherwise regular body text.
    if (/^#{1,3}\s+/.test(text)) {
      const level = (text.match(/^#+/)?.[0].length ?? 1) as 1 | 2 | 3;
      const heading =
        level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      bodyParagraphs.push(
        new Paragraph({
          heading,
          children: [new TextRun({ text: text.replace(/^#+\s+/, "") })],
        }),
      );
    } else {
      bodyParagraphs.push(
        new Paragraph({
          children: runs,
          spacing: { after: 200 },
        }),
      );
    }
  }

  // Cover page
  const coverParagraphs: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: matter.title })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [
        new TextRun({
          text: `${matter.jurisdiction.toUpperCase()} · ${matter.registrationCategory.toUpperCase()} · ${matter.taskType.replace(/-/g, " ")}`,
          italics: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) }),
      ],
    }),
    body.verdict
      ? new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [new TextRun({ text: `Verdict: ${VERDICT_LABEL[body.verdict] ?? body.verdict}`, bold: true })],
        })
      : new Paragraph({ children: [new TextRun("")] }),
    body.leadPersona
      ? new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: `Lead persona: ${PERSONA_LABEL[body.leadPersona] ?? body.leadPersona}`, italics: true })],
        })
      : new Paragraph({ children: [new TextRun("")] }),
    new Paragraph({
      children: [new PageBreak()],
    }),
  ];

  // Exhibits — one page-break-separated heading per citation.
  const exhibitParagraphs: Paragraph[] = [];
  if (footnoteIdByCiteId.size > 0) {
    exhibitParagraphs.push(
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: "Exhibits" })],
      }),
    );
    // Render exhibits in footnote-number order.
    const ordered = [...footnoteIdByCiteId.entries()].sort((a, b) => a[1] - b[1]);
    for (const [cId, fnNum] of ordered) {
      const cit = citations.find((c) => c.id === cId);
      exhibitParagraphs.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 300 },
          children: [new TextRun({ text: `Exhibit ${fnNum} — ${cit?.authorityId ?? "?"} § ${cit?.section ?? "?"}` })],
        }),
      );
      if (cit?.quote) {
        exhibitParagraphs.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [new TextRun({ text: cit.quote, italics: true })],
          }),
        );
      }
      if (cit?.page || cit?.chunkId) {
        exhibitParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: [
                  cit?.page !== undefined ? `page ${cit.page}` : null,
                  cit?.chunkId ? `chunk ${cit.chunkId}` : null,
                ]
                  .filter(Boolean)
                  .join(" · "),
                italics: true,
                size: 18,
              }),
            ],
          }),
        );
      }
    }
  }

  // Audit block — signed provenance tuple so the export is self-contained.
  const outputHash = sha256(output);
  const citationsHash = sha256(JSON.stringify(citations.map((c) => c.id).sort()));
  const auditParagraphs: Paragraph[] = [
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "Provenance" })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Matter ID: ${matter.id}`, size: 20 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Output hash: ${outputHash}`, size: 20 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Citations hash: ${citationsHash}`, size: 20 })],
    }),
    new Paragraph({
      children: [new TextRun({ text: `Exported at: ${new Date().toISOString()}`, size: 20 })],
    }),
    new Paragraph({
      spacing: { before: 200 },
      children: [
        new TextRun({
          text: "Inference: Cloud inference via Anthropic with enterprise zero-retention on your documents.",
          size: 20,
          italics: true,
        }),
      ],
    }),
  ];

  // Footnotes: each footnote body renders the full citation tuple. docx
  // expects a numeric keyed map and uses `children` for the footnote body.
  const footnotes: Record<
    number,
    { children: Paragraph[] }
  > = {};
  for (const [cId, fnNum] of footnoteIdByCiteId.entries()) {
    const cit = citations.find((c) => c.id === cId);
    const quote = cit?.quote ? ` — "${truncate(cit.quote, 200)}"` : "";
    const pg = cit?.page !== undefined ? ` (p. ${cit.page})` : "";
    footnotes[fnNum] = {
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: `${cit?.authorityId ?? "?"} § ${cit?.section ?? "?"}${pg}${quote}`,
            }),
          ],
        }),
      ],
    };
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: "Georgia", size: 22 } } } },
    footnotes,
    sections: [
      {
        children: [...coverParagraphs, ...bodyParagraphs, ...exhibitParagraphs, ...auditParagraphs],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  // Wrap the Node buffer in a Blob so we hit the BodyInit branch cleanly.
  // The cast to BlobPart works around a TS lib mismatch where Node's
  // Uint8Array uses ArrayBufferLike while DOM Blob expects ArrayBuffer
  // specifically — both behave identically at runtime.
  const blob = new Blob(
    [new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength) as unknown as BlobPart],
    {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    },
  );
  const safeTitle = matter.title.replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, "-").slice(0, 64);
  return new Response(blob, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${safeTitle || "matter"}-review.docx"`,
      "Content-Length": String(blob.size),
    },
  });
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
