# ClinicalFlow AI — Backend Progress & Working Flow

> **Last updated:** 2026-09-11  
> **Branch context:** `v1-branch`  
> **Status:** Phase 0 + Phase 1 complete · Phase 2 in progress

---

## 1. What This Project Is

ClinicalFlow AI is a full-stack clinical workflow platform that follows a patient from:

**Receptionist intake → Doctor consultation → Clinical orders → Sign-off**

augmented by **3 AI agents**:

| Agent | Role | Status |
|:---|:---|:---|
| **Agent 1 — Smart Triage** | Specialty/doctor routing, acuity, pre-visit brief | ✅ Done |
| **Agent 2 — Ambient Scribe** | Audio → transcript → SOAP note | 🔄 In progress |
| **Agent 3 — CDS Orders** | Labs, meds, ICD-10, referrals + finalize | ⏳ Not started |

**Roles**

- **Receptionist** — register, triage, payment, queue  
- **Doctor** — consult, scribe, review CDS, finalize  

---

## 2. What Has Been Done

### Phase 0 — Foundation ✅

| Item | Details |
|:---|:---|
| `config.py` cleanup | Single `Settings` class: Gemini, Deepgram, JWT |
| Auth | `User` model, `POST /auth/signup`, `POST /auth/login`, `GET /auth/me` |
| Security | passlib/bcrypt (pinned `bcrypt==4.0.1`), JWT via `python-jose` |
| Seed users | `ananya@clinicalflow.demo` / `receptionist123` · `neha@clinicalflow.demo` / `doctor123` |
| Schema additions | Patient intake/queue fields; `TriageResult`, `Encounter`, `Payment`; Consultation `soap_note` + `encounter_status` |
| ID helpers | `USR-`, `TRI-`, `ENC-`, `PAY-`, `PAT-`, etc. |

### Phase 1 — Receptionist Experience ✅

| Endpoint | Purpose |
|:---|:---|
| `POST /patients` | Register a new patient |
| `POST /patients/{patient_id}/checkin` | Check-in + run Agent 1 triage |
| `POST /payments` | Mock payment (Cash / Card / UPI / Insurance) |
| `GET /queue?doctor_id=...` | Patients waiting for one doctor |
| `GET /queue/all` | All doctor queues |

**Agent 1 (`triage_agent.py`)**

- Gemini primary (when API key works)  
- Rules-based fallback if AI unavailable  
- Assigns doctor from `specialists` table (least loaded, available)  
- Saves `TriageResult`, updates patient `queue_status` → `Waiting`

### Phase 2 — Doctor Scribe 🔄

| Item | Status |
|:---|:---|
| Existing upload / transcribe / process | Already in codebase |
| `scribe_agent.py` + `POST /consultations/{id}/scribe` | Being added / tested |
| SOAP on Consultation + Encounter | Planned as part of `/scribe` |

### Phase 3+ ⏳

- Agent 3 CDS (`cds_orders_agent.py`)  
- `POST /consultations/{id}/cds`  
- `POST /encounters/{id}/finalize`  
- Frontend role flows, tests, Docker/Postgres  

---

## 3. Working Flow (What Works Today)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│ 1. Register │ --> │ 2. Check-in  │ --> │ 3. Payment  │ --> │ 4. In Queue │
│   Patient   │     │  + Triage    │     │   (mock)    │     │  (Waiting)  │
└─────────────┘     │  (Agent 1)   │     └─────────────┘     └─────────────┘
                    └──────────────┘
                           │
                           ▼
                    Pre-visit brief
                    Assigned doctor
                    Acuity + risk
