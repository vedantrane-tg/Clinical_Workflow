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
from app.services.local_recorder import record_wav
from fastapi.responses import FileResponse

from app.models import Consultation, Patient, Encounter, TriageResult
from app.services.agents.scribe_agent import run_scribe_agent
from app.services.ids import next_consultation_id, next_encounter_id, utcnow, write_audit

from app.schemas import ConsultationOut, CdsRequest, EncounterOut
from app.services.agents.cds_orders_agent import run_cds_agent

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
        soap_note=None,
        encounter_status="Open",
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

@router.post("/consultations/{consultation_id}/scribe", response_model=ConsultationOut)
def scribe_consultation(consultation_id: str, db: Session = Depends(get_db)):
    row = db.get(Consultation, consultation_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Consultation {consultation_id} not found")

    result = run_scribe_agent(row.audio_path, existing_transcript=row.transcript)
    transcript = result["transcript"]
    soap = result["soap_note"]

    if not transcript:
        raise HTTPException(
            status_code=502,
            detail="Transcription failed. Check Deepgram/Gemini keys and audio file.",
        )

    row.transcript = transcript
    row.soap_note = soap
    row.key_points = soap.get("key_findings") or row.key_points
    row.status = "scribed"
    row.encounter_status = "In Progress"

    # Mark patient in consultation if linked
    if row.patient_id:
        patient = db.get(Patient, row.patient_id)
        if patient:
            patient.queue_status = "In Consultation"

        # Create or update Encounter with SOAP text
        encounter = db.scalar(
            select(Encounter).where(Encounter.consultation_id == row.consultation_id)
        )
        if encounter is None:
            latest_triage = db.scalar(
                select(TriageResult)
                .where(TriageResult.patient_id == row.patient_id)
                .order_by(TriageResult.created_at.desc())
            )
            doctor_id = patient.assigned_doctor_id if patient else "UNKNOWN"
            doctor_name = (
                latest_triage.recommended_doctor_name if latest_triage else "Unknown Doctor"
            )
            encounter = Encounter(
                encounter_id=next_encounter_id(db),
                patient_id=row.patient_id,
                consultation_id=row.consultation_id,
                triage_id=latest_triage.triage_id if latest_triage else None,
                doctor_id=doctor_id or "UNKNOWN",
                doctor_name=doctor_name or "Unknown Doctor",
                suggested_labs=[],
                suggested_medications=[],
                suggested_icd_codes=[],
                suggested_referrals=[],
                status="In Progress",
                created_at=utcnow(),
            )
            db.add(encounter)

        encounter.soap_subjective = soap.get("subjective")
        encounter.soap_objective = soap.get("objective")
        encounter.soap_assessment = soap.get("assessment")
        encounter.soap_plan = soap.get("plan")

    write_audit(
        db,
        user="Doctor",
        role="Doctor",
        action=f"Scribe agent generated SOAP for {consultation_id}",
        patient_id=row.patient_id,
        agent="Agent2-Scribe",
    )

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

@router.post("/consultations/record-local", response_model=ConsultationOut, status_code=201)
def record_local_consultation(
    patient_id: str | None = None,
    duration_sec: int = 10,
    db: Session = Depends(get_db),
):
    if patient_id:
        patient = db.get(Patient, patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")

    consultation_id = next_consultation_id(db)
    saved_name = f"{consultation_id}.wav"
    saved_path = UPLOAD_DIR / saved_name

    try:
        record_wav(str(saved_path), duration_sec=duration_sec)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Mic recording failed: {e}")

    # Transcribe and show in terminal
    transcript = transcribe_audio_file(str(saved_path))
    print("\n" + "=" * 50)
    print("CONSULTATION TRANSCRIPT")
    print("=" * 50)
    if transcript:
        print(transcript)
    else:
        print("[No transcript returned]")
    print("=" * 50 + "\n")
    
    row = Consultation(
        consultation_id=consultation_id,
        patient_id=patient_id,
        audio_filename=saved_name,
        audio_path=str(saved_path),
        status="transcribed" if transcript else "uploaded",
        transcript=transcript,
        key_points=None,
        pdf_path=None,
        created_at=utcnow(),
        soap_note=None,
        encounter_status="Open",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row

@router.post("/consultations/{consultation_id}/cds", response_model=EncounterOut)
def run_cds_for_consultation(
    consultation_id: str,
    body: CdsRequest = CdsRequest(),
    db: Session = Depends(get_db),
):
    row = db.get(Consultation, consultation_id)
    if not row:
        raise HTTPException(status_code=404, detail=f"Consultation {consultation_id} not found")
    if not row.soap_note:
        raise HTTPException(status_code=400, detail="SOAP note missing. Run /scribe first.")
    if not row.patient_id:
        raise HTTPException(status_code=400, detail="Consultation has no patient_id")

    patient = db.get(Patient, row.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail=f"Patient {row.patient_id} not found")

    encounter = db.scalar(
        select(Encounter).where(Encounter.consultation_id == consultation_id)
    )
    if not encounter:
        raise HTTPException(
            status_code=404,
            detail="Encounter not found. Run /scribe first so an encounter is created.",
        )

    cds = run_cds_agent(patient=patient, soap_note=row.soap_note)

    encounter.suggested_labs = cds.get("suggested_labs") or []
    encounter.suggested_medications = cds.get("suggested_medications") or []
    encounter.suggested_icd_codes = cds.get("suggested_icd_codes") or []
    encounter.suggested_referrals = cds.get("suggested_referrals") or []
    encounter.status = "Reviewed"

    write_audit(
        db,
        user=body.actor_name,
        role=body.actor_role,
        action=f"CDS agent ran for consultation {consultation_id}",
        patient_id=patient.patient_id,
        agent="Agent3-CDS",
    )

    db.commit()
    db.refresh(encounter)
    return encounter