# ClinicalFlow AI — Project Explained

This document explains how the repository is structured, what Lovable built, what the separate Python backend does, and how the clinical workflow actually runs today.

> **Bottom line:** The React/TanStack frontend built in Lovable is a complete demo that runs on its own using an **in-browser mock backend**. The `backend/` folder is a **separate FastAPI + SQLite API** built later. Those two systems are **not connected yet**. Your teammate’s assessment is correct.

---

## 1. What is this product?

**ClinicalFlow AI** is a demo of an **agentic clinical referral workflow**.

A clinician (or care coordinator) can:

1. Browse synthetic patients
2. Run a multi-agent workflow on a patient
3. See EHR extraction, an AI clinical summary, and automatic specialist referrals
4. Manage referrals, specialists, referral rules, and an audit trail

All data is **synthetic / demo-only**. It is not for real clinical use.

---

## 2. High-level architecture (current state)

There are effectively **two independent applications** in one repo:

```text
┌─────────────────────────────────────────────────────────────┐
│  LOVABLE APP (root of repo)                                 │
│  TanStack Start + React + TypeScript + Tailwind             │
│                                                             │
│  UI pages  →  clinicalApi  →  mock services (in memory)     │
│                             →  optional Gemini via          │
│                                TanStack server function     │
│                                                             │
│  Runs with: npm run dev                                     │
│  Does NOT call Python backend                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  PYTHON BACKEND (backend/)                                  │
│  FastAPI + SQLAlchemy + SQLite                              │
│                                                             │
│  REST API  →  SQLite (clinical.db)                          │
│            →  optional Gemini for summaries                 │
│                                                             │
│  Runs with: uvicorn app.main:app --reload --port 8000       │
│  Tested via Swagger at /docs                                │
│  Does NOT serve the React UI                                │
└─────────────────────────────────────────────────────────────┘
```

They share a **similar domain model** (patients, referrals, rules, workflows, audit) and a **similar 3-agent idea**, but they do not share a database, process, or HTTP connection today.

---

## 3. What Lovable created

### 3.1 Evidence this is a Lovable project

| Signal | Location |
| --- | --- |
| Lovable README / GitHub sync notes | `README.md`, `AGENTS.md` |
| Lovable project metadata | `.lovable/project.json` |
| Lovable Vite/TanStack config package | `@lovable.dev/vite-tanstack-config` in `package.json` / `vite.config.ts` |
| Lovable error reporting | `src/lib/lovable-error-reporting.ts` |
| Template | `tanstack_start_ts` (TanStack Start + TypeScript) |

Lovable generated the **frontend application** (UI, routing, components, mock data layer, and a small Node/server-function path for Gemini). It did **not** create the Python `backend/` folder — that was added separately later.

### 3.2 Tech stack of the Lovable frontend

| Layer | Technology | Role |
| --- | --- | --- |
| Framework | **TanStack Start** (`@tanstack/react-start`) | Full-stack React framework (SSR-capable) |
| UI library | **React 19** | Components and pages |
| Language | **TypeScript** | Types for clinical domain + app code |
| Routing | **TanStack Router** (file-based) | Routes under `src/routes/` |
| Data fetching | **TanStack Query** | Caching, mutations, invalidation |
| Styling | **Tailwind CSS v4** + shadcn/Radix UI | Layout and UI primitives |
| Forms / validation | react-hook-form, zod | Form handling where used |
| Charts / icons | recharts, lucide-react | Dashboard visuals |
| Build tool | **Vite 8** | Dev server + production build |
| Package manager | npm / bun lockfiles present | Dependencies |
| Optional AI | **Vercel AI SDK** + Google Gemini | Clinical narrative generation via server function |

### 3.3 Frontend folder map

```text
src/
  api/
    clinicalApi.ts      # ONLY API the UI should call
    config.ts           # VITE_API_BASE_URL, USE_MOCK_BACKEND, endpoints
  components/
    layout/             # AppShell, sidebar, header
    ui/                 # shadcn/Radix primitives
    workflow/           # Agent graph visualization
    common/             # Shared UI bits
  data/                 # Seed synthetic patients, specialists, rules
  hooks/
    useClinicalQueries.ts  # React Query wrappers
    useSession.tsx         # Demo login / roles / permissions
  lib/
    clinicalAi.functions.ts  # TanStack server fn → Gemini
    ai-gateway.server.ts
  routes/               # Pages (file-based routing)
  services/
    aws/interfaces.ts   # Contracts for HealthLake / Bedrock / DynamoDB / SNS
    mock/               # In-memory implementations of those contracts
    agents/             # 3-agent workflow orchestration
  types/clinical.ts     # Shared domain types
```