```

### Step-by-step (verified)

1. **Start backend** (from `backend/`, venv active):

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

2. **Auth (optional for current open APIs)**  
   - Docs: http://127.0.0.1:8000/docs  
   - `POST /auth/login` with receptionist credentials  
   - `GET /auth/me` with `Authorization: Bearer <token>`

3. **Register patient** — `POST /patients`

4. **Check-in + triage** — `POST /patients/{id}/checkin`  
   - Body includes `chief_complaint`  
   - Returns specialty, doctor, acuity, pre-visit brief  
   - Patient → `queue_status = "Waiting"`

5. **Payment** — `POST /payments`  
   - Example: amount `500`, method `UPI`  
   - Returns `PAY-0001`, `status: "Completed"`

6. **View queue** — `GET /queue?doctor_id=SPC-XXXX` or `GET /queue/all`  
   - Patient appears under assigned doctor

### Next in the flow (Phase 2 — not fully verified yet)

7. Doctor starts consult → upload/record audio  
8. `POST /consultations/{id}/scribe` → transcript + SOAP (Agent 2)  
9. Later: CDS suggestions + finalize (Agent 3)

---

## 4. Key Files Added / Changed

```
backend/app/
  config.py                          # cleaned Settings
  auth/
    security.py
    dependencies.py
  models/
    user.py
    triage_result.py
    encounter.py
    payment.py
    patient.py                       # + queue / contact fields
    consultation.py                  # + soap_note, encounter_status
  routers/
    auth.py
    triage.py
    payments.py
    queue.py
    patients.py                      # + POST /patients
  services/
    agents/
      triage_agent.py                # Agent 1 ✅
      scribe_agent.py                # Agent 2 🔄
    ids.py                           # new ID helpers
  seed.py                            # + seed_users
  main.py                            # routers + seed_users wired
```

---

## 5. Demo Accounts

| Email | Password | Role |
|:---|:---|:---|
| `ananya@clinicalflow.demo` | `receptionist123` | Receptionist |
| `neha@clinicalflow.demo` | `doctor123` | Doctor |

---

## 6. How to Test (Swagger recommended)

Open **http://127.0.0.1:8000/docs**

| Order | Endpoint | What to check |
|:---|:---|:---|
| 1 | `POST /auth/login` | Token returned |
| 2 | `POST /patients` | New `PAT-xxxx` |
| 3 | `POST /patients/{id}/checkin` | Triage result + doctor |
| 4 | `POST /payments` | `Completed` payment |
| 5 | `GET /queue/all` | Patient under assigned doctor |
| 6 | `POST /consultations/upload` then `/scribe` | SOAP (Phase 2) |

---

## 7. Known Notes / Gotchas

- **SQLite + schema changes:** after model changes, delete `backend/clinical.db` and restart so tables recreate (dev only).  
- **Queue empty?** Payment does not enqueue — only check-in sets `Waiting`. Re-run check-in after a DB reset.  
- **Specialty mismatch:** Gemini may return `"Endocrinology"` while specialists are `"Endocrinologist"` — fuzzy match can fall through to least-loaded doctor (e.g. Nephrologist). Improve matching later.  
- **Sync long requests:** a hung sync handler can block the whole uvicorn process (`/health` hangs too). Kill and restart if that happens. Prefer not using long `time.sleep` on the event loop.  
- **Swagger Authorize:** OAuth2 form expects `username`/`password`; our login is JSON `email`/`password`. Prefer Try it out on `POST /auth/login`, then pass Bearer token manually if needed.  
- **Use the project venv:** `backend/.venv` — install packages with that pip so uvicorn sees them.

---

## 8. Progress Checklist

- [x] Phase 0 — Config, auth, models, seed users  
- [x] Phase 1 — Patients, triage, payment, queue  
- [ ] Phase 2 — Scribe agent + SOAP endpoint (in progress)  
- [ ] Phase 3 — CDS agent + encounter finalize  
- [ ] Phase 4 — Audit polish / error handling  
- [ ] Phase 5 — Tests  
- [ ] Phase 6 — Postgres, Docker, CI  
- [ ] Frontend — role-based UI for the same flow  

---

## 9. Related Docs

- Full build plan: [`Project_Plan.md`](./Project_Plan.md)  
- Run backend from `backend/` with venv active on port **8000**  
- Frontend (when started) is separate; this file tracks **backend** progress only
