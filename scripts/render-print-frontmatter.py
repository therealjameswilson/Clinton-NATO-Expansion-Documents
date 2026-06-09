#!/usr/bin/env python3
import json
import os
import sys
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def clean(value):
    return str(value or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def short(value, limit=90):
    text = " ".join(str(value or "").split())
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


def para(text, style):
    return Paragraph(clean(text), style)


def make_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="CoverTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=30,
            alignment=TA_CENTER,
            spaceAfter=18,
        )
    )
    styles.add(
        ParagraphStyle(
            name="CoverSub",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=14,
            leading=20,
            alignment=TA_CENTER,
            spaceAfter=14,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Section",
            parent=styles["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            spaceBefore=12,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Small",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8,
            leading=10,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Tiny",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=7,
            leading=9,
        )
    )
    styles.add(
        ParagraphStyle(
            name="DividerTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=22,
            leading=28,
            alignment=TA_CENTER,
            spaceAfter=18,
        )
    )
    styles.add(
        ParagraphStyle(
            name="DividerSub",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=12,
            leading=17,
            alignment=TA_CENTER,
            spaceAfter=12,
        )
    )
    return styles


def styled_table(rows, widths, repeat=1, font_size=7):
    table = Table(rows, colWidths=widths, repeatRows=repeat, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8ecef")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#111111")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), font_size),
                ("LEADING", (0, 0), (-1, -1), font_size + 2),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#b8c0c7")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8f9fa")]),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#555555"))
    canvas.drawString(0.65 * inch, 0.42 * inch, "Barton Bernstein NATO Expansion Offline Print Packet")
    canvas.drawRightString(7.85 * inch, 0.42 * inch, f"front matter p. {doc.page}")
    canvas.restoreState()