### 3.4 App pages (routes)

| Route file | URL | Purpose |
| --- | --- | --- |
| `index.tsx` | `/` | Dashboard |
| `patients.index.tsx` | `/patients` | Patient list |
| `patients.$patientId.tsx` | `/patients/:patientId` | Patient detail + run workflow |
| `workflows.tsx` | `/workflows` | Workflow monitor |
| `referrals.tsx` | `/referrals` | Referral list / updates |
| `specialists.tsx` | `/specialists` | Specialist directory |
| `rules.tsx` | `/rules` | Enable/disable referral rules |
| `audit.tsx` | `/audit` | Audit trail |
| `settings.tsx` | `/settings` | Env label, mock vs live API indicator |

Shell/layout: `src/routes/__root.tsx` wraps every page with sidebar + session + React Query.

---

## 4. How the Lovable frontend “backend” works

This is the most important mental model.

The UI never talks to DynamoDB/HealthLake/Bedrock directly, and it also **does not call the Python FastAPI**. It talks only to:

```text
UI / hooks  →  clinicalApi  →  mock services + agent workflow
```

### 4.1 `clinicalApi` (the contract)

File: `src/api/clinicalApi.ts`

This is a single facade. Every method is documented as mapping 1:1 to a future REST route (API Gateway + Lambda in a target AWS architecture). Examples:

- `listPatients()` → GET `/patients`
- `runWorkflow(...)` → POST `/patients/{id}/workflow/run`
- `createReferral(...)` → POST `/referrals`
- `listAudit()` → GET `/audit`

Today, **every method calls the mock layer**, not `fetch()`.

### 4.2 Config: mock vs future live API

File: `src/api/config.ts`

```ts
API_BASE_URL = VITE_API_BASE_URL ?? ""
USE_MOCK_BACKEND = API_BASE_URL === ""
```

- If `VITE_API_BASE_URL` is **not set** (current default): use mocks.
- If it **were** set: the *intention* is to talk to a live API (comments mention Amazon API Gateway). That live HTTP client path is **not fully wired** yet — `clinicalApi` still hard-calls mocks.

Settings page shows “Mock service layer” vs “Live API Gateway” based on this flag.

### 4.3 In-memory store

File: `src/services/mock/store.ts`

On first use, the app seeds:

- Synthetic patients (`src/data/patients.ts`)
- Specialists (`src/data/specialists.ts`)
- Referral rules (`src/data/referralRules.ts`)
- Empty referrals/workflows, plus one initial audit entry

Data lives in a **process/global in-memory object**. Refreshing the browser resets it (unless something else persists it — currently it does not persist to disk).

### 4.4 Mock AWS services

The frontend is designed as if production would use AWS:

| Interface | Mock file | Pretends to be |
| --- | --- | --- |
| `HealthLakeService` | `mock/healthLake.ts` | AWS HealthLake / FHIR patient data |
| `BedrockService` | `mock/bedrock.ts` | Amazon Bedrock LLM for summaries |
| `DynamoDBService` | `mock/dynamodb.ts` | Persistence for EHR, summaries, referrals, audit, workflows |
| `NotificationService` | `mock/sns.ts` | Amazon SNS referral notifications |

Interfaces live in `src/services/aws/interfaces.ts`. The idea: swap mocks for real AWS clients later **without rewriting the UI**.

### 4.5 Demo auth / roles

File: `src/hooks/useSession.tsx`

There is **no real Cognito login**. Session is a demo switch between:

| Role | Example user | Can run workflow | Can override referral | Can edit rules |
| --- | --- | --- | --- | --- |
| Clinician | Dr. Neha Kapoor | Yes | No | Yes |
| Care Coordinator | Sameer Joshi | No | Yes | No |

Permissions mirror what Cognito groups would do in a future production design.

---

## 5. The clinical workflow (3 agents) — frontend path

When a clinician clicks **Run workflow** on a patient page:

