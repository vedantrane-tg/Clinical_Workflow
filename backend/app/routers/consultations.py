from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Consultation, Patient
from app.schemas import ConsultationOut
from app.services.ids import next_consultation_id, utcnow
from app.services.transcription import transcribe_audio_file

from pathlib import Path
from app.services.consultation_ai import generate_key_points
from app.services.pdf_report import build_consultation_pdf

from fastapi.responses import FileResponse

router = APIRouter(tags=["consultations"])

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "audio"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

PDF_DIR = Path(__file__).resolve().parents[2] / "uploads" / "pdfs"
PDF_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXT = {".wav", ".mp3", ".m4a", ".webm", ".ogg"}


@router.post("/consultations/upload", response_model=ConsultationOut, status_code=201)
async def upload_consultation(
    patient_id: str | None = Form(default=None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if patient_id:
        patient = db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")

    original = file.filename or "audio.wav"
    ext = Path(original).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type {ext}. Allowed: {sorted(ALLOWED_EXT)}",
        )

    consultation_id = next_consultation_id(db)
    saved_name = f"{consultation_id}{ext}"
    saved_path = UPLOAD_DIR / saved_name

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file")

    saved_path.write_bytes(content)

    row = Consultation(
        consultation_id=consultation_id,
        patient_id=patient_id,
        audio_filename=original,
        audio_path=str(saved_path),
        status="uploaded",
        transcript=None,
        key_points=None,
        pdf_path=None,
        created_at=utcnow(),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/consultations", response_model=list[ConsultationOut])
def list_consultations(db: Session = Depends(get_db)):
    return list(db.scalars(select(Consultation).order_by(Consultation.created_at.desc())).all())


@router.get("/consultations/{consultation_id}", response_model=ConsultationOut)
def get_consultation(consultation_id: str, db: Session = Depends(get_db)):
    row = db.get(Consultation, consultation_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Consultation {consultation_id} not found")
    return row


@router.post("/consultations/{consultation_id}/transcribe", response_model=ConsultationOut)
def transcribe_consultation(consultation_id: str, db: Session = Depends(get_db)):
    row = db.get(Consultation, consultation_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Consultation {consultation_id} not found")

    transcript = transcribe_audio_file(row.audio_path)
    if not transcript:
        raise HTTPException(
            status_code=502,
            detail="Transcription failed. Check API key / audio file / server logs.",
        )

    row.transcript = transcript
    row.status = "transcribed"
    db.commit()
    db.refresh(row)
    return row

@router.post("/consultations/{consultation_id}/process", response_model=ConsultationOut)
def process_consultation(consultation_id: str, db: Session = Depends(get_db)):
    row = db.get(Consultation, consultation_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Consultation {consultation_id} not found")
    if not row.transcript:
        raise HTTPException(
            status_code=400,
            detail="Transcript missing. Run /transcribe first.",
        )

    key_points = generate_key_points(row.transcript)
    if not key_points:
        raise HTTPException(status_code=502, detail="Failed to generate key points")

    pdf_path = PDF_DIR / f"{consultation_id}.pdf"
    build_consultation_pdf(
        output_path=str(pdf_path),
        consultation_id=row.consultation_id,
        patient_id=row.patient_id,
        transcript=row.transcript,
        key_points=key_points,
    )

    row.key_points = key_points
    row.pdf_path = str(pdf_path)
    row.status = "processed"
    db.commit()
    db.refresh(row)
    return row

@router.get("/consultations/{consultation_id}/pdf")
def download_consultation_pdf(consultation_id: str, db: Session = Depends(get_db)):
    row = db.get(Consultation, consultation_id)
    if not row or not row.pdf_path:
        raise HTTPException(status_code=404, detail="PDF not found. Run /process first.")
    return FileResponse(
        path=row.pdf_path,
        media_type="application/pdf",
        filename=f"{consultation_id}.pdf",
    )
