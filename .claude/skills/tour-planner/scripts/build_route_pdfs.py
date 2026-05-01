#!/usr/bin/env python3
"""
Build one printable PDF per day for a multi-day itinerary.

Usage:
    python3 build_route_pdfs.py <output_dir> <routes_json>

Where <routes_json> is a JSON file with this shape:

[
  {
    "slug":      "Day_1_Friday_May22",
    "title":     "Day 1 — Friday, May 22, 2026",
    "subtitle":  "Arrival → Pest Icons → Sunset Cruise",
    "summary":   "Half-day Pest icon walk ending at the 20:30 sunset cruise.",
    "mode":      "Walking",
    "estimated": "~4 km on foot · ~1h 45m walking",
    "stops":     [
        {"name": "Astoria", "address": "Kossuth Lajos u. 19, 1053 Budapest"},
        {"name": "Shoes on the Danube Bank", "address": "Id. Antall József rkp., 1054 Budapest"}
    ],
    "url": "https://www.google.com/maps/dir/.../?travelmode=walking"
  },
  ...
]

Output:
    <output_dir>/<slug>_route.pdf      (one per entry)
    <output_dir>/routes_index.json     (compact summary the markdown can link to)

Dependencies:
    reportlab, qrcode, Pillow.
    If qrcode is missing, install with: pip install qrcode --break-system-packages

Why this design:
    The QR code is the operational core — a user prints the PDF, folds it, and
    scans with a phone camera to open the live Google Maps route with
    turn-by-turn navigation. The clickable URL is the desktop fallback. We
    deliberately do NOT embed a static map image, because static maps go stale,
    require API keys with most providers, and add no value over the QR code.
"""

import io
import json
import os
import sys

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib.colors import HexColor, black
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle,
    )
    from reportlab.lib.enums import TA_LEFT
except ImportError as e:
    print(f"reportlab is required: pip install reportlab --break-system-packages\n  {e}", file=sys.stderr)
    sys.exit(2)

try:
    import qrcode
    from qrcode.constants import ERROR_CORRECT_M
except ImportError as e:
    print(f"qrcode is required: pip install qrcode --break-system-packages\n  {e}", file=sys.stderr)
    sys.exit(2)


def make_qr_image(url: str, size_inches: float = 2.0):
    qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=6, border=2)
    qr.add_data(url)
    qr.make(fit=True)
    pil_img = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    buf.seek(0)
    return Image(buf, width=size_inches * inch, height=size_inches * inch)


def truncate(s: str, max_len: int = 90) -> str:
    return s if len(s) <= max_len else s[: max_len - 3] + "..."


def build_pdf(day: dict, out_path: str) -> None:
    """Render one day's PDF. Required keys in `day`:
       slug, title, subtitle, summary, mode, estimated, stops (list of dicts), url.
    """
    required = {"slug", "title", "subtitle", "summary", "mode", "estimated", "stops", "url"}
    missing = required - day.keys()
    if missing:
        raise ValueError(f"Day {day.get('slug', '?')} missing keys: {missing}")

    doc = SimpleDocTemplate(
        out_path,
        pagesize=letter,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
        title=day["title"],
        author="Tour-Planner Skill",
    )

    styles = getSampleStyleSheet()
    styles["Title"].textColor = HexColor("#1a3a52")
    styles["Title"].fontSize = 18
    styles["Title"].spaceAfter = 4

    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=13,
                        textColor=HexColor("#1a3a52"), spaceAfter=6)
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=10.5,
                          leading=14, alignment=TA_LEFT)
    cell = ParagraphStyle("cell", parent=styles["BodyText"], fontSize=10,
                          leading=12, textColor=black)
    note = ParagraphStyle("note", parent=styles["BodyText"], fontSize=9,
                          leading=11, textColor=HexColor("#666666"))

    story = []
    story.append(Paragraph(day["title"], styles["Title"]))
    story.append(Paragraph(day["subtitle"], h2))
    story.append(Spacer(1, 0.1 * inch))

    story.append(Paragraph(f"<b>Mode:</b> {day['mode']}", body))
    story.append(Paragraph(f"<b>Estimate:</b> {day['estimated']}", body))
    story.append(Spacer(1, 0.18 * inch))

    story.append(Paragraph(day["summary"], body))
    story.append(Spacer(1, 0.22 * inch))

    # Stops table
    story.append(Paragraph("Route stops", h2))
    table_data = [[
        Paragraph("<b>#</b>", cell),
        Paragraph("<b>Stop</b>", cell),
        Paragraph("<b>Address</b>", cell),
    ]]
    for i, stop in enumerate(day["stops"], 1):
        table_data.append([
            Paragraph(str(i), cell),
            Paragraph(stop.get("name", ""), cell),
            Paragraph(stop.get("address", ""), cell),
        ])
    t = Table(table_data, colWidths=[0.4 * inch, 2.5 * inch, 3.6 * inch])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HexColor("#e8eef5")),
        ("LINEBELOW", (0, 0), (-1, 0), 1, HexColor("#1a3a52")),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, HexColor("#cccccc")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [HexColor("#ffffff"), HexColor("#f7f9fc")]),
    ]))
    story.append(t)
    story.append(Spacer(1, 0.25 * inch))

    # QR + URL block side-by-side
    qr_img = make_qr_image(day["url"])
    short_url = truncate(day["url"])
    url_paragraph_text = (
        f'<b>Open this route in Google Maps</b><br/>'
        f'<font size="9" color="#1a73e8"><link href="{day["url"]}">'
        f'{short_url}</link></font><br/><br/>'
        f'<font size="8.5" color="#666666">Scan the QR code with your phone camera '
        f'to open the live route in Google Maps with turn-by-turn directions, '
        f'real-time transit, and walking times.</font>'
    )
    qr_table = Table(
        [[qr_img, Paragraph(url_paragraph_text, body)]],
        colWidths=[2.2 * inch, 4.3 * inch],
    )
    qr_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(qr_table)
    story.append(Spacer(1, 0.25 * inch))

    story.append(Paragraph(
        "Generated by the tour-planner skill · "
        "Pairs with the primary itinerary markdown.",
        note,
    ))

    doc.build(story)


def main():
    if len(sys.argv) != 3:
        print("Usage: build_route_pdfs.py <output_dir> <routes_json>", file=sys.stderr)
        sys.exit(2)

    out_dir = sys.argv[1]
    routes_path = sys.argv[2]

    with open(routes_path) as f:
        days = json.load(f)
    if not isinstance(days, list) or not days:
        print(f"{routes_path}: expected a non-empty JSON array of day objects.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(out_dir, exist_ok=True)

    summary = []
    for day in days:
        out = os.path.join(out_dir, day["slug"] + "_route.pdf")
        build_pdf(day, out)
        size = os.path.getsize(out)
        print(f"  {os.path.basename(out):45s}  {size:>7} bytes")
        summary.append({
            "slug": day["slug"],
            "title": day["title"],
            "subtitle": day["subtitle"],
            "url": day["url"],
            "pdf": day["slug"] + "_route.pdf",
        })

    index_path = os.path.join(out_dir, "routes_index.json")
    with open(index_path, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\nWrote {len(days)} PDFs + routes_index.json to {out_dir}")


if __name__ == "__main__":
    main()