```text
useRunWorkflow (React Query mutation)
        │
        ▼
clinicalApi.runWorkflow(patientId, actor, onUpdate)
        │
        ▼
mockAgentWorkflow()   ← src/services/agents/workflowGraph.ts
        │
        ├── Agent 1: EHR Extractor
        │     healthLake.extractEHR → save EHR → audit
        │
        ├── Agent 2: Patient Summary
        │     bedrock.generateClinicalSummary → save summary → audit
        │     (may call Gemini via TanStack server function)
        │
        └── Agent 3: Referral Orchestrator
              match flagged issues to rules → pick specialist
              → create referral(s) → SNS mock notify → audit
```

### Agent responsibilities

| Agent ID | Name | Does | Does not |
| --- | --- | --- | --- |
| `ehr-extractor` | EHR Extractor | Pull/structure patient chart | Summarize or create referrals |
| `patient-summary` | Patient Summary | Generate narrative + flag issues | Create referrals |
| `referral-orchestrator` | Referral Orchestrator | Apply rules, assign specialist, create referrals | Re-interpret clinical data |

Status progresses roughly:

`Queued → Extracting → Summarizing → Orchestrating Referral → Completed` (or `Failed`)

The UI can show live step updates via `onUpdate` while the mock workflow runs (with artificial latency so the agent graph animation is visible).

### Where AI fits in the frontend

- Rule matching / issue flagging is largely **deterministic** (labs + referral rules).
- Narrative text can optionally come from **Google Gemini** through:
  - `src/lib/clinicalAi.functions.ts` (`generateAiNarrative` server function)
  - Requires env `GOOGLE_GENERATIVE_AI_API_KEY`
- If the key is missing, the mock Bedrock path falls back to template/rules-based text.

So Lovable’s “backend” is:

1. **Browser mock services** (always)
2. **Optional Node server function for Gemini** (when API key is set)

It is **not** the Python FastAPI app.

---

## 6. What the Python `backend/` folder is

### 6.1 Purpose

A standalone **Clinical Referral API** for learning/demo, documented in `backend/README.md`:

> “This backend is standalone and can be tested via Swagger UI — it is not connected to the React frontend yet.”

### 6.2 Tech stack

| Piece | Technology |
| --- | --- |
| Language | Python 3.x (README mentions 3.13) |
| API framework | **FastAPI** |
| ORM | **SQLAlchemy** |
| Database | **SQLite** (`backend/clinical.db`, created on first run) |
| Server | **Uvicorn** |
| Validation | Pydantic (via FastAPI schemas) |
| Optional AI | `google-genai` + Gemini (`GOOGLE_GENERATIVE_AI_API_KEY`) |

### 6.3 Backend folder map

```text
backend/
  requirements.txt
  README.md
  clinical.db              # created at runtime
  app/
    main.py                # FastAPI app + lifespan seed
    database.py            # SQLite engine/session
    config.py              # Gemini settings from .env
    seed.py                # Demo patients/specialists/rules
    models/                # SQLAlchemy tables
    schemas/               # Pydantic request/response models
    routers/               # HTTP endpoints
    services/
      workflow.py          # 3-agent style workflow
      ai_summary.py        # Gemini narrative
      ids.py               # ID helpers + audit writer
```

### 6.4 Main API endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/patients` | List patients |
| GET | `/patients/{id}` | Get patient |
| POST | `/patients/{id}/workflow/run` | Run workflow |
| GET | `/specialists` | List specialists |
| GET | `/referral-rules` | List rules |
| GET/POST | `/referrals` | List / create referrals |
| GET/PATCH | `/referrals/{id}` | Get / update referral |
| GET | `/workflows` | Workflow history |
| GET | `/audit` | Audit log |

On startup (`main.py` lifespan): create tables + seed demo data.

### 6.5 Backend workflow (similar idea, different implementation)

`backend/app/services/workflow.py` also implements a 3-step pipeline:

1. **EHR extraction** — copy patient chart into `ExtractedEHR` table  
2. **Clinical summary** — match lab rules, optionally call Gemini, store `ClinicalSummary`  
3. **Referral orchestration** — create `Referral` rows for matched rules, pick available specialists  

Data is **persisted in SQLite**, so it survives restarts (until you delete `clinical.db`).

---

## 7. Are frontend and Python backend connected?

**No.** Confirmed by:

1. Explicit statement in `backend/README.md`
2. Frontend `clinicalApi` only importing mock modules — no `fetch` to `localhost:8000`
3. `USE_MOCK_BACKEND` / `VITE_API_BASE_URL` prepared for a future live API, but live client not implemented in `clinicalApi`
4. Backend README “What’s Next” includes: *Connect frontend via `VITE_API_BASE_URL`*

So today:

