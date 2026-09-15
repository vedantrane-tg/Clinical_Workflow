"""Generate ClinicalFlow AI Project Plan Word document for management review."""

from datetime import date, timedelta
from pathlib import Path

from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

OUT = Path(__file__).resolve().parent / "ClinicalFlow_AI_Project_Plan.docx"

# Anchor: plan last updated 2026-09-10; progress as of 2026-09-11
START = date(2026, 9, 10)
TODAY = date(2026, 9, 11)


def d(offset: int) -> str:
    return (START + timedelta(days=offset)).strftime("%d %b %Y")


def set_cell_shading(cell, hex_color: str) -> None:
    shading = OxmlElement("w:shd")
    shading.set(qn("w:fill"), hex_color)
    shading.set(qn("w:val"), "clear")
    cell._tePr = cell._tc.get_or_add_tcPr()
    cell._tc.get_or_add_tcPr().append(shading)


def style_header_row(row, fill="1F4E79") -> None:
    for cell in row.cells:
        set_cell_shading(cell, fill)
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for run in p.runs:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
                run.font.size = Pt(10)


def add_table(doc, headers, rows, col_widths=None):
    table = doc.add_table(rows=1 + len(rows), cols=len(headers))
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    hdr = table.rows[0]
    for i, h in enumerate(headers):
        hdr.cells[i].text = h
    style_header_row(hdr)
    for r_idx, row_data in enumerate(rows):
        row = table.rows[r_idx + 1]
        for c_idx, val in enumerate(row_data):
            row.cells[c_idx].text = str(val)
            for p in row.cells[c_idx].paragraphs:
                for run in p.runs:
                    run.font.size = Pt(9)
        # Light status tint on last status-like columns
        status = str(row_data[-1]).lower() if row_data else ""
        if "complete" in status or "done" in status or "✅" in status:
            set_cell_shading(row.cells[-1], "C6EFCE")
        elif "progress" in status or "🔄" in status:
            set_cell_shading(row.cells[-1], "FFEB9C")
        elif "not started" in status or "planned" in status or "future" in status or "⏳" in status:
            set_cell_shading(row.cells[-1], "FCE4D6")
    if col_widths:
        for row in table.rows:
            for i, w in enumerate(col_widths):
                row.cells[i].width = Inches(w)
    doc.add_paragraph()
    return table


def heading(doc, text, level=1):
    doc.add_heading(text, level=level)


def para(doc, text, bold=False):
    p = doc.add_paragraph()
    run = p.add_run(text)
    run.bold = bold
    run.font.size = Pt(11)
    return p


def bullet(doc, text, level=0):
    p = doc.add_paragraph(text, style="List Bullet")
    p.paragraph_format.left_indent = Inches(0.25 * level)
    for run in p.runs:
        run.font.size = Pt(10)


