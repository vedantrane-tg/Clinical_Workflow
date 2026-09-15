from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import get_current_user
from app.auth.security import create_access_token, hash_password, verify_password
from app.config import get_settings
from app.database import get_db
from app.models import User
from app.services.ids import next_user_id, utcnow

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1)
    email: str
    password: str = Field(min_length=6)
    role: str  # "Receptionist" | "Doctor"
    specialty: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    specialty: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


@router.post("/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if body.role not in ("Receptionist", "Doctor"):
        raise HTTPException(status_code=400, detail="role must be Receptionist or Doctor")
    if body.role == "Doctor" and not body.specialty:
        raise HTTPException(status_code=400, detail="specialty is required for Doctor")

    existing = db.scalar(select(User).where(User.email == body.email.lower().strip()))
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        user_id=next_user_id(db),
        full_name=body.full_name.strip(),
        email=body.email.lower().strip(),
        hashed_password=hash_password(body.password),
        role=body.role,
        specialty=body.specialty if body.role == "Doctor" else None,
        is_active=True,
        created_at=utcnow(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower().strip()))
    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="User is inactive")

    settings = get_settings()
    token = create_access_token(
        data={
            "user_id": user.user_id,
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name,
        },
        expires_delta=timedelta(minutes=settings.jwt_expiry_minutes),
    )
    return LoginResponse(access_token=token, user=user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user