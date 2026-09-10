# 🏥 ClinicalFlow AI — Production Project Plan

> **Version:** 2.0  
> **Last Updated:** 2026-09-10  
> **Stack:** FastAPI (Python 3.13) · SQLAlchemy · SQLite → PostgreSQL · Vite · React 19 · TanStack Router · Tailwind CSS 4 · Radix/shadcn UI  
> **AI Services:** Google Gemini API · Deepgram Nova-2  

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Current Codebase Audit](#2-current-codebase-audit)
3. [Target Architecture](#3-target-architecture)
4. [Environment & Tooling Setup](#4-environment--tooling-setup)
5. [Phase 0 — Foundation & Infrastructure](#5-phase-0--foundation--infrastructure)
6. [Phase 1 — Receptionist Experience (Intake & Triage)](#6-phase-1--receptionist-experience-intake--triage)
7. [Phase 2 — Doctor Experience (Consultation & Scribing)](#7-phase-2--doctor-experience-consultation--scribing)
8. [Phase 3 — Clinical Decision Support & Sign-off](#8-phase-3--clinical-decision-support--sign-off)
9. [Phase 4 — Audit, Compliance & Polish](#9-phase-4--audit-compliance--polish)
10. [Phase 5 — Testing & Quality Assurance](#10-phase-5--testing--quality-assurance)
11. [Phase 6 — Deployment & Production Readiness](#11-phase-6--deployment--production-readiness)
12. [Sprint Timeline](#12-sprint-timeline)
13. [Risk Register](#13-risk-register)
14. [Appendix — File Tree Target State](#14-appendix--file-tree-target-state)

---

## 1. Project Overview

### What We're Building

A **full-stack clinical workflow platform** that simulates the real-world journey of a patient through a hospital — from walk-in registration (Receptionist) through doctor consultation (Doctor) to encounter finalization — augmented by **3 AI agents** that automate chart preparation, medical transcription, and clinical decision support.

### The 3 AI Agents

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1 (Receptionist Intake)                                   │
│                                                                 │
│  Agent 1: Smart Triage & Doctor Routing                         │
│  Input:  Patient EHR History + Chief Complaint                  │
│  Output: Recommended Specialty/Doctor + Triage Acuity Level     │
│          + Pre-Visit Clinical Brief for Doctor                  │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2 (Doctor Consultation)                                   │
│                                                                 │
│  Agent 2: Ambient Medical Scribe                                │
│  Input:  Audio recording of doctor-patient conversation         │
│  Output: Verbatim transcript + Structured SOAP Note             │
│          (Subjective, Objective, Assessment, Plan)              │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3 (Post-Consultation)                                     │
│                                                                 │
│  Agent 3: Clinical Orders & CDS (Clinical Decision Support)     │
│  Input:  SOAP Note + Patient Profile                            │
│  Output: Lab/Imaging Orders + Medication/Dosage Suggestions     │
│          + ICD-10 Diagnostic Codes + Follow-up Referrals        │
└─────────────────────────────────────────────────────────────────┘
```

### Two RBAC Roles

| Role | Primary Actions |
|:---|:---|
| **Receptionist** | Register patients, record chief complaint, trigger triage agent, process payment, manage waiting queue |
| **Doctor** | View assigned queue, review pre-visit brief, record consultation audio, review SOAP note, review CDS suggestions, sign & finalize encounter |

---

## 2. Current Codebase Audit

> **Purpose:** Understand exactly what we have before changing anything. Every file listed here is a real file in the workspace today.

### Backend (`/backend`)

| File | Purpose | Status for New Architecture |
|:---|:---|:---|
| `app/main.py` | FastAPI app factory, CORS, router registration, seed on startup | **MODIFY** — add new routers (triage, encounters) |
| `app/database.py` | SQLAlchemy engine (SQLite), `SessionLocal`, `Base`, `get_db` | **MODIFY** — add Alembic migration support later |
| `app/config.py` | Settings class (Gemini key, Deepgram key, model names) | **MODIFY** — has duplicate `Settings` class, needs cleanup |
| `app/seed.py` | Seeds: 2 patients, 3 specialists, 3 referral rules, 1 audit entry | **MODIFY** — add more seed data (doctors, specialties) |
| **Models** | | |
| `app/models/patient.py` | Patient table (demographics + JSON fields for conditions, meds, labs, encounters) | **MODIFY** — add `chief_complaint`, `assigned_doctor_id`, `queue_status` |
| `app/models/specialist.py` | Specialist table (name, specialty, facility, availability) | **KEEP** — rename concept to "Doctor" or keep for external specialists |
| `app/models/referral.py` | Referral table (issue, specialist, priority, status) | **KEEP** |
| `app/models/referral_rule.py` | ReferralRule table (condition, trigger, expression, specialist) | **KEEP** |
| `app/models/workflow.py` | WorkflowExecution table (steps, status, timing) | **MODIFY** — expand for new 3-agent steps |
| `app/models/extracted_ehr.py` | ExtractedEHR table (JSON demographics, conditions, meds, labs) | **KEEP** |
| `app/models/clinical_summary.py` | ClinicalSummary table (summary text, sections, concerns, actions) | **MODIFY** — will become the "Pre-Visit Brief" model |
| `app/models/consultation.py` | Consultation table (audio file, transcript, key_points, PDF) | **MODIFY** — add `soap_note` JSON field, `encounter_status` |
| `app/models/audit.py` | AuditEntry table (user, role, action, timestamp) | **KEEP** |
| **Services** | | |
| `app/services/workflow.py` | 3-agent streaming pipeline (EHR Extract → Summary → Referral) | **REWRITE** — new pipeline for Phase 1 triage agent |
| `app/services/ai_summary.py` | Gemini AI narrative + rules-based fallback | **MODIFY** — extract into `triage_agent.py` |
| `app/services/transcription.py` | Deepgram + Gemini fallback audio transcription | **KEEP** — used by Agent 2 |
| `app/services/consultation_ai.py` | `generate_key_points()` using Gemini | **REPLACE** — new `scribe_agent.py` for SOAP notes |
| `app/services/ids.py` | ID generators (`PAT-`, `REF-`, `WF-`, `AUD-`, `CON-`, `ISS-`) + `write_audit()` | **MODIFY** — add new ID generators |
| `app/services/pdf_report.py` | ReportLab PDF generation for consultations | **KEEP** |
| `app/services/local_recorder.py` | `record_wav()` using sounddevice | **KEEP** — for server-side recording demo |
| **Routers** | | |
| `app/routers/patients.py` | CRUD + workflow run/stream endpoints | **MODIFY** — add `POST /patients` for creation |
| `app/routers/consultations.py` | Upload, transcribe, process, record-local, download PDF | **MODIFY** — add SOAP note + CDS endpoints |
| `app/routers/referrals.py` | List/get referrals | **KEEP** |
| `app/routers/specialists.py` | List specialists | **KEEP** |
| `app/routers/workflows.py` | List workflow executions | **KEEP** |
| `app/routers/rules.py` | List referral rules | **KEEP** |
| `app/routers/audit.py` | List audit entries | **KEEP** |

### Frontend (`/frontend`)

| File | Purpose | Status |
|:---|:---|:---|
| `src/routes/__root.tsx` | Root layout (QueryClient, SessionProvider, AppShell, Toaster) | **MODIFY** — add role-based navigation |
| `src/routes/index.tsx` | Dashboard with KPIs, charts, tables | **MODIFY** — role-aware dashboard |
| `src/routes/patients.index.tsx` | Patient list table | **MODIFY** — add "Add Patient" button |
| `src/routes/patients.$patientId.tsx` | Patient detail + workflow trigger | **MODIFY** — role-specific views |
| `src/routes/workflows.tsx` | Workflow monitor | **KEEP** |
| `src/routes/referrals.tsx` | Referrals list | **KEEP** |
| `src/routes/specialists.tsx` | Specialists directory | **KEEP** |
| `src/routes/rules.tsx` | Placeholder ("Pending...") | **KEEP** for now |
| `src/routes/settings.tsx` | Placeholder ("Pending...") | **KEEP** for now |
| `src/routes/audit.tsx` | Audit trail table | **KEEP** |
| `src/components/layout/AppSidebar.tsx` | Side navigation (hardcoded links) | **REWRITE** — role-based nav items |
| `src/components/layout/TopHeader.tsx` | Top bar with role switcher | **MODIFY** — Receptionist ⇄ Doctor toggle |
| `src/hooks/useSession.tsx` | Session context (Clinician / Care Coordinator roles) | **REWRITE** — Receptionist / Doctor roles |
| `src/hooks/useClinicalQueries.ts` | TanStack Query hooks for all API calls | **MODIFY** — add new query/mutation hooks |
| `src/api/clinicalApi.ts` | Fetch wrappers + SSE streaming | **MODIFY** — add new API calls |
| `src/api/config.ts` | Base URL config | **KEEP** |
| `src/types/clinical.ts` | All TypeScript interfaces | **MODIFY** — add new types |

---

## 3. Target Architecture

```
    Frontend (Vite + React 19 + TanStack Router)
    ┌──────────────────────────────────────────────┐
    │ /receptionist/new-patient  (Registration)    │
    │ /receptionist/triage/:id   (Triage Station)  │
    │ /receptionist/checkout/:id (Payment)         │
    │ /doctor/consult/:id        (Consultation)    │
    │ /doctor/review/:id         (Orders & Signoff)│
    └──────────────────┬───────────────────────────┘
                       │ HTTP/SSE
    Backend (FastAPI + SQLAlchemy)
    ┌──────────────────┴───────────────────────────┐
    │ POST /patients           (Create patient)     │
    │ POST /patients/:id/checkin (Triage trigger)   │
    │ POST /consultations/upload (Audio upload)     │
    │ POST /consultations/:id/scribe (SOAP gen)     │
    │ POST /consultations/:id/cds    (CDS orders)   │
    │ POST /encounters/:id/finalize  (Sign-off)     │
    ├──────────────────────────────────────────────┤
    │ Agent 1: triage_agent.py  → Gemini API       │
    │ Agent 2: scribe_agent.py  → Deepgram + Gemini│
    │ Agent 3: cds_orders_agent.py → Gemini API    │
    └──────────────────┬───────────────────────────┘
                       │
    Database (SQLite → PostgreSQL)
    ┌──────────────────┴───────────────────────────┐
    │ patients, consultations, encounters,          │
    │ triage_results, payments, audit_entries, ...  │
    └──────────────────────────────────────────────┘
```

---

## 4. Environment & Tooling Setup

### Prerequisites Checklist

```bash
# Verify installations
python --version          # 3.13+
node --version            # 22+
npm --version             # 10+
git --version             # 2.40+
```

### Environment Variables (`backend/.env`)

```env
# AI Services
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-2.5-flash

DEEPGRAM_API_KEY=your_deepgram_key_here
DEEPGRAM_MODEL=nova-2

# Database (Phase 6 — production)
# DATABASE_URL=postgresql://user:pass@host:5432/clinicalflow

# Auth (required from Phase 0)
JWT_SECRET=change-me-to-a-random-64-char-string
JWT_ALGORITHM=HS256
JWT_EXPIRY_MINUTES=480
```

### Dev Server Commands

```bash
# Terminal 1: Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm install
npm run dev
```

---

## 5. Phase 0 — Foundation & Infrastructure

> **Goal:** Clean up the existing codebase, fix known bugs, and set up the infrastructure for the new architecture. No new features here — just a solid foundation.

### Step 0.1 — Fix `config.py` Duplicate Settings Class

The current `config.py` has two `Settings` classes. The second one shadows the first.

**File:** `backend/app/config.py`  
**Action:** Merge into a single `Settings` class with all fields (google_api_key, gemini_model, deepgram_api_key, deepgram_model).

### Step 0.2 — Authentication: User Model + Backend Auth Module

**Goal:** Replace the mock session/role-switcher with a real Login/Sign-up flow using JWT tokens.

#### Step 0.2a — Backend: User Model

**File:** `backend/app/models/user.py` (NEW)

```python
class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(32), primary_key=True)    # USR-0001
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)          # "Receptionist" | "Doctor"
    specialty: Mapped[str | None] = mapped_column(String(48), nullable=True) # Only for Doctors
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
```

#### Step 0.2b — Backend: Auth Module

**Files:** `backend/app/auth/` (NEW directory)
- `backend/app/auth/__init__.py`
- `backend/app/auth/security.py` — Password hashing (passlib + bcrypt), JWT creation/verification
- `backend/app/auth/dependencies.py` — `get_current_user` FastAPI dependency

**New Dependencies:** Add to `requirements.txt`:
```
python-jose[cryptography]
passlib[bcrypt]
```

**`security.py` Logic:**
```python
from passlib.context import CryptContext
from jose import jwt, JWTError

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str: ...
def verify_password(plain: str, hashed: str) -> bool: ...
def create_access_token(data: dict, expires_delta: timedelta) -> str: ...
def decode_access_token(token: str) -> dict: ...
```

**`dependencies.py` Logic:**
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)) -> User:
    # Decode JWT, fetch user from DB, raise 401 if invalid
    ...
```

#### Step 0.2c — Backend: Auth Router

**File:** `backend/app/routers/auth.py` (NEW)

**Endpoints:**

1. `POST /auth/signup` — Register a new user
```python
class SignupRequest(BaseModel):
    full_name: str
    email: str                    # Must be unique
    password: str                 # Min 6 chars
    role: str                     # "Receptionist" | "Doctor"
    specialty: str | None = None  # Required if role == "Doctor"
```
**Logic:** Hash password, generate `user_id`, persist, return user info (no token yet — user must login).

2. `POST /auth/login` — Authenticate and return JWT
```python
class LoginRequest(BaseModel):
    email: str
    password: str
```
**Logic:** Verify email exists, verify password hash, generate JWT with `{user_id, email, role, full_name}` payload, return `{access_token, token_type, user}`. 

3. `GET /auth/me` — Return current logged-in user (protected)
**Logic:** Decode JWT from `Authorization: Bearer <token>`, return user profile.

#### Step 0.2d — Backend: Seed Default Users

**File:** `backend/app/seed.py` (MODIFY)

Add a `seed_users()` function that pre-creates two demo accounts:
```python
def seed_users(db: Session) -> None:
    if db.scalar(select(User).limit(1)) is not None:
        return
    users = [
        User(
            user_id="USR-0001",
            full_name="Ananya Deshmukh",
            email="ananya@clinicalflow.demo",
            hashed_password=hash_password("receptionist123"),
            role="Receptionist",
            specialty=None,
            is_active=True,
            created_at=utcnow(),
        ),
        User(
            user_id="USR-0002",
            full_name="Dr. Neha Kapoor",
            email="neha@clinicalflow.demo",
            hashed_password=hash_password("doctor123"),
            role="Doctor",
            specialty="General Medicine",
            is_active=True,
            created_at=utcnow(),
        ),
    ]
    db.add_all(users)
    db.commit()
```

Call `seed_users(db)` in `main.py` lifespan alongside other seed functions.

#### Step 0.2e — Frontend: Refactor Session Hook for JWT Auth

**File:** `frontend/src/hooks/useSession.tsx` (REWRITE)

**Changes:**
1. Change `Role` type in `types/clinical.ts` from `"Clinician" | "Care Coordinator"` to `"Receptionist" | "Doctor"`.
2. Remove the hardcoded `USERS` record and the `STORAGE_KEY` localStorage approach.
3. Store the JWT token in `localStorage` under key `clinicalflow.auth.token`.
4. On app load, call `GET /auth/me` with the stored token to hydrate the session.
5. Expose: `user`, `signedIn`, `login(email, password)`, `signup(...)`, `logout()`, `can(permission)`.
6. Update `PERMISSIONS` matrix:
   - Receptionist: `registerPatient: true, runTriage: true, processPayment: true, runWorkflow: false, recordConsultation: false`
   - Doctor: `registerPatient: false, runTriage: false, processPayment: false, runWorkflow: true, recordConsultation: true, signEncounter: true`

### Step 0.3 — Refactor Sidebar Navigation (Role-Based)

**File:** `frontend/src/components/layout/AppSidebar.tsx`  
**Action:** Conditionally render navigation links based on the current role.

```
Receptionist sees:
  - Dashboard (Intake Overview)
  - Patients
  - Triage Station (new)
  - Payment (new)
  - Audit Trail

Doctor sees:
  - Dashboard (My Queue)
  - Patients
  - Consultation Room (new)
  - Workflow Monitor
  - Referrals
  - Audit Trail
```

### Step 0.4 — Login & Sign-up Pages

#### Step 0.4a — Frontend: Login Page

**File:** `frontend/src/routes/login.tsx` (NEW)

**UI Layout:**
```
+---------------------------------------------------+
|           ClinicalFlow AI                         |
|           Agentic Clinical Workflow               |
|                                                   |
|  +---------------------------------------------+ |
|  |  Email:    [_________________________]       | |
|  |  Password: [_________________________]       | |
|  |                                               | |
|  |  [Login as Receptionist]  [Login as Doctor]   | |
|  |                                               | |
|  |  Don't have an account? Sign up               | |
|  +---------------------------------------------+ |
+---------------------------------------------------+
```

**Behavior:**
1. Single form with email + password fields.
2. Submit calls `POST /auth/login`.
3. On success: Store JWT in localStorage, hydrate session, redirect to `/` (role-appropriate dashboard).
4. On error: Show toast with "Invalid credentials".
5. If user is already logged in (valid token exists), auto-redirect to `/`.

#### Step 0.4b — Frontend: Sign-up Page

**File:** `frontend/src/routes/signup.tsx` (NEW)

**UI Layout:**
```
+---------------------------------------------------+
|           ClinicalFlow AI                         |
|           Create your account                     |
|                                                   |
|  +---------------------------------------------+ |
|  |  Full Name:  [_________________________]     | |
|  |  Email:      [_________________________]     | |
|  |  Password:   [_________________________]     | |
|  |  Role:       (o) Receptionist  (o) Doctor    | |
|  |  Specialty:  [________] (only if Doctor)     | |
|  |                                               | |
|  |  [Create Account]                             | |
|  |                                               | |
|  |  Already have an account? Login               | |
|  +---------------------------------------------+ |
+---------------------------------------------------+
```

**Behavior:**
1. Form with name, email, password, role (radio group), specialty (conditional).
2. Submit calls `POST /auth/signup`.
3. On success: Toast "Account created! Please login." + redirect to `/login`.
4. On error: Show validation errors inline.

#### Step 0.4c — Frontend: Auth Guard & Routing

**File:** `frontend/src/routes/__root.tsx` (MODIFY)

**Action:**
1. In the root component, check `useSession().signedIn`.
2. If not signed in and the current route is NOT `/login` or `/signup`, redirect to `/login`.
3. If signed in and on `/login` or `/signup`, redirect to `/`.

**File:** `frontend/src/components/layout/TopHeader.tsx` (MODIFY)

**Action:**
- Remove any role-switcher toggle.
- Show the logged-in user's name, role badge, and a "Logout" button.
- Clicking "Logout" clears the JWT from localStorage, resets session state, and redirects to `/login`.

### Step 0.5 — Database Schema Additions

**New/Modified Models to Plan:**

```python
# backend/app/models/patient.py — ADD these columns:
chief_complaint: Mapped[str | None]       # Today's reason for visit
assigned_doctor_id: Mapped[str | None]    # Doctor assigned by triage
queue_status: Mapped[str]                 # "Not Checked In" | "Waiting" | "In Consultation" | "Completed"
queue_position: Mapped[int | None]        # Position in doctor's queue
checked_in_at: Mapped[datetime | None]    # Timestamp of check-in
contact_phone: Mapped[str | None]         # Contact number
contact_email: Mapped[str | None]         # Email address
insurance_id: Mapped[str | None]          # Insurance policy ID
address: Mapped[str | None]              # Address
```

```python
# backend/app/models/triage_result.py — NEW MODEL:
class TriageResult(Base):
    __tablename__ = "triage_results"
    
    triage_id: str (PK)
    patient_id: str (FK -> patients)
    chief_complaint: str
    recommended_specialty: str
    recommended_doctor_id: str | None
    recommended_doctor_name: str | None
    acuity_level: str           # "Routine" | "Urgent" | "Emergency"
    pre_visit_brief: str        # Markdown/text brief for the doctor
    brief_sections: JSON        # Structured sections [{heading, body}]
    confidence_score: float     # 0.0 - 1.0
    model: str                  # Which AI model was used
    created_at: datetime
```

```python
# backend/app/models/encounter.py — NEW MODEL:
class Encounter(Base):
    __tablename__ = "encounters"
    
    encounter_id: str (PK)
    patient_id: str (FK -> patients)
    consultation_id: str | None (FK -> consultations)
    triage_id: str | None (FK -> triage_results)
    doctor_id: str
    doctor_name: str
    
    # SOAP Note (from Agent 2)
    soap_subjective: str | None
    soap_objective: str | None
    soap_assessment: str | None
    soap_plan: str | None
    
    # CDS Suggestions (from Agent 3)
    suggested_labs: JSON          # [{test, reason, priority}]
    suggested_medications: JSON   # [{name, dose, frequency, route, reason}]
    suggested_icd_codes: JSON     # [{code, description}]
    suggested_referrals: JSON     # [{specialty, reason, urgency}]
    
    # Doctor's final selections
    approved_labs: JSON | None
    approved_medications: JSON | None
    approved_icd_codes: JSON | None
    approved_referrals: JSON | None
    
    status: str                   # "In Progress" | "Reviewed" | "Finalized"
    finalized_at: datetime | None
    finalized_by: str | None
    created_at: datetime
```

```python
# backend/app/models/payment.py — NEW MODEL:
class Payment(Base):
    __tablename__ = "payments"
    
    payment_id: str (PK)
    patient_id: str (FK -> patients)
    encounter_id: str | None
    amount: float
    currency: str               # "INR"
    payment_type: str           # "Consultation" | "Follow-up" | "Lab" | "Procedure"
    payment_method: str         # "Cash" | "Card" | "UPI" | "Insurance"
    status: str                 # "Pending" | "Completed" | "Failed" | "Refunded"
    transaction_ref: str | None
    created_at: datetime
    completed_at: datetime | None
```

> **IMPORTANT:** Do NOT delete the existing SQLite database yet. When adding new columns, use SQLAlchemy's `create_all()` which will create new tables automatically. For modifying existing tables, either:
> - Delete `clinical.db` and let seed data recreate it (dev only), OR
> - Set up Alembic migrations (Phase 6, production)

---

## 6. Phase 1 — Receptionist Experience (Intake & Triage)

> **Goal:** Build the complete receptionist workflow — from patient registration to triage to payment to queue management.

### Step 1.1 — Backend: Patient Creation API

**File:** `backend/app/routers/patients.py`  
**New Endpoint:** `POST /patients`

```python
# Request body (Pydantic schema):
class CreatePatientIn(BaseModel):
    name: str
    date_of_birth: str          # "YYYY-MM-DD"
    gender: str                 # "Male" | "Female" | "Other"
    contact_phone: str | None
    contact_email: str | None
    insurance_id: str | None
    address: str | None
    # Pre-existing conditions (optional at registration)
    conditions: list[dict] = []
    medications: list[dict] = []
```

**Logic:**
1. Auto-generate `patient_id` (e.g., `PAT-1003`).
2. Calculate `age` from `date_of_birth`.
3. Set `risk` = "Low" by default (will be updated by triage agent).
4. Set `workflow_status` = "Not Started", `queue_status` = "Not Checked In".
5. Persist to DB.
6. Write audit entry: "Receptionist registered new patient PAT-XXXX".
7. Return the created patient.

### Step 1.2 — Backend: Patient Check-in & Triage Trigger

**File:** `backend/app/routers/triage.py` (NEW)  
**New Endpoint:** `POST /patients/{patient_id}/checkin`

```python
class CheckinRequest(BaseModel):
    chief_complaint: str       # Free text: "Blurry vision and tingling feet for 2 months"
    vitals: dict | None = None # Optional: {"bp": "140/90", "temp": "98.6", "pulse": 82}
    actor_name: str
    actor_role: str
```

**Logic:**
1. Validate patient exists.
2. Update patient: `chief_complaint`, `checked_in_at = utcnow()`, `queue_status = "Waiting"`.
3. Call **Agent 1 (Smart Triage)** -> returns triage result.
4. Save `TriageResult` to DB.
5. Update patient: `assigned_doctor_id`, `queue_position` (append to doctor's queue).
6. Write audit entry.
7. Return triage result (recommended doctor, acuity, pre-visit brief).

### Step 1.3 — Backend: Agent 1 — Smart Triage & Doctor Routing

**File:** `backend/app/services/agents/triage_agent.py` (NEW)

**Gemini Prompt Design:**

```python
TRIAGE_SYSTEM_PROMPT = """
You are a clinical triage AI assistant in a hospital front desk setting.
Given a patient's medical history (EHR) and their current chief complaint,
you must determine:

1. RECOMMENDED SPECIALTY: Which medical specialty should see this patient.
2. ACUITY LEVEL: How urgently the patient needs to be seen.
   - "Routine": Can wait, standard queue
   - "Urgent": Should be seen within the hour
   - "Emergency": Needs immediate attention
3. PRE-VISIT BRIEF: A concise 3-5 bullet clinical brief that helps the
   receiving doctor quickly understand the patient's relevant history
   in context of today's chief complaint.
4. RISK ASSESSMENT: Overall patient risk level ("Low", "Medium", "High")

Return ONLY a JSON object with keys:
  recommended_specialty (string),
  acuity_level (string: "Routine" | "Urgent" | "Emergency"),
  risk_level (string: "Low" | "Medium" | "High"),
  pre_visit_brief (string - markdown formatted, concise bullets),
  brief_sections (array of {heading, body}),
  reasoning (string - one sentence explaining the triage decision),
  confidence (float 0.0-1.0)
"""
```

**Fallback (no API key):** Rule-based triage:
- Match chief complaint keywords against condition database.
- Match against specialist types from the `specialists` table.
- Generate a basic structured brief from EHR data.

**Doctor Assignment Logic:**
1. Query `specialists` table for the recommended specialty.
2. Sort by `active_referrals ASC` (least loaded doctor first).
3. Filter by `availability != "Unavailable"`.
4. Assign the first match.

### Step 1.4 — Backend: Payment Endpoint

**File:** `backend/app/routers/payments.py` (NEW)  
**New Endpoint:** `POST /payments`

```python
class CreatePaymentIn(BaseModel):
    patient_id: str
    amount: float
    payment_type: str         # "Consultation" | "Follow-up"
    payment_method: str       # "Cash" | "Card" | "UPI"
```

**Logic (Mock Implementation):**
1. Generate `payment_id` (e.g., `PAY-0001`).
2. Simulate processing delay (500ms).
3. Set `status = "Completed"`, `transaction_ref = uuid4()`.
4. Persist to DB.
5. Write audit entry.
6. Return payment receipt.

> **NOTE:** This is a mock payment gateway. For real Stripe/Razorpay integration, wrap this logic inside the provider's SDK in Phase 6.

### Step 1.5 — Backend: Queue Management API

**New Endpoints:**
- `GET /queue?doctor_id=SPC-2001` — Returns patients in a specific doctor's queue, ordered by `queue_position`.
- `GET /queue/all` — Returns all active queues grouped by doctor.

### Step 1.6 — Frontend: Patient Registration Page

**File:** `frontend/src/routes/receptionist/new-patient.tsx` (NEW)

**UI Components:**
- Clean multi-section form using `react-hook-form` + `zod` validation:
  - Section 1: **Personal Info** — Name, DOB, Gender, Contact, Address
  - Section 2: **Insurance** — Insurance ID, Provider (optional)
  - Section 3: **Medical History** — Add conditions (searchable ICD-10 dropdown), medications
- Submit button: "Register Patient"
- On success: Toast notification + redirect to Triage Station for this patient.

### Step 1.7 — Frontend: Triage Station Page

**File:** `frontend/src/routes/receptionist/triage.$patientId.tsx` (NEW)

**UI Layout:**
```
+---------------------------------------------------+
|  Patient Header: Name, Age, Gender, PAT-ID        |
+-------------------------+-------------------------+
|  Chief Complaint Input  |  Patient History Card   |
|  (large textarea)       |  (conditions, meds,    |
|                         |   recent labs, visits)  |
|  [Run Smart Triage]     |                        |
+-------------------------+-------------------------+
|  Triage Result Panel (appears after agent runs)   |
|  +---------------------------------------------+ |
|  | Recommended: Endocrinology                   | |
|  | Doctor: Dr. Meera Shah                       | |
|  | Acuity: Urgent                               | |
|  | Pre-Visit Brief:                             | |
|  |   * 58M with uncontrolled T2DM (HbA1c 10.2) | |
|  |   * On Metformin 1000mg BID                  | |
|  |   * Presenting with blurry vision + neuropathy| |
|  +---------------------------------------------+ |
|                                                   |
|  [Proceed to Payment ->]                          |
+---------------------------------------------------+
```

**Behavior:**
1. Clicking "Run Smart Triage" calls `POST /patients/{id}/checkin` with the chief complaint.
2. Show a loading skeleton/spinner while the agent processes.
3. Display the triage result with visual acuity badge (green/yellow/red).
4. "Proceed to Payment" navigates to the checkout page.

### Step 1.8 — Frontend: Payment Checkout Page

**File:** `frontend/src/routes/receptionist/checkout.$patientId.tsx` (NEW)

**UI Layout:**
- Patient summary card (name, complaint, assigned doctor).
- Fee breakdown (Consultation: Rs.500, Tax: Rs.0, Total: Rs.500).
- Payment method selector (Cash / Card / UPI) — radio group.
- "Process Payment" button.
- On success: Show receipt + "Patient has been added to Dr. X's queue" confirmation.

### Step 1.9 — Frontend: Receptionist Dashboard

**Modify:** `frontend/src/routes/index.tsx` (when role = Receptionist)

**Show:**
- KPI cards: Today's Registrations, Patients Waiting, Triage Completed, Revenue Collected.
- Live Waiting Queue table (Patient Name, Complaint, Assigned Doctor, Queue Position, Wait Time).
- Quick-action button: "+ New Patient".

---

## 7. Phase 2 — Doctor Experience (Consultation & Scribing)

> **Goal:** Build the doctor's workflow — view assigned patients, record consultations, and generate SOAP notes.

### Step 2.1 — Frontend: Doctor Queue Dashboard

**Modify:** `frontend/src/routes/index.tsx` (when role = Doctor)

**Show:**
- KPI cards: My Patients Today, In Consultation, Completed Today, Avg Consultation Time.
- "My Queue" table: Only patients assigned to this doctor, sorted by `queue_position`.
  - Columns: Patient Name, Chief Complaint, Acuity Badge, Wait Time, Action ("Start Consultation").
- Clicking "Start Consultation" navigates to `/doctor/consult/$patientId`.

### Step 2.2 — Frontend: Consultation Room Page

**File:** `frontend/src/routes/doctor/consult.$patientId.tsx` (NEW)

**UI Layout (3-Panel):**
```
+-----------------------------------------------------------------+
|  Patient Header: Name | Age | Gender | Chief Complaint            |
+---------------------+-------------------------------------------+
|  LEFT PANEL         |  RIGHT PANEL                              |
|  Pre-Visit Brief    |  Audio Recorder                           |
|  (from Agent 1)     |  +-------------------------------+       |
|                     |  |  Recording... 02:34            |       |
|  * Condition summary|  |  (waveform visualizer)         |       |
|  * Key labs         |  |  [Pause] [Stop & Transcribe]   |       |
|  * Current meds     |  +-------------------------------+       |
|  * Risk flags       |                                           |
|                     |  OR: [Upload Audio File]                  |
|                     |                                           |
+---------------------+-------------------------------------------+
|  BOTTOM PANEL: SOAP Note (appears after transcription)          |
|  +-----------+-----------+-----------+-----------+              |
|  |Subjective | Objective |Assessment |   Plan    |              |
|  +-----------+-----------+-----------+-----------+              |
|  | Patient reports worsening blurry vision       |              |
|  | in both eyes for the past 2 months...         |              |
|  +-----------------------------------------------+              |
|  [Proceed to Clinical Orders ->]                                |
+-----------------------------------------------------------------+
```

### Step 2.3 — Frontend: Audio Recorder Component

**File:** `frontend/src/components/consultation/AudioRecorder.tsx` (NEW)

**Technical Implementation:**
1. Use the **Web Audio API** (`navigator.mediaDevices.getUserMedia`) for browser-based recording.
2. Use **MediaRecorder API** to capture audio as `.webm` or `.wav`.
3. Show a real-time waveform visualization using `AnalyserNode.getByteTimeDomainData()`.
4. Timer display (MM:SS).
5. Controls: Start / Pause / Resume / Stop.
6. On Stop: Upload the recorded blob to `POST /consultations/upload`.
7. Alternative: "Upload File" button for pre-recorded `.wav`/`.mp3` files.

### Step 2.4 — Backend: Agent 2 — Ambient Medical Scribe

**File:** `backend/app/services/agents/scribe_agent.py` (NEW)

**Two-Step Process:**

**Step A — Transcription** (existing `transcription.py`):
1. Deepgram Nova-2 (primary) -> verbatim transcript.
2. Gemini (fallback) -> transcript.

**Step B — SOAP Note Generation** (NEW Gemini prompt):

```python
SCRIBE_SYSTEM_PROMPT = """
You are a medical scribe AI. Given a transcript of a doctor-patient 
consultation, structure it into a professional SOAP note.

SOAP Format:
- **Subjective (S):** Patient's reported symptoms, history of present 
  illness, relevant past history mentioned in conversation.
- **Objective (O):** Any vitals, physical exam findings, or test results
  mentioned by the doctor during the visit.
- **Assessment (A):** Doctor's clinical impression, differential diagnosis,
  or working diagnosis discussed.
- **Plan (P):** Treatment plan, medications prescribed, tests ordered,
  follow-up instructions, referrals mentioned.

Rules:
- Use only information present in the transcript.
- Use professional medical terminology.
- If a section has no relevant data, write "Not discussed during this visit."
- Do NOT invent findings.

Return ONLY a JSON object:
{
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "...",
  "key_findings": ["finding1", "finding2"],
  "mentioned_diagnoses": ["diagnosis1"],
  "mentioned_medications": ["med1"]
}
"""
```

**Fallback (no API key):** Return the raw transcript split into 4 equal sections with placeholder headings.

**New Endpoint:** `POST /consultations/{consultation_id}/scribe`

### Step 2.5 — Backend: Enhanced Consultation Router

**File:** `backend/app/routers/consultations.py`

**New/Modified Endpoints:**
- `POST /consultations/{id}/scribe` — Runs Agent 2 (transcribe + SOAP note).
- Stores `soap_note` JSON on the `Consultation` model.
- Returns the full consultation with SOAP note.

---

## 8. Phase 3 — Clinical Decision Support & Sign-off

> **Goal:** After the SOAP note is generated, Agent 3 suggests clinical orders, and the doctor reviews and finalizes the encounter.

### Step 3.1 — Backend: Agent 3 — Clinical Orders & CDS

**File:** `backend/app/services/agents/cds_orders_agent.py` (NEW)

**Gemini Prompt:**

```python
CDS_SYSTEM_PROMPT = """
You are a Clinical Decision Support (CDS) AI assistant.
Given a SOAP note from a doctor-patient consultation and the patient's 
medical profile (conditions, medications, labs), suggest:

1. DIAGNOSTIC TESTS: Lab tests and imaging studies to order.
2. MEDICATIONS: Prescriptions with dose, frequency, route, and reason.
3. ICD-10 CODES: Relevant diagnostic codes for billing.
4. FOLLOW-UP: Follow-up timeline and any specialist referrals needed.

Rules:
- Base suggestions ONLY on the SOAP note and patient data provided.
- Cite clinical reasoning for each suggestion.
- Flag any potential drug interactions with current medications.
- Prioritize suggestions as "Required", "Recommended", or "Optional".

Return ONLY a JSON object:
{
  "suggested_labs": [
    {"test": "HbA1c", "reason": "Monitor glycemic control", "priority": "Required"}
  ],
  "suggested_medications": [
    {"name": "Metformin", "dose": "500mg", "frequency": "BID", "route": "Oral",
     "reason": "Glycemic control", "interactions": []}
  ],
  "suggested_icd_codes": [
    {"code": "E11.319", "description": "Type 2 DM with unspecified diabetic retinopathy"}
  ],
  "suggested_referrals": [
    {"specialty": "Ophthalmology", "reason": "Diabetic retinopathy screening", "urgency": "Urgent"}
  ],
  "warnings": ["Check renal function before continuing Metformin"],
  "follow_up": "Schedule follow-up in 2 weeks for lab review"
}
"""
```

**New Endpoint:** `POST /consultations/{consultation_id}/cds`

### Step 3.2 — Backend: Encounter Finalization

**File:** `backend/app/routers/encounters.py` (NEW)  
**New Endpoint:** `POST /encounters/{encounter_id}/finalize`

```python
class FinalizeEncounterIn(BaseModel):
    approved_labs: list[dict]
    approved_medications: list[dict]
    approved_icd_codes: list[dict]
    approved_referrals: list[dict]
    doctor_notes: str | None = None
    actor_name: str
    actor_role: str
```

**Logic:**
1. Save the doctor's approved selections to the `Encounter`.
2. For each `approved_referral`, create a `Referral` record (reuse existing referral creation logic).
3. Update patient: `queue_status = "Completed"`, `workflow_status = "Completed"`.
4. Write audit entries for every action taken.
5. Set `encounter.status = "Finalized"`, `encounter.finalized_at = utcnow()`.

### Step 3.3 — Frontend: Clinical Orders & Sign-off Page

**File:** `frontend/src/routes/doctor/review.$consultationId.tsx` (NEW)

**UI Layout:**
```
+-------------------------------------------------------------+
|  SOAP Note Summary (collapsible accordion, read-only)        |
+----------------------+--------------------------------------+
|  Lab Orders          |  Medications                          |
|  [x] HbA1c (Required)|  [x] Metformin 500mg BID (Required)  |
|  [x] Creatinine      |  [ ] Insulin Glargine (Recommended)  |
|  [ ] Lipid Panel      |                                      |
+----------------------+--------------------------------------+
|  ICD-10 Codes        |  Referrals                           |
|  [x] E11.319 - T2DM  |  [x] Ophthalmology (Urgent)          |
|  [x] E11.40 - Neuro  |  [ ] Nephrology (Recommended)        |
+----------------------+--------------------------------------+
|  Warnings:                                                   |
|  * Check renal function before continuing Metformin          |
+--------------------------------------------------------------+
|  Doctor Notes: [                                    ]        |
|                                                              |
|  [Sign & Finalize Encounter]                                 |
+--------------------------------------------------------------+
```

**Behavior:**
- All CDS suggestions are checkboxes (pre-checked for "Required" priority).
- Doctor can uncheck, add notes, or modify.
- "Sign & Finalize" calls `POST /encounters/{id}/finalize` with the selected items.
- On success: Redirect to Doctor Queue with a success toast.

---

## 9. Phase 4 — Audit, Compliance & Polish

### Step 4.1 — Comprehensive Audit Logging

Every action in the system must create an audit entry:

| Action | Actor | Logged Data |
|:---|:---|:---|
| Patient registered | Receptionist | Patient ID, name |
| Triage agent run | System (Agent 1) | Triage ID, recommended specialty, acuity |
| Payment processed | Receptionist | Payment ID, amount, method |
| Patient added to queue | System | Patient ID, Doctor ID, position |
| Consultation started | Doctor | Consultation ID, patient ID |
| Audio uploaded | Doctor | File name, duration |
| Scribe agent run | System (Agent 2) | Consultation ID, transcript length |
| CDS agent run | System (Agent 3) | Consultation ID, suggestion counts |
| Encounter finalized | Doctor | Encounter ID, approved items |

### Step 4.2 — Frontend Polish & Animations

- Loading skeletons on every data-fetching page.
- Smooth page transitions using CSS transitions.
- Toast notifications for all CRUD operations using `sonner`.
- Mobile-responsive layout (sidebar collapses to hamburger).
- Consistent color coding:
  - Green = Routine / Low / Completed
  - Yellow/Amber = Moderate / Medium / Waiting
  - Red = Urgent / High / Emergency / Failed

### Step 4.3 — Error Handling & Edge Cases

- **No API Key:** All 3 agents must have fallback logic when Gemini API key is missing.
- **Empty Transcript:** If Deepgram returns nothing and Gemini also fails, show a user-friendly error.
- **Concurrent Queue Updates:** Handle race conditions in queue position assignment.
- **Network Failures:** Frontend should retry failed API calls (TanStack Query handles this).

---

## 10. Phase 5 — Testing & Quality Assurance

### Step 5.1 — Backend Unit Tests

```bash
pip install pytest httpx pytest-asyncio
```

**Test Files:**
```
backend/tests/
  conftest.py              # Test DB setup, fixtures
  test_patients.py         # Patient CRUD
  test_triage_agent.py     # Agent 1 (mock Gemini responses)
  test_scribe_agent.py     # Agent 2 (mock Deepgram + Gemini)
  test_cds_agent.py        # Agent 3 (mock Gemini responses)
  test_payments.py         # Payment flow
  test_encounters.py       # Encounter finalization
  test_audit.py            # Audit trail verification
```

**Testing Strategy:**
- Use `httpx.AsyncClient` with FastAPI `TestClient`.
- Use in-memory SQLite for test isolation.
- Mock all AI service calls (Gemini, Deepgram) with `unittest.mock.patch`.
- Assert: correct HTTP status codes, DB state changes, audit entries created.

### Step 5.2 — Frontend Component Tests

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
```

**Test Files:**
```
frontend/src/__tests__/
  AudioRecorder.test.tsx
  PatientRegistration.test.tsx
  TriageStation.test.tsx
  ClinicalOrders.test.tsx
```

### Step 5.3 — End-to-End Smoke Test (Manual Checklist)

```markdown
## E2E Smoke Test Checklist

### Receptionist Flow
- [ ] Switch role to Receptionist
- [ ] Navigate to New Patient -> Fill form -> Submit
- [ ] Verify patient appears in Patients list
- [ ] Open Triage Station for new patient
- [ ] Enter chief complaint -> Click "Run Smart Triage"
- [ ] Verify triage result appears (specialty, acuity, brief)
- [ ] Navigate to Payment -> Process mock payment
- [ ] Verify patient appears in Doctor's queue

### Doctor Flow
- [ ] Switch role to Doctor
- [ ] Verify patient appears in "My Queue"
- [ ] Click "Start Consultation"
- [ ] Verify Pre-Visit Brief is displayed
- [ ] Record/upload audio -> Verify transcript appears
- [ ] Verify SOAP Note is generated
- [ ] Navigate to Clinical Orders
- [ ] Verify lab/med/ICD-10 suggestions appear
- [ ] Select items -> Click "Sign & Finalize"
- [ ] Verify encounter is finalized
- [ ] Verify audit trail entries for all actions
```

---

## 11. Phase 6 — Deployment & Production Readiness

### Step 6.1 — Database Migration (SQLite -> PostgreSQL)

```bash
pip install alembic psycopg2-binary
alembic init alembic
```

- Configure `alembic.ini` to read `DATABASE_URL` from env.
- Generate initial migration: `alembic revision --autogenerate -m "initial schema"`.
- Run: `alembic upgrade head`.

### Step 6.2 — Harden Authentication

**Auth was implemented in Phase 0. This step hardens it for production:**
1. Move JWT storage from `localStorage` to `httpOnly` cookies (prevents XSS token theft).
2. Add refresh token rotation (short-lived access tokens + long-lived refresh tokens).
3. Add rate limiting on `/auth/login` (e.g., 5 attempts per minute per IP) using `slowapi`.
4. Add email verification flow (optional, using SendGrid/Resend).
5. Protect all API endpoints with `Depends(get_current_user)` — ensure no unprotected routes remain.
6. Add password strength validation (min 8 chars, 1 uppercase, 1 number).

### Step 6.3 — Dockerization

```dockerfile
# backend/Dockerfile
FROM python:3.13-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```dockerfile
# frontend/Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: clinicalflow
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: secret
    volumes:
      - pgdata:/var/lib/postgresql/data

  backend:
    build: ./backend
    env_file: ./backend/.env
    depends_on: [db]
    ports: ["8000:8000"]

  frontend:
    build: ./frontend
    ports: ["3000:80"]

volumes:
  pgdata:
```

### Step 6.4 — CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.13"
      - run: pip install -r backend/requirements.txt pytest httpx
      - run: cd backend && pytest

  frontend-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: cd frontend && npm ci && npm run build
```

---

## 12. Sprint Timeline

| Sprint | Duration | Phase | Deliverables |
|:---|:---|:---|:---|
| **Sprint 0** | Days 1-2 | Phase 0 | Config cleanup, RBAC refactor, role-based sidebar, new DB models, seed data |
| **Sprint 1** | Days 3-5 | Phase 1 | Patient creation API + form, Triage Agent (backend + Gemini prompt), Triage Station UI |
| **Sprint 2** | Days 6-7 | Phase 1 | Payment mock, Queue management API, Receptionist Dashboard, queue display |
| **Sprint 3** | Days 8-11 | Phase 2 | Audio Recorder component, Scribe Agent (transcription + SOAP), Consultation Room UI |
| **Sprint 4** | Days 12-14 | Phase 3 | CDS Orders Agent, Clinical Orders UI, Encounter finalization, sign-off flow |
| **Sprint 5** | Days 15-16 | Phase 4 | Audit trail polish, error handling, loading states, animations, mobile responsiveness |
| **Sprint 6** | Days 17-19 | Phase 5 | Backend unit tests, frontend component tests, E2E smoke test |
| **Sprint 7** | Days 20-22 | Phase 6 | Alembic migrations, Dockerfiles, docker-compose, CI/CD pipeline |

---

## 13. Risk Register

| Risk | Impact | Mitigation |
|:---|:---|:---|
| Gemini API rate limits or quota exhaustion | Agents fail silently | Always implement rules-based fallback for every agent |
| Deepgram API key invalid or expired | No audio transcription | Gemini fallback transcription already exists |
| SQLite file locking under concurrent requests | DB write failures in dev | Move to PostgreSQL before production (Phase 6) |
| Large audio files (>50MB) timeout during upload | Upload fails | Add chunked upload + file size validation (max 25MB) |
| SOAP note quality varies with audio quality | Unreliable clinical output | Add disclaimer "AI-generated - doctor must review" |
| TanStack Router SSR vs SPA conflicts | Page rendering issues | Use SPA mode for now; SSR is optional |

---

## 14. Appendix — File Tree Target State

```
Clinical_Workflow/
  backend/
    .env
    requirements.txt
    Dockerfile
    alembic/                        # Phase 6
      env.py
      versions/
    app/
      __init__.py
      main.py
      database.py
      config.py                     # CLEANED UP
      seed.py                       # EXPANDED (+ seed_users)
      auth/                         # NEW (Phase 0)
        __init__.py
        security.py                 # Password hashing, JWT create/verify
        dependencies.py             # get_current_user FastAPI dependency
      models/
        __init__.py
        user.py                     # NEW (Phase 0 — login/signup)
        patient.py                  # MODIFIED (new fields)
        specialist.py
        referral.py
        referral_rule.py
        workflow.py
        extracted_ehr.py
        clinical_summary.py
        consultation.py             # MODIFIED (SOAP fields)
        audit.py
        triage_result.py            # NEW
        encounter.py                # NEW
        payment.py                  # NEW
      routers/
        __init__.py
        auth.py                     # NEW (signup, login, /me)
        patients.py                 # MODIFIED (POST /patients)
        triage.py                   # NEW
        consultations.py            # MODIFIED (/scribe, /cds)
        encounters.py               # NEW
        payments.py                 # NEW
        queue.py                    # NEW
        referrals.py
        specialists.py
        workflows.py
        rules.py
        audit.py
      services/
        __init__.py
        ids.py                      # MODIFIED (new ID generators)
        agents/
          __init__.py
          triage_agent.py           # NEW - Agent 1
          scribe_agent.py           # NEW - Agent 2
          cds_orders_agent.py       # NEW - Agent 3
        ai_summary.py               # KEPT (reused by triage)
        transcription.py            # KEPT (used by scribe)
        pdf_report.py
        local_recorder.py
        consultation_ai.py          # DEPRECATED (replaced by scribe)
    tests/                          # Phase 5
      conftest.py
      test_patients.py
      test_triage_agent.py
      test_scribe_agent.py
      test_cds_agent.py
      test_payments.py
      test_encounters.py

  frontend/
    package.json
    vite.config.ts
    Dockerfile
    src/
      routes/
        __root.tsx                  # MODIFIED (auth guard)
        login.tsx                   # NEW (login page)
        signup.tsx                  # NEW (sign-up page)
        index.tsx                   # MODIFIED (role-aware dashboard)
        patients.index.tsx          # MODIFIED (+ Add Patient)
        patients.$patientId.tsx
        receptionist/               # NEW
          new-patient.tsx
          triage.$patientId.tsx
          checkout.$patientId.tsx
        doctor/                     # NEW
          consult.$patientId.tsx
          review.$consultationId.tsx
        workflows.tsx
        referrals.tsx
        specialists.tsx
        rules.tsx
        settings.tsx
        audit.tsx
      components/
        common/
        layout/
          AppShell.tsx
          AppSidebar.tsx            # REWRITTEN (role-based)
          TopHeader.tsx             # MODIFIED (user info + logout)
        consultation/               # NEW
          AudioRecorder.tsx
          SoapNoteCard.tsx
          WaveformVisualizer.tsx
        clinical/                   # NEW
          ClinicalOrdersCard.tsx
          LabOrdersPanel.tsx
          MedicationsPanel.tsx
          IcdCodesPanel.tsx
        triage/                     # NEW
          TriageResultCard.tsx
          PreVisitBrief.tsx
        payment/                    # NEW
          PaymentModal.tsx
        ui/                         # KEEP (shadcn components)
      hooks/
        useSession.tsx              # REWRITTEN (Receptionist/Doctor)
        useClinicalQueries.ts       # MODIFIED (new queries)
        use-mobile.tsx
      api/
        clinicalApi.ts              # MODIFIED (new API calls)
        config.ts
      types/
        clinical.ts                 # MODIFIED (new types)
      styles.css

  docker-compose.yml                # Phase 6
  .github/workflows/ci.yml          # Phase 6
  README.md
```

---

> **How to use this plan in Cursor:** Copy each Phase/Step into Cursor as a prompt. Start with "Phase 0, Step 0.1" and work sequentially. Each step is self-contained with the exact file to create/modify, the data structures, the API contract, and the UI layout. Cursor should be able to implement each step with minimal ambiguity.

> **Before starting:** Please review this plan, confirm the architecture decisions, and flag anything you'd like to change. Once approved, begin with Phase 0 (foundation cleanup).