| Action | Where it happens |
| --- | --- |
| Open the UI, browse patients, run workflow | Lovable frontend + in-memory mocks |
| Hit Swagger, POST workflow, inspect SQLite | Python FastAPI only |
| Do they share patients/referrals? | **No** — separate datasets/stores |

They are **parallel implementations** of the same product idea.

---

## 8. Step-by-step: how everything works when you use the UI

1. Run `npm i` then `npm run dev` at repo root.
2. Vite + TanStack Start serves the React app.
3. Root layout mounts `SessionProvider`, `AppShell`, and React Query.
4. A page (e.g. Patients) calls a hook like `usePatients()`.
5. Hook calls `clinicalApi.listPatients()`.
6. That reads from the mock HealthLake → in-memory store seeded from `src/data/patients.ts`.
7. User opens a patient and runs the workflow.
8. `mockAgentWorkflow` runs agents 1 → 2 → 3 with delays and status updates.
9. Referrals/audit/workflows are written into the same in-memory store.
10. React Query invalidates caches so lists refresh.
11. Optional: if Gemini key exists, summary narrative may be generated via the TanStack server function.

**At no point does this call the FastAPI server.**

---

## 9. Step-by-step: how the Python backend works alone

1. `cd backend`, create venv, `pip install -r requirements.txt`.
2. `uvicorn app.main:app --reload --port 8000`.
3. Lifespan creates SQLite tables and seeds data.
4. Open `http://127.0.0.1:8000/docs`.
5. Call `POST /patients/PAT-1001/workflow/run` with an actor payload.
6. FastAPI runs rule matching (+ optional Gemini), writes EHR/summary/referrals/workflow/audit into SQLite.
7. Inspect results with GET endpoints.

This is the correct way to develop/test the Python API until the frontend is wired to it.

---

## 10. Target / intended future architecture (designed, not fully built)

Comments and interfaces in the frontend describe a production-shaped design:

```text
Browser (React)
    │
    ▼
Amazon API Gateway
    │
    ▼
Lambda / agents
    ├── HealthLake (FHIR EHR)
    ├── Bedrock (clinical LLM)
    ├── DynamoDB (state, referrals, audit)
    └── SNS (notifications)
```

Plus Cognito for real auth (roles already sketched in `useSession`).

The Python FastAPI backend is currently a **local stand-in** for that API surface (SQLite instead of DynamoDB, Gemini instead of Bedrock, etc.), but integration is still TODO.

---

## 11. How to run each part

### Frontend (Lovable app)

```bash
# from repo root
npm i
npm run dev
```

Optional for AI narratives:

```bash
# set in env for the TanStack server
GOOGLE_GENERATIVE_AI_API_KEY=your_key
```

### Python backend

```bash
cd backend
py -m venv .venv
source .venv/Scripts/activate   # Git Bash on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Optional for AI:

```bash
# backend/.env
GOOGLE_GENERATIVE_AI_API_KEY=your_key
```

Swagger: `http://127.0.0.1:8000/docs`

---

## 12. Comparison cheat sheet

| Topic | Lovable frontend | Python `backend/` |
| --- | --- | --- |
| Built by | Lovable (primarily) | Teammate / separate work |
| Language | TypeScript / React | Python |
| Persistence | In-memory JS store | SQLite |
| API style | Mock functions (no HTTP to backend) | Real REST HTTP |
| Agents | `workflowGraph.ts` + `agents.ts` | `services/workflow.py` |
| AI | TanStack server fn + Gemini | `ai_summary.py` + Gemini |
| UI | Full ClinicalFlow UI | Swagger only |
| Connected to each other? | **No** | **No** |

---

## 13. Practical takeaways for you

1. **Treat the root app as the product UI** — it already works end-to-end with mocks.
2. **Treat `backend/` as a real API prototype** — richer persistence, testable via Swagger, not used by the UI yet.
3. **Lovable’s “backend”** = mock AWS service layer + optional Gemini server function inside the TanStack app — **not** the FastAPI folder.
4. **Next integration step** (when the team is ready): change `clinicalApi` to `fetch` from FastAPI when `VITE_API_BASE_URL=http://127.0.0.1:8000`, align payloads/types, and enable CORS on FastAPI.

---

## 14. Disclaimer

AI-generated and rule-based clinical outputs in this project are for **decision-support demonstration only**. They must not be used as real medical advice or production clinical decision systems without proper validation, compliance, and clinician oversight.
