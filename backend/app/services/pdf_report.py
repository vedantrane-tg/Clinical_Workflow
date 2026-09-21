from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

HOSPITAL_NAME = "teleGlobal Clinic"
LOGO_CANDIDATES = [
    Path(__file__).resolve().parents[2] / "assets" / "tele-logo.png",
    Path(__file__).resolve().parents[2] / "assets" / "teleglobals_logo.jpg",
    Path(__file__).resolve().parents[3] / "frontend" / "public" / "tele-logo.webp",
]


def _resolve_logo_path() -> Path | None:
    for candidate in LOGO_CANDIDATES:
        if candidate.is_file():
            return candidate
    return None


def build_consultation_pdf(
    *,
    output_path: str,
    consultation_id: str,
    patient_id: str | None,
    transcript: str,
    key_points: list[str],
) -> str:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(str(path), pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("Consultation Visit Note", styles["Title"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"<b>Consultation ID:</b> {consultation_id}", styles["Normal"]))
    story.append(Paragraph(f"<b>Patient ID:</b> {patient_id or 'N/A'}", styles["Normal"]))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Transcript", styles["Heading2"]))
    story.append(Paragraph(transcript.replace("\n", "<br/>"), styles["Normal"]))
    story.append(Spacer(1, 16))

    story.append(Paragraph("Key Points for Doctor", styles["Heading2"]))
    for i, point in enumerate(key_points, start=1):
        story.append(Paragraph(f"{i}. {point}", styles["Normal"]))
        story.append(Spacer(1, 6))

    story.append(Spacer(1, 20))
    story.append(
        Paragraph(
            "<i>Decision support only. Clinician must verify all information.</i>",
            styles["Normal"],
        )
    )

    doc.build(story)
    return str(path)


def _clinic_header(styles) -> list:
    clinic_name = ParagraphStyle(
        "ClinicName",
        parent=styles["Heading1"],
        fontSize=18,
        textColor=colors.HexColor("#0f2f5b"),
        spaceAfter=2,
        leading=22,
    )
    clinic_sub = ParagraphStyle(
        "ClinicSub",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#555555"),
        leading=12,
    )

    logo_path = _resolve_logo_path()
    name_block = [
        Paragraph(HOSPITAL_NAME, clinic_name),
        Paragraph("Clinical care · Prescription", clinic_sub),
    ]

    if logo_path is not None:
        # Wide brand mark — keep aspect ratio, cap height
        logo = Image(str(logo_path), width=48 * mm, height=13.5 * mm)
        header = Table(
            [[logo, name_block]],
            colWidths=[52 * mm, 128 * mm],
        )
        header.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 0),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ]
            )
        )
        return [header, Spacer(1, 8)]

    return [*name_block, Spacer(1, 8)]


def build_prescription_pdf(
    *,
    output_path: str,
    encounter_id: str,
    patient_id: str,
    patient_name: str,
    doctor_name: str,
    items: list[dict],
) -> str:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "RxTitle",
        parent=styles["Heading2"],
        fontSize=13,
        spaceBefore=4,
        spaceAfter=8,
        textColor=colors.HexColor("#222222"),
    )
    cell = ParagraphStyle(
        "RxCell",
        parent=styles["Normal"],
        fontSize=9,
        leading=12,
    )
    small = ParagraphStyle(
        "RxSmall",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#555555"),
        leading=10,
    )

    story: list = [*_clinic_header(styles)]
    rule = Table([[""]], colWidths=[180 * mm], rowHeights=[1.2])
    rule.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0f2f5b")),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(rule)
    story.append(Spacer(1, 10))
    story.append(Paragraph("Prescription (Rx)", title))
    story.append(Paragraph(f"<b>Patient:</b> {patient_name} ({patient_id})", styles["Normal"]))
    story.append(Paragraph(f"<b>Doctor:</b> {doctor_name}", styles["Normal"]))
    story.append(Paragraph(f"<b>Encounter:</b> {encounter_id}", styles["Normal"]))
    story.append(Spacer(1, 14))

    header = [
        Paragraph("<b>Drug Name</b>", cell),
        Paragraph("<b>Strength</b>", cell),
        Paragraph("<b>Frequency</b>", cell),
        Paragraph("<b>Instructions</b>", cell),
    ]
    data = [header]

    for index, item in enumerate(items, start=1):
        label = item.get("drug_label") or f"{item.get('drug_form', '')} {item.get('drug_name', '')}".strip()
        strength = item.get("strength") or ""
        morning = item.get("morning", 0)
        afternoon = item.get("afternoon", 0)
        night = item.get("night", 0)
        freq = Paragraph(
            f"{morning} - {afternoon} - {night}<br/>"
            f"<font size='7'>Morning&nbsp;&nbsp;Afternoon&nbsp;&nbsp;Night</font>",
            cell,
        )
        instructions = (item.get("instructions_text") or "").replace("\n", "<br/>")
        data.append(
            [
                Paragraph(f"{index}. {label}", cell),
                Paragraph(strength or "—", cell),
                freq,
                Paragraph(instructions or "—", cell),
            ]
        )

    table = Table(data, colWidths=[65 * mm, 28 * mm, 42 * mm, 45 * mm], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#5b5b5b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bbbbbb")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f7f7")]),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 18))
    story.append(
        Paragraph(
            f"<i>{HOSPITAL_NAME} — for clinical decision support / demonstration only. "
            "Verify all medicines before dispensing.</i>",
            small,
        )
    )

    doc.build(story)
    return str(path)
