import json
import os
import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


def para(text, style):
    text = str(text or "")
    return Paragraph(text.replace("&", "&amp;"), style)


def styles():
    base = getSampleStyleSheet()
    base.add(ParagraphStyle(
        name="TitleLarge",
        parent=base["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        spaceAfter=12,
    ))
    base.add(ParagraphStyle(
        name="Section",
        parent=base["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        spaceBefore=8,
        spaceAfter=5,
    ))
    base.add(ParagraphStyle(
        name="BodyTight",
        parent=base["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        spaceAfter=7,
    ))
    base.add(ParagraphStyle(
        name="Small",
        parent=base["BodyText"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
    ))
    return base


def metadata_table(rows, style_map):
    table = Table(rows, colWidths=[1.9 * inch, 5.1 * inch], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#b7b7b7")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eeeeee")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return table


def write_pdf(path, story):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    doc = SimpleDocTemplate(
        path,
        pagesize=letter,
        rightMargin=0.65 * inch,
        leftMargin=0.65 * inch,
        topMargin=0.65 * inch,
        bottomMargin=0.65 * inch,
    )
    doc.build(story)


def volume_rows(volumes):
    rows = [["Volume", "Contents", "Packet pages", "PDF pages"]]
    for vol in volumes:
        rows.append([
            f"{vol['number']:02d}",
            vol["title"],
            vol["packetPageRange"],
            str(vol.get("finalPages", vol["contentPages"] + 1)),
        ])
    return rows


def table_style():
    return TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#b7b7b7")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#dddddd")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ])


def render_cover_memo(data, style_map):
    rows = [
        ["To", "Professor Barton Bernstein"],
        ["From", "James Graham Wilson"],
        ["Re", "Print packet: NATO expansion during the Clinton administration, 1993-2000"],
        ["Date", data["generatedDate"]],
        ["Enclosure", f"{data['volumeCount']} bound print volumes plus cover memo and print-shop instructions"],
    ]
    story = [
        para("Cover Memo", style_map["TitleLarge"]),
        metadata_table(rows, style_map),
        Spacer(1, 0.18 * inch),
        para("This package is prepared for offline reading and printing. It contains selected declassified primary documents on NATO expansion during the Clinton administration, arranged chronologically and paired with provenance and annotation material, followed by historiographical readings.", style_map["BodyTight"]),
        para("Each primary-document bundle begins with a generated annotation sheet. When the source packet includes official annotation, control, or withdrawal sheets, those pages are preserved immediately before the main document text.", style_map["BodyTight"]),
        para("The primary-document section was filtered to remove pages that are neither annotation/provenance material nor main-document pages meeting the 30 percent extracted-text coverage rule. No primary record was reduced to zero retained document pages.", style_map["BodyTight"]),
        para("Volume List", style_map["Section"]),
    ]
    table = Table(volume_rows(data["volumes"]), colWidths=[0.65 * inch, 3.95 * inch, 1.2 * inch, 1.0 * inch])
    table.setStyle(table_style())
    story.append(table)
    write_pdf(data["coverMemoPath"], story)


def render_instructions(data, style_map):
    story = [
        para("Print and Send Instructions", style_map["TitleLarge"]),
        para("Recommended handling:", style_map["Section"]),
        para("1. Print the cover memo first, then the numbered volume PDFs in order.", style_map["BodyTight"]),
        para("2. Bind each numbered volume separately. Do not combine all volumes into one physical binding.", style_map["BodyTight"]),
        para("3. Preserve original page scaling. Use black-and-white printing unless color is specifically required by the printer.", style_map["BodyTight"]),
        para("4. Keep each volume cover sheet at the front of its volume.", style_map["BodyTight"]),
        para("5. Include the manifest CSV if sending the files digitally to a print shop.", style_map["BodyTight"]),
        para("6. The full single-file PDF is included for archival use; the volume PDFs are the practical print set.", style_map["BodyTight"]),
        para("Package Summary", style_map["Section"]),
        metadata_table([
            ["Full packet pages", str(data["finalPages"])],
            ["Primary section pages", str(data["primaryPages"])],
            ["Retained primary document pages", str(data["retainedDocumentPages"])],
            ["Sparse/nontext primary pages removed", str(data["removedSparseDocumentPages"])],
            ["Generated annotation sheets", str(data["generatedAnnotationPages"])],
            ["Official annotation/control/withdrawal pages", str(data["officialAnnotationPages"])],
            ["Chronology violations", str(data["chronologyViolations"])],
        ], style_map),
        Spacer(1, 0.18 * inch),
        para("Volume Manifest", style_map["Section"]),
    ]
    table = Table(volume_rows(data["volumes"]), colWidths=[0.65 * inch, 3.95 * inch, 1.2 * inch, 1.0 * inch])
    table.setStyle(table_style())
    story.append(table)
    write_pdf(data["instructionsPath"], story)


def render_volume_cover(data, volume, style_map):
    rows = [
        ["Volume", f"{volume['number']:02d} of {data['volumeCount']:02d}"],
        ["Contents", volume["title"]],
        ["Packet page range", volume["packetPageRange"]],
        ["PDF pages in this file", str(volume.get("finalPages", volume["contentPages"] + 1))],
        ["Date span", volume.get("dateSpan", "")],
        ["Record range", volume.get("recordRange", "")],
    ]
    story = [
        para(f"Volume {volume['number']:02d}", style_map["TitleLarge"]),
        para(volume["title"], style_map["Section"]),
        metadata_table(rows, style_map),
        Spacer(1, 0.18 * inch),
        para(volume.get("note", ""), style_map["BodyTight"]),
        para("This volume is part of the Barton Bernstein offline print packet on NATO expansion during the Clinton administration, 1993-2000.", style_map["Small"]),
    ]
    write_pdf(volume["coverPath"], story)


def main():
    if len(sys.argv) != 2:
        print("Usage: render-delivery-package-documents.py DATA_JSON", file=sys.stderr)
        sys.exit(2)
    with open(sys.argv[1], "r", encoding="utf-8") as handle:
        data = json.load(handle)
    style_map = styles()
    render_cover_memo(data, style_map)
    render_instructions(data, style_map)
    for volume in data["volumes"]:
        render_volume_cover(data, volume, style_map)


if __name__ == "__main__":
    main()
