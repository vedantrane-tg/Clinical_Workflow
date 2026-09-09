from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import models  # noqa: F401
from app.database import Base, SessionLocal, engine
from app.routers import patients, specialists, rules, referrals, audit, workflows
from app.seed import seed_patients, seed_specialists, seed_referral_rules, seed_audit
from app.routers import patients, specialists, rules, referrals, audit, workflows, consultations


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_patients(db)
        seed_specialists(db)
        seed_referral_rules(db)
        seed_audit(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Clinical Referral API", lifespan=lifespan)
app.include_router(patients.router)
app.include_router(specialists.router)
app.include_router(rules.router)
app.include_router(referrals.router)   
app.include_router(audit.router)
app.include_router(workflows.router)
app.include_router(consultations.router)

@app.get("/health")
def health():
    return {"status": "ok"}

