/**
 * /api/demo/handoff/pdf — PDF export of the seeded Triad Review handoff.
 *
 * Sibling of /api/demo/handoff/docx. Generates the same review content as
 * a real PDF so a judge clicking the "Export redline" button on
 * /demo/judge sees what a production export looks like, rather than a
 * disabled placeholder.
 *
 * Uses `pdf-lib` (pure-JS, no native bindings) for layout. The PDF is
 * paginated automatically based on remaining vertical space; we don't
 * try to do redline tracked-changes markup (out of scope for a hackathon
 * demo render — the visible-export-gate story stays preserved by the
 * Approval state on the matter).
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
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

const PAGE_WIDTH = 612; // US Letter
const PAGE_HEIGHT = 792;
const MARGIN_X = 56;
const MARGIN_TOP = 56;
const MARGIN_BOTTOM = 56;

interface Cursor {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

function ensureSpace(c: Cursor, needed: number) {
  if (c.y - needed < MARGIN_BOTTOM) {
    c.page = c.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    c.y = PAGE_HEIGHT - MARGIN_TOP;
  }
}

/**
 * Standard PDF fonts (Helvetica et al.) only support WinAnsi encoding,
 * which cannot represent characters like → · — ≈ etc. The seeded matter
 * uses these throughout. Rather than embed a Unicode font (and ship a
 * 250 KB+ TTF asset just for the demo), we substitute ASCII equivalents
 * before drawing. The visual loss is minor; the file integrity wins.
 */
