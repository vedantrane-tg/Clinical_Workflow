# ClinicalFlow AI — Progress & Working Flow

> **Last updated:** 2026-09-15  
> **Status:** Backend Phases 0–3 ✅ · Frontend F0–F3 ✅ · Frontend F4 polish ✅

---

## 1. What This Project Is

ClinicalFlow AI is a full-stack clinical workflow platform:

**Receptionist intake → Doctor consultation → Clinical orders → Sign-off**

| Agent | Role | Status |
|:---|:---|:---|
| **Agent 1 — Smart Triage** | Specialty/doctor routing, acuity, pre-visit brief | ✅ |
| **Agent 2 — Ambient Scribe** | Audio → transcript → SOAP note | ✅ |
| **Agent 3 — CDS Orders** | Labs, meds, ICD-10, referrals + finalize | ✅ |

**Roles**

- **Receptionist** — register, triage, payment, queue  
- **Doctor** — consult, scribe, review CDS, finalize  

---

## 2. Backend (done)

- Auth JWT (Receptionist / Doctor), seed users  
- Patients, check-in + triage, payments, queues  
- Consultations: upload, `/scribe`, `/cds`  
- Encounters: finalize + audit logging  
- `GET /audit`, `GET /patients/{id}/triage/latest`  

Demo accounts:

- `ananya@clinicalflow.demo` / `receptionist123`  
- `neha@clinicalflow.demo` / `doctor123`  

---

## 3. Frontend (done)

| Step | Feature |
|:---|:---|
| F0 | JWT session, login/signup, role sidebar, mobile nav sheet |
| F1 | New patient → triage → payment → receptionist dashboard |
| F2 | Doctor queue → consult room → audio + SOAP |
| F3 | Clinical orders (CDS) → approve → finalize |
| F4 | Audit trail UX, QueryError retries, acuity/queue badges, page transitions, query retries |

---

## 4. End-to-end path

```
Login (Receptionist)
  → New Patient
  → Triage (Agent 1)
  → Payment
  → Waiting queue

Login (Doctor)
  → Start consultation
  → Record/upload → Scribe (Agent 2) → SOAP
  → Clinical orders → CDS (Agent 3)
  → Sign & finalize → Completed
  → Audit Trail shows the chain
```

---

## 5. Still optional (later)

- Phase 5 — automated tests (pytest / vitest / E2E)  
- Phase 6 — Alembic, Docker, CI/CD  
- Deeper mobile polish / offline mock mode  

---

## 6. Run locally

```bash
# Backend
cd backend && py -m uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

Vite proxies `/api` → `http://127.0.0.1:8000`.
