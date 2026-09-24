from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import require_admin
from app.auth.security import hash_password
from app.database import get_db
from app.models import Appointment, User
from app.services.ids import next_user_id, utcnow, write_audit

router = APIRouter(prefix="/admin", tags=["admin"])

STAFF_ROLES = {"Receptionist", "Doctor"}


class StaffOut(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    specialty: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class CreateStaffIn(BaseModel):
    full_name: str = Field(min_length=1, max_length=120)
    email: str
    password: str = Field(min_length=6, max_length=128)
    role: str
    specialty: str | None = None


class UpdateStaffIn(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    role: str | None = None
    specialty: str | None = None
    is_active: bool | None = None


def _sync_future_doctor_name(db: Session, doctor: User) -> None:
    rows = list(db.scalars(select(Appointment).where(Appointment.doctor_id == doctor.user_id)).all())
    for row in rows:
        row.doctor_name = doctor.full_name


@router.get("/users", response_model=list[StaffOut])
def list_staff(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    rows = list(
        db.scalars(
            select(User)
            .where(User.role.in_(tuple(STAFF_ROLES)))
            .order_by(User.role.asc(), User.full_name.asc())
        ).all()
    )
    return rows


@router.post("/users", response_model=StaffOut, status_code=201)
def create_staff(
    body: CreateStaffIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if body.role not in STAFF_ROLES:
        raise HTTPException(status_code=400, detail="role must be Receptionist or Doctor")
    if body.role == "Doctor" and not (body.specialty or "").strip():
        raise HTTPException(status_code=400, detail="specialty is required for Doctor")

    email = body.email.lower().strip()
    existing = db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        user_id=next_user_id(db),
        full_name=body.full_name.strip(),
        email=email,
        hashed_password=hash_password(body.password),
        role=body.role,
        specialty=body.specialty.strip() if body.role == "Doctor" and body.specialty else None,
        is_active=True,
        created_at=utcnow(),
    )
    db.add(user)
    write_audit(
        db,
        user=admin.full_name,
        role=admin.role,
        action=f"Admin created {user.role} {user.user_id} ({user.email})",
    )
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}", response_model=StaffOut)
def update_staff(
    user_id: str,
    body: UpdateStaffIn,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.get(User, user_id)
    if not user or user.role == "Admin":
        raise HTTPException(status_code=404, detail=f"Staff user {user_id} not found")

    data = body.model_dump(exclude_unset=True)
    if "email" in data and data["email"] is not None:
        email = data["email"].lower().strip()
        taken = db.scalar(select(User).where(User.email == email, User.user_id != user.user_id))
        if taken:
            raise HTTPException(status_code=400, detail="Email already registered")
        user.email = email

    if "full_name" in data and data["full_name"] is not None:
        user.full_name = data["full_name"].strip()
        if user.role == "Doctor":
            _sync_future_doctor_name(db, user)

    if "role" in data and data["role"] is not None:
        if data["role"] not in STAFF_ROLES:
            raise HTTPException(status_code=400, detail="role must be Receptionist or Doctor")
        user.role = data["role"]
        if user.role != "Doctor":
            user.specialty = None

    if "specialty" in data:
        specialty = (data["specialty"] or "").strip() or None
        if user.role == "Doctor":
            if not specialty:
                raise HTTPException(status_code=400, detail="specialty is required for Doctor")
            user.specialty = specialty
        else:
            user.specialty = None

    if user.role == "Doctor" and not user.specialty:
        raise HTTPException(status_code=400, detail="specialty is required for Doctor")

    if "password" in data and data["password"]:
        user.hashed_password = hash_password(data["password"])

    if "is_active" in data and data["is_active"] is not None:
        user.is_active = bool(data["is_active"])

    if user.role == "Doctor":
        _sync_future_doctor_name(db, user)

    write_audit(
        db,
        user=admin.full_name,
        role=admin.role,
        action=f"Admin updated {user.role} {user.user_id}",
    )
    db.commit()
    db.refresh(user)
    return user