def build_frontmatter(data, output_path):
    styles = make_styles()
    story = []
    manifest = data["manifest"]
    handoff = data["handoff"]
    included = data["included"]
    citation_only = data["citationOnly"]
    primary = data["primary"]
    final = data.get("final", {})

    story.append(Spacer(1, 1.1 * inch))
    story.append(para("Barton Bernstein Offline Print Packet", styles["CoverTitle"]))
    story.append(para("Clinton NATO Expansion Documents and Historiography", styles["CoverSub"]))
    story.append(para(f"Prepared locally on {datetime.now().strftime('%B %-d, %Y')}", styles["CoverSub"]))
    story.append(Spacer(1, 0.35 * inch))
    story.append(
        para(
            "This packet is designed for print and offline reading. It begins with the 1000-page primary-document package, then appends a historiographical reader built from public or user-provided PDF sources. Copyrighted or access-controlled works that were located but not suitable for reproduction are listed in the front matter.",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 0.2 * inch))
    story.append(
        para(
            "Public repository materials preserve the citations, source URLs, and build scripts. The merged PDF and downloaded sources remain in the ignored private directory on this machine.",
            styles["Normal"],
        )
    )
    story.append(PageBreak())

    story.append(para("Reader's Map", styles["Section"]))
    rows = [
        ["Section", "What It Contains", "Pages"],
        [
            "Front matter",
            "Reader note, Bernstein decisionmaking guide, start-here records, withheld SOC/minutes queue, and historiography inventory.",
            str(final.get("frontMatterPages", "TBD")),
        ],
        [
            "Primary documents",
            "The existing Clinton NATO expansion 1000-page declassified-document package.",
            str(primary.get("pages", primary.get("expectedPages", ""))),
        ],
    ]
    for item in included:
        rows.append(
            [
                f"Historiography {item['order']}",
                f"{item['authors']}, {item['title']}",
                str(item.get("pages", item.get("expectedPages", ""))),
            ]
        )
    story.append(styled_table([[para(cell, styles["Tiny"]) for cell in row] for row in rows], [1.1 * inch, 5.4 * inch, 0.8 * inch], font_size=7))
    story.append(PageBreak())

    story.append(para("Print and Rights Note", styles["Section"]))
    for item in manifest.get("printPolicy", []):
        story.append(para(f"- {item}", styles["Normal"]))
    story.append(Spacer(1, 0.15 * inch))
    story.append(
        para(
            "In practice: use the merged PDF as Barton's print binder, but keep the public GitHub repository limited to citations, manifests, and scripts.",
            styles["Normal"],
        )
    )

    story.append(para("Bernstein Decisionmaking Lens", styles["Section"]))
    for q in handoff.get("researchQuestions", []):
        story.append(para(f"- {q}", styles["Normal"]))
    story.append(PageBreak())

    story.append(para("Start-Here Primary Documents", styles["Section"]))
    start_rows = [["#", "Date", "Pages", "Lane", "Record"]]
    for idx, record in enumerate(handoff.get("startHere", []), start=1):
        start_rows.append(
            [
                str(idx),
                record.get("date", ""),
                str(record.get("pageCount", "")),
                short(record.get("bernstein", {}).get("lane", ""), 26),
                short(record.get("title", ""), 90),
            ]
        )
    story.append(styled_table([[para(cell, styles["Tiny"]) for cell in row] for row in start_rows], [0.35 * inch, 0.72 * inch, 0.42 * inch, 1.2 * inch, 4.6 * inch], font_size=7))
    story.append(PageBreak())

    story.append(para("Withheld Minutes and Summaries of Conclusions", styles["Section"]))
    withheld_rows = [["Date", "Committee", "Record", "Status"]]
    for record in handoff.get("withheldMeetingControls", []):
        release_status = record.get("releaseStatus")
        if release_status == "withheld duplicate control":
            release_status = "withheld duplicate"
        status = " / ".join(part for part in [release_status, record.get("restriction")] if part)
        withheld_rows.append(
            [
                record.get("date", ""),
                short(record.get("committee", ""), 28),
                short(record.get("title", ""), 92),
                short(status, 34),
            ]
        )
    story.append(styled_table([[para(cell, styles["Tiny"]) for cell in row] for row in withheld_rows], [0.75 * inch, 1.15 * inch, 4.35 * inch, 1.1 * inch], font_size=7))
    story.append(
        para(
            "These entries remain evidence gaps rather than omitted arguments. They should be pursued before treating the documentary record of NSC process as complete.",
            styles["Small"],
        )
    )
    story.append(PageBreak())

    story.append(para("Historiography Included as Full PDF", styles["Section"]))
    inc_rows = [["#", "Author / Year", "Pages", "Title", "Why It Is Here"]]
    for item in included:
        inc_rows.append(
            [
                str(item.get("order", "")),
                short(f"{item.get('authors', '')} ({item.get('year', '')})", 46),
                str(item.get("pages", item.get("expectedPages", ""))),
                short(item.get("title", ""), 72),
                short(item.get("whyForBernstein", ""), 105),
            ]
        )
    story.append(styled_table([[para(cell, styles["Tiny"]) for cell in row] for row in inc_rows], [0.28 * inch, 1.45 * inch, 0.38 * inch, 2.15 * inch, 3.05 * inch], font_size=6.6))
    story.append(PageBreak())

    story.append(para("Located but Not Reproduced", styles["Section"]))
    citation_rows = [["Author / Year", "Title", "Access Note"]]
    for item in citation_only:
        citation_rows.append(
            [
                short(f"{item.get('authors', '')} ({item.get('year', '')})", 52),
                short(item.get("title", ""), 88),
                short(item.get("accessNote", ""), 110),
            ]
        )
    story.append(styled_table([[para(cell, styles["Tiny"]) for cell in row] for row in citation_rows], [1.65 * inch, 2.45 * inch, 3.2 * inch], font_size=6.6))
    story.append(PageBreak())

    story.append(para("Citation URLs", styles["Section"]))
    url_rows = [["ID", "URL"]]
    for item in included:
        url_rows.append([item.get("id", ""), item.get("pageUrl") or item.get("repositoryUrl") or item.get("pdfUrl", "")])
    for item in citation_only:
        url_rows.append([item.get("id", ""), item.get("url", "")])
    story.append(styled_table([[para(cell, styles["Tiny"]) for cell in row] for row in url_rows], [2.25 * inch, 5.05 * inch], font_size=6.2))

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=0.6 * inch,
        leftMargin=0.6 * inch,
        topMargin=0.62 * inch,
        bottomMargin=0.65 * inch,
        title="Barton Bernstein NATO Expansion Print Packet Front Matter",
        author="James Graham Wilson",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def build_divider(output_path, title, subtitle, details):
    styles = make_styles()
    story = [Spacer(1, 1.4 * inch), para(title, styles["DividerTitle"]), para(subtitle, styles["DividerSub"])]
    story.append(Spacer(1, 0.35 * inch))
    for label, value in details:
        if value:
            story.append(para(f"{label}: {value}", styles["Normal"]))
            story.append(Spacer(1, 0.08 * inch))
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=0.75 * inch,
        leftMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
    )
    doc.build(story)


def main():
    if len(sys.argv) != 4:
        print("Usage: render-print-frontmatter.py DATA_JSON FRONTMATTER_PDF DIVIDER_DIR", file=sys.stderr)
        sys.exit(2)
    data_path, frontmatter_path, divider_dir = sys.argv[1:4]
    with open(data_path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    os.makedirs(divider_dir, exist_ok=True)
    build_frontmatter(data, frontmatter_path)
    build_divider(
        os.path.join(divider_dir, "000-primary-documents-divider.pdf"),
        "Primary Documents",
        "Clinton NATO Expansion Bernstein 1000-Page Package",
        [
            ("Local source", data["primary"].get("localPath")),
            ("Pages", data["primary"].get("pages") or data["primary"].get("expectedPages")),
            ("Reader note", "This section contains the declassified primary records selected for the 1000-page baseline package."),
        ],
    )
    for item in data["included"]:
        build_divider(
            os.path.join(divider_dir, f"{int(item['order']):03d}-{item['id']}-divider.pdf"),
            f"Historiography {item['order']}",
            item.get("title", ""),
            [
                ("Author", item.get("authors")),
                ("Citation", item.get("citation")),
                ("Pages", item.get("pages") or item.get("expectedPages")),
                ("Source", item.get("pageUrl") or item.get("repositoryUrl") or item.get("pdfUrl")),
                ("Why for Bernstein", item.get("whyForBernstein")),
            ],
        )


if __name__ == "__main__":
    main()
