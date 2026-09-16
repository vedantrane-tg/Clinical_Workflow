from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATABASE_URL = "sqlite:///./clinical.db"

# check_same_thread=False is required for SQLite + FastAPI
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def ensure_schema() -> None:
    """Add columns that create_all will not alter on an existing SQLite DB."""
    with engine.begin() as conn:
        patient_cols = {row[1] for row in conn.execute(text("PRAGMA table_info(patients)")).fetchall()}
        if "pincode" not in patient_cols:
            conn.execute(text("ALTER TABLE patients ADD COLUMN pincode VARCHAR(16)"))

        encounter_cols = {
            row[1] for row in conn.execute(text("PRAGMA table_info(encounters)")).fetchall()
        }
        if encounter_cols:
            if "prescription" not in encounter_cols:
                conn.execute(text("ALTER TABLE encounters ADD COLUMN prescription JSON"))
            if "prescription_pdf_path" not in encounter_cols:
                conn.execute(
                    text("ALTER TABLE encounters ADD COLUMN prescription_pdf_path VARCHAR(500)")
                )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()