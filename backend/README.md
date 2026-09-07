# Clinical Referral API (FastAPI)

A Python backend for a clinical referral workflow demo. It stores patient data, specialists, and referral rules in a SQLite database and exposes REST APIs to manage referrals, run rule-based workflows, and maintain an audit trail.

When a patient workflow is run, the system evaluates lab values against configured rules (for example, HbA1c > 9.0%) and automatically creates specialist referrals when a rule matches. This backend is standalone and can be tested via Swagger UI — it is not connected to the React frontend yet.

> **Note:** This uses synthetic demo data for learning and demonstration only. It is not intended for production clinical use.

---

## Tech Stack

- **Python 3.13**
- **FastAPI** — REST API framework
- **SQLAlchemy** — ORM / database layer
- **SQLite** — local database (`clinical.db`)
- **Uvicorn** — ASGI server
- **Pydantic** — request/response validation

---

## Project Structure

```text
backend/
  README.md
  requirements.txt
  clinical.db              # created on first run
  app/
    main.py                # FastAPI app entry point
    database.py            # DB engine, session, Base
    seed.py                # demo data on startup
    models/                # SQLAlchemy tables
    schemas/               # Pydantic API models
    routers/               # HTTP route handlers
    services/              # workflow logic, IDs, audit helpers
```

---

## Setup & Run

### 1. Create and activate virtual environment

From the project root:

```bash
cd backend
py -m venv .venv
source .venv/Scripts/activate   # Git Bash on Windows
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Start the server

```bash
uvicorn app.main:app --reload --port 8000
```

### 4. Open API docs

- Swagger UI: http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

On first startup, the app creates `clinical.db` and seeds demo patients, specialists, referral rules, and an initial audit entry.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/patients` | List all patients |
| GET | `/patients/{patient_id}` | Get one patient |
| POST | `/patients/{patient_id}/workflow/run` | Run rule-based workflow for a patient |
| GET | `/specialists` | List all specialists |
| GET | `/referral-rules` | List referral rules |
| GET | `/referrals` | List all referrals |
| POST | `/referrals` | Create a referral manually |
| GET | `/referrals/{referral_id}` | Get one referral |
| PATCH | `/referrals/{referral_id}` | Update a referral (status, notes, etc.) |
| GET | `/workflows` | List workflow execution history |
| GET | `/audit` | List audit log entries |

---

## Example: Run Workflow

**POST** `/patients/PAT-1001/workflow/run`

Request body:

```json
{
  "actor": {
    "name": "Dr Test",
    "role": "Clinician"
  }
}
```

Expected result:
- Status: `Completed`
- Matches rules based on patient lab values
- Auto-creates referrals when rules match
- Writes an audit entry and saves a workflow record

Example: PAT-1001 has HbA1c = 10.2, which matches `RULE-001` (HbA1c > 9.0%) and creates an Endocrinologist referral.

---

## Example: Create Referral Manually

**POST** `/referrals`

```json
{
  "patient_id": "PAT-1001",
  "issue": "HbA1c critically elevated",
  "specialist_type": "Endocrinologist",
  "specialist_id": "SPC-2001",
  "priority": "High",
  "notes": "Urgent endocrine review",
  "actor": {
    "name": "Dr Test",
    "role": "Clinician"
  }
}
```

---

## Smoke Test Checklist (~5 minutes)

Run these in `/docs` or with curl:

1. **GET** `/health` → `{"status":"ok"}`
2. **GET** `/patients` → returns seeded patients
3. **GET** `/specialists` → returns specialists
4. **GET** `/referral-rules` → returns rules
5. **POST** `/referrals` → creates a referral (201)
6. **POST** `/patients/PAT-1001/workflow/run` → `Completed` with matched rules
7. **GET** `/referrals` → includes auto-created referral
8. **GET** `/workflows` → shows workflow run
9. **GET** `/audit` → shows create + workflow audit entries

---

## Reset Database

To start fresh with clean seed data:

1. Stop the server
2. Delete `backend/clinical.db`
3. Restart the server — tables and seed data are recreated automatically

---

## What's Next (Optional)

- Connect frontend via `VITE_API_BASE_URL`
- Add authentication (JWT)
- Switch SQLite → PostgreSQL for production
- Expand workflow with EHR extraction and AI summary steps
- Add Alembic for database migrations

---

## Disclaimer

AI-generated or rule-based clinical outputs in this demo are for **decision-support demonstration only**. Clinicians must independently verify all information before use in real care settings.