def build():
    doc = Document()

    # ---- Cover / Title ----
    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = title.add_run("ClinicalFlow AI")
    r.bold = True
    r.font.size = Pt(28)
    r.font.color.rgb = RGBColor(31, 78, 121)

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = subtitle.add_run("Complete Project Plan — Management Review")
    r.font.size = Pt(16)
    r.font.color.rgb = RGBColor(68, 84, 106)

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = meta.add_run(
        f"Document Version: 2.1  |  Prepared: {TODAY.strftime('%d %b %Y')}\n"
        f"Project Start: {START.strftime('%d %b %Y')}  |  Planned End: {d(21)}\n"
        "Stack: FastAPI · SQLAlchemy · React 19 · Gemini · Deepgram"
    )
    r.font.size = Pt(10)

    para(
        doc,
        "Purpose: This document presents the full chronological delivery plan for ClinicalFlow AI — "
        "modules, sub-modules, features, status, AI agent allocation, and a future Admin module — "
        "for management visibility and tracking.",
    )

    # ---- 1. Executive Summary ----
    heading(doc, "1. Executive Summary", 1)
    para(
        doc,
        "ClinicalFlow AI is a full-stack clinical workflow platform that mirrors a real hospital journey: "
        "walk-in registration (Receptionist) → doctor consultation (Doctor) → clinical orders & sign-off, "
        "augmented by three AI agents for triage, medical scribing, and clinical decision support.",
    )
    bullet(doc, "Current overall status: Phase 0 & Phase 1 complete (backend). Phase 2 (Scribe) in progress.")
    bullet(doc, "Roles live today: Receptionist, Doctor. Future role: Admin (manage doctors & master data).")
    bullet(doc, "Planned delivery window: 22 working days from project start, plus Admin as Phase 7 (post-MVP).")

    add_table(
        doc,
        ["Metric", "Value"],
        [
            ["Project name", "ClinicalFlow AI"],
            ["Document date", TODAY.strftime("%d %b %Y")],
            ["Planned start", START.strftime("%d %b %Y")],
            ["Planned MVP end (Phase 0–6)", d(21)],
            ["Admin module (future)", f"{d(22)} – {d(28)} (post-MVP)"],
            ["Backend progress", "Phase 0 ✅ · Phase 1 ✅ · Phase 2 🔄"],
            ["Frontend role flows", "Planned / Not started"],
            ["AI agents", "3 agents (Triage Done · Scribe In Progress · CDS Planned)"],
        ],
        col_widths=[2.2, 4.5],
    )

    # ---- 2. Roles ----
    heading(doc, "2. User Roles (RBAC)", 1)
    add_table(
        doc,
        ["Role", "Primary Responsibilities", "Status"],
        [
            [
                "Receptionist",
                "Register patients, chief complaint, trigger triage, payment, waiting queue",
                "Backend Done",
            ],
            [
                "Doctor",
                "View queue, pre-visit brief, record consult, SOAP review, CDS review, finalize",
                "In Progress",
            ],
            [
                "Admin (Future)",
                "Add/edit doctors & specialties, manage users, clinic master data, configuration",
                "Planned (Phase 7)",
            ],
        ],
        col_widths=[1.4, 4.0, 1.4],
    )

    # ---- 3. AI Agents ----
    heading(doc, "3. AI Agents — Features & Module Allocation", 1)
    para(
        doc,
        "Agents are allotted chronologically to the patient journey modules. Each agent belongs to a "
        "specific phase and must not be started out of order relative to the clinical workflow.",
    )

    heading(doc, "3.1 Agent Summary", 2)
    add_table(
        doc,
        ["Agent", "Name", "Phase / Module", "Dates", "Inputs", "Outputs", "Status"],
        [
            [
                "Agent 1",
                "Smart Triage & Doctor Routing",
                "Phase 1 — Receptionist Intake & Triage",
                f"{d(2)} – {d(4)}",
                "Patient EHR + chief complaint (+ optional vitals)",
                "Specialty, doctor, acuity, risk, pre-visit brief",
                "Complete ✅",
            ],
            [
                "Agent 2",
                "Ambient Medical Scribe",
                "Phase 2 — Doctor Consultation & Scribing",
                f"{d(7)} – {d(10)}",
                "Consultation audio recording",
                "Verbatim transcript + structured SOAP note",
                "In Progress 🔄",
            ],
            [
                "Agent 3",
                "Clinical Orders & CDS",
                "Phase 3 — CDS & Sign-off",
                f"{d(11)} – {d(13)}",
                "SOAP note + patient profile",
                "Labs, meds, ICD-10, referrals, warnings",
                "Not Started ⏳",
            ],
        ],
        col_widths=[0.7, 1.3, 1.5, 1.0, 1.2, 1.2, 0.9],
    )

    heading(doc, "3.2 Agent 1 — Smart Triage (Module: Receptionist Triage)", 2)
    bullet(doc, "File: backend/app/services/agents/triage_agent.py")
    bullet(doc, "Triggered by: POST /patients/{id}/checkin")
    bullet(doc, "Features: recommended specialty; acuity (Routine / Urgent / Emergency); risk level; pre-visit brief; confidence score")
    bullet(doc, "Doctor assignment: least-loaded available specialist matching specialty")
    bullet(doc, "Fallback: rules-based triage when Gemini API unavailable")
    bullet(doc, "Status: Complete (backend verified)")

    heading(doc, "3.3 Agent 2 — Ambient Scribe (Module: Doctor Consultation)", 2)
    bullet(doc, "File: backend/app/services/agents/scribe_agent.py")
    bullet(doc, "Triggered by: POST /consultations/{id}/scribe")
    bullet(doc, "Features: Deepgram Nova-2 transcription (Gemini fallback); SOAP Subjective / Objective / Assessment / Plan; key findings")
    bullet(doc, "UI: Consultation Room + browser audio recorder / upload")
    bullet(doc, "Status: In Progress")

    heading(doc, "3.4 Agent 3 — CDS Orders (Module: Clinical Orders & Sign-off)", 2)
    bullet(doc, "File: backend/app/services/agents/cds_orders_agent.py")
    bullet(doc, "Triggered by: POST /consultations/{id}/cds; finalized via POST /encounters/{id}/finalize")
    bullet(doc, "Features: lab/imaging suggestions; medications with dose/route; ICD-10 codes; referrals; drug-interaction warnings; follow-up")
    bullet(doc, "Doctor must approve/reject suggestions before sign-off (human-in-the-loop)")
    bullet(doc, "Status: Not Started")

    # ---- 4. Chronological Master Plan ----
    heading(doc, "4. Chronological Master Plan (Modules → Sub-modules → Features → Status)", 1)
    para(
        doc,
        "Modules are ordered by delivery sequence. Dates assume continuous delivery from project start "
        f"({START.strftime('%d %b %Y')}). Status reflects codebase progress as of {TODAY.strftime('%d %b %Y')}.",
    )

    heading(doc, "4.1 Sprint / Phase Timeline Overview", 2)
    add_table(
        doc,
        ["Sprint", "Dates", "Phase / Module", "Key Deliverables", "Status"],
        [
            ["Sprint 0", f"{d(0)} – {d(1)}", "Phase 0 — Foundation", "Config, JWT auth, models, seed users, RBAC prep", "Complete ✅"],
            ["Sprint 1", f"{d(2)} – {d(4)}", "Phase 1 — Intake & Triage", "Patient API, Agent 1, triage UI plan", "Backend Complete ✅"],
            ["Sprint 2", f"{d(5)} – {d(6)}", "Phase 1 — Payment & Queue", "Mock payment, queue APIs, receptionist dashboard", "Backend Complete ✅"],
            ["Sprint 3", f"{d(7)} – {d(10)}", "Phase 2 — Consultation", "Audio recorder, Agent 2 SOAP, consult room", "In Progress 🔄"],
            ["Sprint 4", f"{d(11)} – {d(13)}", "Phase 3 — CDS & Sign-off", "Agent 3, orders UI, encounter finalize", "Not Started ⏳"],
            ["Sprint 5", f"{d(14)} – {d(15)}", "Phase 4 — Audit & Polish", "Audit coverage, UX polish, error handling", "Not Started ⏳"],
            ["Sprint 6", f"{d(16)} – {d(18)}", "Phase 5 — Testing & QA", "Unit/component tests, E2E smoke checklist", "Not Started ⏳"],
            ["Sprint 7", f"{d(19)} – {d(21)}", "Phase 6 — Deployment", "Postgres, Docker, CI/CD, auth hardening", "Not Started ⏳"],
            ["Sprint 8", f"{d(22)} – {d(28)}", "Phase 7 — Admin (Future)", "Admin role, doctor CRUD, master data", "Planned (Future) ⏳"],
        ],
        col_widths=[0.9, 1.4, 1.6, 2.2, 1.2],
    )

    # ---- Phase 0 detail ----
    heading(doc, "4.2 Phase 0 — Foundation & Infrastructure", 2)
    para(doc, f"Dates: {d(0)} – {d(1)}  |  Status: Complete ✅", bold=True)
    add_table(
        doc,
        ["Sub-module", "Features", "Owner Area", "Status"],
        [
            ["Config cleanup", "Single Settings class (Gemini, Deepgram, JWT)", "Backend", "Complete"],
            ["User model & auth", "Signup, login, /me; bcrypt + JWT", "Backend", "Complete"],
            ["Seed users", "Demo Receptionist & Doctor accounts", "Backend", "Complete"],
            ["Schema additions", "Patient queue fields; TriageResult, Encounter, Payment models", "Backend", "Complete"],
            ["ID helpers", "USR-, TRI-, ENC-, PAY-, PAT- generators", "Backend", "Complete"],
            ["Role-based sidebar", "Receptionist vs Doctor navigation", "Frontend", "Planned"],
            ["Login / Signup pages", "Auth guard, logout, session hydrate", "Frontend", "Planned"],
        ],
        col_widths=[1.8, 2.8, 1.0, 1.2],
    )

    # ---- Phase 1 ----
    heading(doc, "4.3 Phase 1 — Receptionist Experience (Intake & Triage)", 2)
    para(doc, f"Dates: {d(2)} – {d(6)}  |  Status: Backend Complete ✅  |  Agent: Agent 1 (allotted)", bold=True)
    add_table(
        doc,
        ["Sub-module", "Features / APIs", "Agent Link", "Status"],
        [
            ["Patient registration", "POST /patients — demographics, contact, insurance, history", "—", "Complete"],
            ["Check-in & triage", "POST /patients/{id}/checkin — chief complaint, vitals", "Agent 1", "Complete"],
            ["Smart Triage agent", "Specialty, doctor routing, acuity, pre-visit brief", "Agent 1", "Complete"],
            ["Payment (mock)", "POST /payments — Cash/Card/UPI/Insurance", "—", "Complete"],
            ["Queue management", "GET /queue, GET /queue/all", "Uses Agent 1 assignment", "Complete"],
            ["New Patient UI", "/receptionist/new-patient form", "—", "Planned"],
            ["Triage Station UI", "/receptionist/triage/:id result panel", "Agent 1", "Planned"],
            ["Checkout UI", "/receptionist/checkout/:id receipt + queue confirm", "—", "Planned"],
            ["Receptionist dashboard", "KPIs, live waiting queue, + New Patient", "—", "Planned"],
        ],
        col_widths=[1.6, 2.8, 1.4, 1.0],
    )

    # ---- Phase 2 ----
    heading(doc, "4.4 Phase 2 — Doctor Experience (Consultation & Scribing)", 2)
    para(doc, f"Dates: {d(7)} – {d(10)}  |  Status: In Progress 🔄  |  Agent: Agent 2 (allotted)", bold=True)
    add_table(
        doc,
        ["Sub-module", "Features / APIs", "Agent Link", "Status"],
        [
            ["Doctor queue dashboard", "My Queue by position, acuity, Start Consultation", "Uses Agent 1 brief", "Planned"],
            ["Consultation room", "3-panel UI: brief + recorder + SOAP", "Agent 1 + Agent 2", "Planned"],
            ["Audio recorder", "Web Audio / MediaRecorder; upload .webm/.wav", "Feeds Agent 2", "Planned"],
            ["Upload / transcribe", "Existing consultation upload & Deepgram path", "Agent 2 Step A", "Existing"],
            ["Scribe agent + SOAP", "POST /consultations/{id}/scribe — SOAP JSON", "Agent 2", "In Progress"],
            ["Encounter SOAP fields", "Persist SOAP on Consultation / Encounter", "Agent 2", "In Progress"],
        ],
        col_widths=[1.6, 2.8, 1.4, 1.0],
    )

    # ---- Phase 3 ----
    heading(doc, "4.5 Phase 3 — Clinical Decision Support & Sign-off", 2)
    para(doc, f"Dates: {d(11)} – {d(13)}  |  Status: Not Started ⏳  |  Agent: Agent 3 (allotted)", bold=True)
    add_table(
        doc,
        ["Sub-module", "Features / APIs", "Agent Link", "Status"],
        [
            ["CDS Orders agent", "Labs, meds, ICD-10, referrals, warnings", "Agent 3", "Not Started"],
            ["CDS API", "POST /consultations/{id}/cds", "Agent 3", "Not Started"],
            ["Encounter finalize", "POST /encounters/{id}/finalize — approved items + referrals", "Uses Agent 3 output", "Not Started"],
            ["Clinical Orders UI", "/doctor/review/:id checkboxes + Sign & Finalize", "Agent 3", "Not Started"],
        ],
        col_widths=[1.6, 2.8, 1.4, 1.0],
    )

    # ---- Phase 4–6 ----
    heading(doc, "4.6 Phase 4 — Audit, Compliance & Polish", 2)
    para(doc, f"Dates: {d(14)} – {d(15)}  |  Status: Not Started ⏳", bold=True)
    add_table(
        doc,
        ["Sub-module", "Features", "Status"],
        [
            ["Comprehensive audit logging", "Register, triage, payment, queue, consult, scribe, CDS, finalize", "Not Started"],
            ["Frontend polish", "Skeletons, toasts, transitions, mobile sidebar, acuity color coding", "Not Started"],
            ["Error / edge cases", "No API key fallbacks, empty transcript, queue races, retries", "Not Started"],
        ],
        col_widths=[2.0, 3.5, 1.2],
    )

    heading(doc, "4.7 Phase 5 — Testing & Quality Assurance", 2)
    para(doc, f"Dates: {d(16)} – {d(18)}  |  Status: Not Started ⏳", bold=True)
    add_table(
        doc,
        ["Sub-module", "Features", "Status"],
        [
            ["Backend unit tests", "patients, triage, scribe, CDS, payments, encounters, audit (mocked AI)", "Not Started"],
            ["Frontend component tests", "AudioRecorder, registration, triage, clinical orders", "Not Started"],
            ["E2E smoke checklist", "Full receptionist → doctor → finalize manual path", "Not Started"],
        ],
        col_widths=[2.0, 3.5, 1.2],
    )

    heading(doc, "4.8 Phase 6 — Deployment & Production Readiness", 2)
    para(doc, f"Dates: {d(19)} – {d(21)}  |  Status: Not Started ⏳", bold=True)
    add_table(
        doc,
        ["Sub-module", "Features", "Status"],
        [
            ["DB migration", "SQLite → PostgreSQL via Alembic", "Not Started"],
            ["Auth hardening", "httpOnly cookies, refresh tokens, rate limit, password strength", "Not Started"],
            ["Dockerization", "Backend/frontend Dockerfiles + docker-compose", "Not Started"],
            ["CI/CD", "GitHub Actions — pytest + frontend build", "Not Started"],
        ],
        col_widths=[2.0, 3.5, 1.2],
    )

    # ---- Phase 7 Admin ----
    heading(doc, "4.9 Phase 7 — Admin Module (Future Roadmap)", 2)
    para(doc, f"Dates: {d(22)} – {d(28)} (post-MVP)  |  Status: Planned (Future) ⏳", bold=True)
    para(
        doc,
        "After MVP (Receptionist + Doctor + 3 agents), introduce an Admin role so clinic managers can "
        "maintain doctors and operational master data without code or DB changes.",
    )

    heading(doc, "Admin — Sub-modules & Features", 3)
    add_table(
        doc,
        ["Sub-module", "Features", "Priority", "Status"],
        [
            ["Admin authentication", "Role = Admin; JWT; protect /admin/* routes", "P0", "Future"],
            ["Doctor management", "Add / edit / deactivate doctors; specialty; availability; contact", "P0", "Future"],
            ["Specialty master", "CRUD specialties used by Agent 1 routing", "P0", "Future"],
            ["User management", "Create Receptionist/Doctor accounts; reset password; activate/deactivate", "P0", "Future"],
            ["Clinic / facility info", "Clinic name, address, hours, default consultation fee", "P1", "Future"],
            ["Fee configuration", "Configure consultation / follow-up / lab fee amounts for payment module", "P1", "Future"],
            ["Referral rules admin", "Manage condition → specialist routing rules (supports triage fallback)", "P1", "Future"],
            ["Audit & reports view", "Admin-wide audit trail; daily registrations / revenue summary", "P2", "Future"],
            ["System settings", "Feature flags (AI on/off), API key status indicators (non-secret)", "P2", "Future"],
        ],
        col_widths=[1.6, 3.2, 0.8, 1.0],
    )

    heading(doc, "Admin — Suggested APIs (Future)", 3)
    bullet(doc, "POST /admin/doctors — create doctor (maps to specialists / users)")
    bullet(doc, "PUT /admin/doctors/{id} — update specialty, availability, load")
    bullet(doc, "GET /admin/doctors — list all doctors")
    bullet(doc, "POST /admin/users — create Receptionist/Doctor/Admin accounts")
    bullet(doc, "PUT /admin/settings/fees — consultation fee used by payment checkout")
    bullet(doc, "CRUD /admin/specialties and /admin/referral-rules")

    heading(doc, "Admin — UI Pages (Future)", 3)
    bullet(doc, "/admin/dashboard — clinic KPIs")
    bullet(doc, "/admin/doctors — add/edit doctors (primary request from management)")
    bullet(doc, "/admin/users — staff accounts")
    bullet(doc, "/admin/specialties & /admin/rules — master data for Agent 1")
    bullet(doc, "/admin/settings — fees, facility info")

    # ---- 5. End-to-end flow ----
    heading(doc, "5. End-to-End Workflow (Chronological Module Order)", 1)
    para(doc, "Patient journey with agents mapped at the correct step:", bold=True)
    steps = [
        f"1. [Admin Future] Maintain doctors & specialties — enables correct Agent 1 routing",
        f"2. Receptionist registers patient — Phase 1 ({d(2)}+)",
        f"3. Receptionist check-in + Agent 1 Triage — Phase 1 ({d(2)}–{d(4)}) ✅",
        f"4. Receptionist processes payment — Phase 1 ({d(5)}–{d(6)}) ✅",
        f"5. Patient enters doctor queue — Phase 1 ✅",
        f"6. Doctor starts consult; reviews Agent 1 pre-visit brief — Phase 2 ({d(7)}+)",
        f"7. Record/upload audio → Agent 2 Scribe (transcript + SOAP) — Phase 2 🔄",
        f"8. Agent 3 CDS suggestions (labs/meds/ICD/referrals) — Phase 3 ({d(11)}+)",
        f"9. Doctor reviews, approves, Sign & Finalize encounter — Phase 3",
        f"10. Audit trail for all actions — Phase 4",
    ]
    for s in steps:
        bullet(doc, s)

    # ---- 6. Working flow today ----
    heading(doc, "6. What Works Today (Verified Backend)", 1)
    add_table(
        doc,
        ["Order", "Capability", "Endpoint / Note", "Status"],
        [
            ["1", "Auth login / me", "POST /auth/login, GET /auth/me", "Working"],
            ["2", "Register patient", "POST /patients", "Working"],
            ["3", "Check-in + Agent 1", "POST /patients/{id}/checkin", "Working"],
            ["4", "Mock payment", "POST /payments", "Working"],
            ["5", "View queues", "GET /queue, GET /queue/all", "Working"],
            ["6", "Scribe (SOAP)", "POST /consultations/{id}/scribe", "In Progress"],
            ["7", "CDS + finalize", "CDS / encounters endpoints", "Not Started"],
        ],
        col_widths=[0.7, 1.8, 2.8, 1.2],
    )

    para(doc, "Demo accounts:", bold=True)
    add_table(
        doc,
        ["Email", "Password", "Role"],
        [
            ["ananya@clinicalflow.demo", "receptionist123", "Receptionist"],
            ["neha@clinicalflow.demo", "doctor123", "Doctor"],
        ],
        col_widths=[2.8, 2.0, 1.5],
    )

    # ---- 7. Tech stack ----
    heading(doc, "7. Technology Stack", 1)
    add_table(
        doc,
        ["Layer", "Technology"],
        [
            ["Backend", "FastAPI (Python 3.13), SQLAlchemy, SQLite → PostgreSQL"],
            ["Frontend", "Vite, React 19, TanStack Router, Tailwind CSS 4, Radix/shadcn"],
            ["AI — Triage & CDS", "Google Gemini API (gemini-2.5-flash)"],
            ["AI — Transcription", "Deepgram Nova-2 (Gemini fallback)"],
            ["Auth", "JWT (python-jose), passlib/bcrypt"],
            ["Deploy (planned)", "Docker, docker-compose, GitHub Actions CI"],
        ],
        col_widths=[2.0, 4.5],
    )

    # ---- 8. Risks ----
    heading(doc, "8. Risk Register", 1)
    add_table(
        doc,
        ["Risk", "Impact", "Mitigation"],
        [
            ["Gemini rate limits / quota", "Agents fail", "Rules-based fallback for every agent"],
            ["Deepgram key invalid", "No transcription", "Gemini fallback transcription"],
            ["SQLite locking under load", "Write failures", "Move to PostgreSQL in Phase 6"],
            ["Large audio uploads", "Timeouts", "Max file size + chunked upload later"],
            ["SOAP quality vs audio quality", "Unreliable notes", "Disclaimer: AI-generated — doctor must review"],
            ["Admin delayed", "Manual doctor seed only", "Keep seed specialists until Phase 7"],
        ],
        col_widths=[2.2, 1.5, 3.0],
    )

    # ---- 9. Success criteria ----
    heading(doc, "9. Success Criteria for Management Sign-off", 1)
    bullet(doc, "Receptionist can register → triage (Agent 1) → pay → queue without errors.")
    bullet(doc, "Doctor can open queue → consult → Agent 2 SOAP → Agent 3 CDS → finalize.")
    bullet(doc, "All critical actions appear in audit trail.")
    bullet(doc, "Agents degrade gracefully when AI keys are missing.")
    bullet(doc, "MVP deployable via Docker with PostgreSQL (Phase 6).")
    bullet(doc, "Future: Admin can add doctors/specialties without developer intervention (Phase 7).")

    # ---- 10. Ask ----
    heading(doc, "10. Management Ask / Next Steps", 1)
    bullet(doc, "Approve chronological module order and agent allotment as stated in this plan.")
    bullet(doc, "Confirm inclusion of Admin module as Phase 7 (post-MVP), with doctor CRUD as P0.")
    bullet(doc, "Continue Phase 2 (Scribe) completion, then Phase 3 (CDS), then frontend role UIs.")
    bullet(doc, "Align any date shifts if team capacity or AI API access changes.")

    footer = doc.add_paragraph()
    footer.add_run(
        f"\n— End of Document —\nClinicalFlow AI Project Plan v2.1 · Generated {TODAY.strftime('%d %b %Y')} · "
        "Source: Project_Plan.md + BACKEND_PROGRESS.md"
    ).font.size = Pt(9)

    doc.save(OUT)
    print(f"Wrote: {OUT}")


if __name__ == "__main__":
    build()
