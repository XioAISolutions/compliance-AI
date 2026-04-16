#!/usr/bin/env python3
"""Generate the Compliance-AI demo handoff PDF from docs/compliance-handoff.md."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Flowable,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "compliance-handoff.md"
OUTPUT = ROOT / "output" / "pdf" / "compliance-ai-demo-handoff.pdf"


class Rule(Flowable):
    def __init__(self, width: float, color=colors.HexColor("#d5d5d5")):
        super().__init__()
        self.width = width
        self.color = color
        self.height = 1

    def draw(self):
        self.canv.setStrokeColor(self.color)
        self.canv.setLineWidth(0.6)
        self.canv.line(0, 0, self.width, 0)


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def inline(text: str) -> str:
    escaped = esc(text)
    parts: list[str] = []
    cursor = 0
    while True:
        start = escaped.find("`", cursor)
        if start == -1:
            parts.append(escaped[cursor:])
            break
        end = escaped.find("`", start + 1)
        if end == -1:
            parts.append(escaped[cursor:])
            break
        parts.append(escaped[cursor:start])
        parts.append(f"<font name='Courier'>{escaped[start + 1:end]}</font>")
        cursor = end + 1
    return "".join(parts)


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontName="Helvetica-Bold",
            fontSize=25,
            leading=30,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#111111"),
            spaceAfter=12,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#4b5563"),
            spaceAfter=18,
        ),
        "h2": ParagraphStyle(
            "Heading2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=15,
            leading=20,
            textColor=colors.HexColor("#111111"),
            spaceBefore=14,
            spaceAfter=7,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.6,
            leading=14,
            textColor=colors.HexColor("#222222"),
            alignment=TA_LEFT,
            spaceAfter=7,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=9.4,
            leading=13,
            leftIndent=12,
            textColor=colors.HexColor("#222222"),
        ),
        "code": ParagraphStyle(
            "Code",
            parent=base["Code"],
            fontName="Courier",
            fontSize=8,
            leading=10.5,
            textColor=colors.HexColor("#111111"),
            backColor=colors.HexColor("#f5f5f5"),
            borderColor=colors.HexColor("#dddddd"),
            borderWidth=0.4,
            borderPadding=7,
            spaceBefore=4,
            spaceAfter=9,
        ),
        "small": ParagraphStyle(
            "Small",
            parent=base["BodyText"],
            fontName="Helvetica",
            fontSize=8,
            leading=11,
            textColor=colors.HexColor("#6b7280"),
        ),
    }


def parse_markdown(markdown: str):
    s = styles()
    story = []
    bullets: list[str] = []
    numbered: list[str] = []
    paragraph: list[str] = []
    code: list[str] = []
    in_code = False
    title_written = False

    def flush_paragraph():
        nonlocal paragraph
        if paragraph:
            story.append(Paragraph(inline(" ".join(paragraph)), s["body"]))
            paragraph = []

    def flush_bullets():
        nonlocal bullets
        if bullets:
            story.append(
                ListFlowable(
                    [ListItem(Paragraph(inline(item), s["bullet"])) for item in bullets],
                    bulletType="bullet",
                    start="circle",
                    leftIndent=16,
                )
            )
            story.append(Spacer(1, 3))
            bullets = []

    def flush_numbered():
        nonlocal numbered
        if numbered:
            story.append(
                ListFlowable(
                    [ListItem(Paragraph(inline(item), s["bullet"])) for item in numbered],
                    bulletType="1",
                    leftIndent=18,
                )
            )
            story.append(Spacer(1, 3))
            numbered = []

    def flush_code():
        nonlocal code
        if code:
            story.append(Preformatted("\n".join(code), s["code"]))
            code = []

    def flush_all():
        flush_paragraph()
        flush_bullets()
        flush_numbered()
        flush_code()

    for raw_line in markdown.splitlines():
        line = raw_line.rstrip()
        if line.startswith("```"):
            if in_code:
                flush_code()
                in_code = False
            else:
                flush_paragraph()
                flush_bullets()
                flush_numbered()
                in_code = True
            continue
        if in_code:
            code.append(line)
            continue
        if not line.strip():
            flush_all()
            continue
        if raw_line[:1].isspace() and (bullets or numbered):
            continuation = line.strip()
            if numbered:
                numbered[-1] = f"{numbered[-1]} {continuation}"
            else:
                bullets[-1] = f"{bullets[-1]} {continuation}"
            continue
        if line.startswith("# "):
            flush_all()
            title = line[2:].strip()
            story.append(Paragraph(esc(title), s["title"]))
            story.append(
                Paragraph(
                    "One cockpit. Cited reviews. Evidence, approvals, transcript, graph, and handoff export.",
                    s["subtitle"],
                )
            )
            story.append(Rule(6.9 * inch))
            story.append(Spacer(1, 10))
            title_written = True
            continue
        if line.startswith("## "):
            flush_all()
            if title_written and len(story) > 55:
                story.append(PageBreak())
            story.append(Paragraph(esc(line[3:].strip()), s["h2"]))
            continue
        if line.startswith("- "):
            flush_paragraph()
            flush_numbered()
            bullets.append(line[2:].strip())
            continue
        if len(line) > 2 and line[0].isdigit() and line[1:3] == ". ":
            flush_paragraph()
            flush_bullets()
            numbered.append(line[3:].strip())
            continue
        paragraph.append(line.strip())

    flush_all()
    return story


def add_summary_panel(story):
    s = styles()
    data = [
        ["Primary surface", "Securities Review"],
        ["Secondary surface", "Infosec GRC"],
        ["Deploy service", "Railway compliance-ai-preview"],
        ["Healthcheck", "/api/healthcheck"],
        ["Provider modes", "OpenAI hosted, Ollama local, Anthropic legacy"],
    ]
    table = Table(data, colWidths=[1.55 * inch, 4.85 * inch], hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#f8fafc")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#111111")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.8),
                ("LEADING", (0, 0), (-1, -1), 11),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#d8dee9")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.insert(5, Spacer(1, 6))
    story.insert(6, table)
    story.insert(7, Spacer(1, 10))


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#6b7280"))
    canvas.drawString(0.72 * inch, 0.45 * inch, "XIO Compliance Brain demo handoff")
    canvas.drawRightString(7.78 * inch, 0.45 * inch, f"Page {doc.page}")
    canvas.restoreState()


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    markdown = SOURCE.read_text(encoding="utf-8")
    story = parse_markdown(markdown)
    add_summary_panel(story)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=LETTER,
        rightMargin=0.72 * inch,
        leftMargin=0.72 * inch,
        topMargin=0.68 * inch,
        bottomMargin=0.7 * inch,
        title="XIO Compliance Brain demo handoff",
        author="XioAI Solutions",
        subject="Compliance-AI demo cockpit handoff",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(OUTPUT)


if __name__ == "__main__":
    main()
