from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


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