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
        if "guardian_name" not in patient_cols:
            conn.execute(text("ALTER TABLE patients ADD COLUMN guardian_name VARCHAR(120)"))
        if "guardian_relationship" not in patient_cols:
            conn.execute(text("ALTER TABLE patients ADD COLUMN guardian_relationship VARCHAR(64)"))
        if "guardian_phone" not in patient_cols:
            conn.execute(text("ALTER TABLE patients ADD COLUMN guardian_phone VARCHAR(32)"))
        if "guardian_email" not in patient_cols:
            conn.execute(text("ALTER TABLE patients ADD COLUMN guardian_email VARCHAR(255)"))
        if "first_name" not in patient_cols:
            conn.execute(text("ALTER TABLE patients ADD COLUMN first_name VARCHAR(60)"))
        if "middle_name" not in patient_cols:
            conn.execute(text("ALTER TABLE patients ADD COLUMN middle_name VARCHAR(60)"))
        if "last_name" not in patient_cols:
            conn.execute(text("ALTER TABLE patients ADD COLUMN last_name VARCHAR(60)"))

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