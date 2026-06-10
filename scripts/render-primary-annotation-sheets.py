#!/usr/bin/env python3
import json
import os
import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def clean(value):
    return str(value or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def para(text, style):
    return Paragraph(clean(text), style)


def make_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="SheetTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=23,
            spaceAfter=12,
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
    return styles


def table(rows, widths, styles):
    rendered = [[para(cell, styles["Tiny"]) for cell in row] for row in rows]
    tbl = Table(rendered, colWidths=widths, hAlign="LEFT")
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8ecef")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("LEADING", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#b8c0c7")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return tbl


def footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#555555"))
    canvas.drawString(0.65 * inch, 0.42 * inch, "Primary Document Annotation Sheet")
    canvas.drawRightString(7.85 * inch, 0.42 * inch, f"chronological item {doc.item_number}")
    canvas.restoreState()


def build_sheet(item, styles):
    output_path = item["outputPath"]
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    story = [
        para("Primary Document Annotation Sheet", styles["SheetTitle"]),
        para(item.get("title", ""), styles["Heading2"]),
        Spacer(1, 0.08 * inch),
    ]
    rows = [
        ["Chronological order", str(item.get("chronologicalOrder", ""))],
        ["Document date", item.get("date", "")],
        ["Original package order", str(item.get("originalPackageOrder", ""))],
        ["Original document pages", str(item.get("originalDocumentPages", item.get("documentPages", "")))],
        ["Retained document pages", str(item.get("retainedDocumentPages", ""))],
        ["Removed sparse/nontext pages", str(item.get("removedSparseDocumentPages", ""))],
        ["Source class", item.get("sourceClass", "")],
        ["Source PDF pages", item.get("sourcePages", "")],
        ["Retained source pages", item.get("retainedSourcePages", "")],
        ["Removed source pages", item.get("removedSourcePages", "")],
        ["Text-coverage filter", item.get("textCoverageFilter", "")],
        ["Official accompanying sheets", item.get("officialAnnotationPages", "")],
        ["Official sheet status", item.get("officialAnnotationStatus", "")],
        ["Source URL", item.get("sourceUrl", "")],
        ["PDF URL", item.get("pdfUrl", "")],
    ]
    story.append(table(rows, [1.65 * inch, 5.65 * inch], styles))
    story.append(Spacer(1, 0.16 * inch))
    story.append(para("Source Note", styles["Heading3"]))
    story.append(para(item.get("sourceNote", ""), styles["Small"]))
    story.append(Spacer(1, 0.12 * inch))
    story.append(para("Annotation Note", styles["Heading3"]))
    story.append(para(item.get("annotationNote", ""), styles["Small"]))

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=0.6 * inch,
        leftMargin=0.6 * inch,
        topMargin=0.62 * inch,
        bottomMargin=0.65 * inch,
        title=f"Annotation Sheet - {item.get('title', '')}",
        author="James Graham Wilson",
    )
    doc.item_number = item.get("chronologicalOrder", "")
    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    if len(sys.argv) != 2:
        print("Usage: render-primary-annotation-sheets.py INPUT_JSON", file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], "r", encoding="utf-8") as handle:
        items = json.load(handle)
    styles = make_styles()
    for item in items:
        build_sheet(item, styles)


if __name__ == "__main__":
    main()
