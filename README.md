# Clinical Referral Workflow

A clinical referral workflow system with an AI-powered agent pipeline, built as a monorepo with a FastAPI backend and a React (TanStack Start) frontend.

## Project Structure

```
├── backend/        # FastAPI + SQLAlchemy service
├── frontend/       # React + TanStack Start + Vite app
├── AGENTS.md       # Lovable integration notes
└── PROJECT_EXPLAINED.md
```

## Getting Started

### Prerequisites

- **Python 3.11+** with `pip`
- **Node.js 20+** with `npm` (or Bun)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The API is now running at `http://localhost:8000`. Check `http://localhost:8000/docs` for Swagger UI.

### 2. Frontend

```bash
cd frontend
npm install      # or: bun install
npm run dev      # or: bun run dev
```

The Vite dev server starts at `http://localhost:5173`. API calls to `/api/*` are automatically proxied to the backend on port 8000.

### Environment Variables (Frontend)

Copy `frontend/.env.example` → `frontend/.env` and customise:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `/api` (Vite proxy) | Override for production deployments |
| `VITE_ENVIRONMENT_LABEL` | `Demo / Synthetic Data` | Label shown in the UI |

### Convenience Scripts (from root)

```bash
npm run dev:backend    # Start FastAPI with hot-reload
npm run dev:frontend   # Start Vite dev server
npm run build:frontend # Production build
```