function sanitizeForWinAnsi(s: string): string {
  return (
    s
      .replace(/→/g, "->") // →
      .replace(/←/g, "<-") // ←
      .replace(/·/g, "-") // ·
      .replace(/—/g, "--") // — em dash
      .replace(/–/g, "-") // – en dash
      .replace(/[‘’]/g, "'") // ’ ‘
      .replace(/[“”]/g, '"') // “ ”
      .replace(/…/g, "...") // …
      .replace(/≈/g, "~") // ≈
      .replace(/≥/g, ">=") // ≥
      .replace(/≤/g, "<=") // ≤
      .replace(/×/g, "x") // ×
      .replace(/\u00A0/g, " ") // non-breaking space
      .replace(/•/g, "*") // • (in case it appears in seed text — our drawn bullet uses literal "•" but that's drawn separately and OK because Helvetica DOES support U+2022)
      // Final guard: strip any remaining non-WinAnsi-encodable codepoints.
      // WinAnsi covers U+0020-U+00FF roughly, with a few exceptions. Easier
      // to just drop anything outside basic Latin + Latin-1 supplement.
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "?")
  );
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = sanitizeForWinAnsi(text).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    const w = font.widthOfTextAtSize(candidate, size);
    if (w > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawLine(
  c: Cursor,
  text: string,
  opts: {
    bold?: boolean;
    italic?: boolean;
    size?: number;
    indent?: number;
    spaceAfter?: number;
    color?: ReturnType<typeof rgb>;
  } = {},
) {
  const size = opts.size ?? 11;
  const indent = opts.indent ?? 0;
  const spaceAfter = opts.spaceAfter ?? 4;
  const color = opts.color ?? rgb(0.1, 0.1, 0.1);
  const font = opts.bold ? c.bold : opts.italic ? c.italic : c.font;
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2 - indent;
  const lines = wrap(text, font, size, maxWidth);
  const lineHeight = size * 1.35;
  ensureSpace(c, lines.length * lineHeight + spaceAfter);
  for (const line of lines) {
    c.page.drawText(line, {
      x: MARGIN_X + indent,
      y: c.y - size,
      size,
      font,
      color,
    });
    c.y -= lineHeight;
  }
  c.y -= spaceAfter;
}

function drawHeading(c: Cursor, text: string, level: 1 | 2) {
  const size = level === 1 ? 16 : 13;
  const spaceBefore = level === 1 ? 14 : 10;
  c.y -= spaceBefore;
  drawLine(c, text, { bold: true, size, spaceAfter: 6 });
}

function drawBullet(c: Cursor, text: string, indent = 0) {
  const baseIndent = 12 + indent * 14;
  const size = 11;
  const lineHeight = size * 1.35;
  // Wrap and draw each wrapped line with a "•" only in front of the first.
  const maxWidth = PAGE_WIDTH - MARGIN_X * 2 - baseIndent - 12;
  const lines = wrap(text, c.font, size, maxWidth);
  ensureSpace(c, lines.length * lineHeight + 4);
  let first = true;
  for (const line of lines) {
    if (first) {
      c.page.drawText("•", {
        x: MARGIN_X + baseIndent,
        y: c.y - size,
        size,
        font: c.bold,
        color: rgb(0.3, 0.3, 0.3),
      });
      first = false;
    }
    c.page.drawText(line, {
      x: MARGIN_X + baseIndent + 12,
      y: c.y - size,
      size,
      font: c.font,
      color: rgb(0.1, 0.1, 0.1),
    });
    c.y -= lineHeight;
  }
  c.y -= 4;
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

  const doc = await PDFDocument.create();
  doc.setTitle(`Triad Review — ${m.title}`);
  doc.setAuthor("XIO Compliance Brain");
  doc.setSubject("Demo seed handoff. Illustrative; not a real customer engagement.");
  doc.setProducer("XIO Compliance Brain · /api/demo/handoff/pdf");
  doc.setCreator("XIO Compliance Brain");
  doc.setCreationDate(new Date());

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const c: Cursor = { doc, page, y: PAGE_HEIGHT - MARGIN_TOP, font, bold, italic };

  // Title block
  drawLine(c, "XIO Compliance Brain", { bold: true, size: 22, spaceAfter: 4 });
  drawLine(c, "Triad Review — Handoff Document", { bold: true, size: 16, spaceAfter: 8 });
  drawLine(c, "Demo seed · illustrative · not a real customer engagement", {
    italic: true,
    size: 10,
    spaceAfter: 16,
    color: rgb(0.4, 0.4, 0.4),
  });

  // Matter
  drawHeading(c, "Matter", 1);
  drawBullet(c, `Title: ${m.title}`);
  drawBullet(c, `Document type: ${m.documentType}`);
  drawBullet(c, `Jurisdiction: ${m.jurisdiction}`);
  drawBullet(c, `Registration: ${m.registrationCategory}`);
  drawBullet(c, `Task: ${m.taskType}`);
  drawBullet(c, `Compliance score: ${m.complianceScore}%`);
  drawBullet(c, `Critical gaps: ${m.criticalGapCount}`);
  drawBullet(c, `Verified citations: ${m.verifiedCitationCount}`);
  drawBullet(c, `Reviewer disagreement: ${m.reviewerDisagreementCount} material`);

  drawHeading(c, "Excerpt under review", 2);
  drawLine(c, `"${m.documentExcerpt}"`, { italic: true });

  drawHeading(c, "Reviewer instruction", 2);
  drawLine(c, m.reviewerInstruction);

  // Findings
  drawHeading(c, "Findings by reviewer", 1);
  for (const rev of TRIAD_REVIEWERS) {
    const items = m.findings.filter((f) => f.raisedBy === rev.id);
    if (items.length === 0) continue;
    drawHeading(c, `${rev.name} — ${items.length} finding${items.length === 1 ? "" : "s"}`, 2);
    drawLine(c, rev.description, { italic: true, size: 10, color: rgb(0.35, 0.35, 0.35) });
    for (const f of items) {
      drawLine(c, `[${SEVERITY_LABEL[f.severity]}] ${f.title}`, { bold: true });
      drawLine(c, f.detail);
      drawLine(c, `Recommended fix: ${f.recommendedFix}`, { bold: true });
      if (f.citations.length === 0) {
        drawLine(c, "No citations attached — Evidence Auditor refuses to sign off.", {
          italic: true,
        });
      } else {
        drawLine(c, "Citations:", { bold: true, spaceAfter: 2 });
        for (const cit of f.citations) {
          drawBullet(
            c,
            `${cit.authorityTitle} §${cit.section} [${cit.badge}] — "${cit.quote}" (${cit.badgeReason})`,
            1,
          );
        }
      }
    }
  }

  drawHeading(c, "Citation integrity", 1);
  drawBullet(
    c,
    `${verifiedCount} verified · ${needsCheckCount} needs manual check · ${jurisdictionMismatchCount} jurisdiction mismatch`,
  );
  drawBullet(
    c,
    `${m.findings.flatMap((f) => f.citations).length} citations across ${m.findings.length} findings`,
  );

  if (m.disagreements.length > 0) {
    drawHeading(c, "Where reviewers disagreed", 1);
    for (const d of m.disagreements) {
      drawHeading(c, d.issue, 2);
      for (const rev of TRIAD_REVIEWERS) {
        drawLine(c, `${rev.name}: ${d.views[rev.id]}`);
      }
      drawLine(c, `Final action: ${d.finalAction}`, { bold: true });
    }
  }

  drawHeading(c, "Approval & export gate", 1);
  drawBullet(c, `Reviewer status: ${m.approval.reviewerStatus}`);
  drawBullet(c, `Approval state: ${m.approval.approvalState}`);
  drawBullet(c, `Export state: ${m.approval.exportState}`);
  drawBullet(c, `Output hash: ${m.approval.outputHash}`);
  drawBullet(
    c,
    "DOCX / redline export is BLOCKED in production until a human approver signs the output hash above.",
  );
  drawLine(c, "This file: demo render of the export shape.", { italic: true });

  drawHeading(c, "Engine receipt", 1);
  drawBullet(c, `Provider: ${providerLine}`);
  if (providerBaseUrl) drawBullet(c, `Base URL: ${providerBaseUrl}`);
  drawBullet(c, `Workflow: ${m.amd.workflow}`);
  drawBullet(c, `Hardware target: ${m.amd.hardwareTarget}`);
  drawBullet(
    c,
    `Recorded run: ${(m.recordedWallClockMs / 1000).toFixed(1)}s wall (${m.recordedAt})`,
  );
  drawBullet(c, `Exported at: ${exportedAt}`);

  const bytes = await doc.save();
  const filename = `xio-triad-handoff-${m.id}.pdf`;
  // Wrap in Buffer to satisfy Response's BodyInit typing on TS 5.7+ — the
  // raw Uint8Array<ArrayBufferLike> returned by pdf-lib doesn't match the
  // type narrowly enough. We're on the Node runtime, so Buffer is fine.
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
