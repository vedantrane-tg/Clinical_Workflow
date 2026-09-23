import re
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

NAME_RE = re.compile(r"^[A-Za-z][A-Za-z .'-]{1,118}$")
NAME_PART_RE = re.compile(r"^[A-Za-z][A-Za-z'-]{0,58}$")
PHONE_E164_RE = re.compile(r"^\+[1-9]\d{7,14}$")
PINCODE_RE = re.compile(r"^[1-9]\d{5}$")
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
INSURANCE_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-_/]{2,62}$")
ICD10_RE = re.compile(r"^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$", re.IGNORECASE)

# Country-specific national-number checks keyed by dial code (without +).
PHONE_RULES: dict[str, re.Pattern[str]] = {
    "91": re.compile(r"^[6-9]\d{9}$"),
    "1": re.compile(r"^\d{10}$"),
    "44": re.compile(r"^\d{10}$"),
    "971": re.compile(r"^[5]\d{8}$"),
    "65": re.compile(r"^[689]\d{7}$"),
    "61": re.compile(r"^[4]\d{8}$"),
    "977": re.compile(r"^[9]\d{9}$"),
    "94": re.compile(r"^[7]\d{8}$"),
}


def _empty_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


class CreatePatientIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=60)
    middle_name: str | None = None
    last_name: str = Field(min_length=1, max_length=60)
    date_of_birth: str  # "YYYY-MM-DD"
    gender: str  # "Male" | "Female" | "Other"
    contact_phone: str = Field(min_length=8, max_length=20)
    contact_email: str | None = None
    insurance_id: str | None = None
    address: str = Field(min_length=5, max_length=512)
    pincode: str = Field(min_length=6, max_length=6)
    guardian_name: str | None = None
    guardian_relationship: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None
    conditions: list[dict] = []
    medications: list[dict] = []

    @field_validator("first_name", "last_name")
    @classmethod
    def validate_name_part(cls, value: str) -> str:
        part = value.strip()
        if not NAME_PART_RE.match(part):
            raise ValueError("Use letters only (hyphens and apostrophes allowed)")
        return part

    @field_validator("middle_name")
    @classmethod
    def validate_middle_name(cls, value: str | None) -> str | None:
        middle = _empty_to_none(value)
        if middle is None:
            return None
        if not NAME_PART_RE.match(middle):
            raise ValueError("Use letters only (hyphens and apostrophes allowed)")
        return middle

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(p for p in parts if p)

    @field_validator("date_of_birth")
    @classmethod
    def validate_dob(cls, value: str) -> str:
        try:
            dob = date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("date_of_birth must be YYYY-MM-DD") from exc
        today = date.today()
        if dob > today:
            raise ValueError("Date of birth cannot be in the future")
        if dob.year < 1900:
            raise ValueError("Date of birth year must be 1900 or later")
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        if age > 120:
            raise ValueError("Date of birth is not realistic")
        return value

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, value: str) -> str:
        if value not in ("Male", "Female", "Other"):
            raise ValueError("gender must be Male, Female, or Other")
        return value

    @field_validator("contact_phone")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        raw = re.sub(r"[\s\-()]", "", value.strip())
        if not raw:
            raise ValueError("Phone is required")

        # Bare digits: only accept Indian 10-digit mobiles (auto +91).
        if raw.isdigit():
            if len(raw) != 10:
                raise ValueError(
                    "Enter a 10-digit Indian mobile, or include country code like +919876543210"
                )
            if not PHONE_RULES["91"].match(raw):
                raise ValueError("Invalid Indian mobile number (must start with 6–9)")
            raw = f"+91{raw}"
        elif not raw.startswith("+"):
            raw = f"+{raw}"

        if not PHONE_E164_RE.match(raw):
            raise ValueError("Phone must include country code, e.g. +919876543210")

        digits = raw[1:]
        for dial, pattern in sorted(PHONE_RULES.items(), key=lambda item: -len(item[0])):
            if digits.startswith(dial):
                national = digits[len(dial) :]
                if not pattern.match(national):
                    raise ValueError(f"Invalid phone number for +{dial}")
                return f"+{dial}{national}"

        raise ValueError(
            "Unsupported country code. Use a supported code such as +91, +1, or +44"
        )
    @field_validator("contact_email")
    @classmethod
    def validate_email(cls, value: str | None) -> str | None:
        email = _empty_to_none(value)
        if email is None:
            return None
        if len(email) > 255 or not EMAIL_RE.match(email):
            raise ValueError("Invalid email address")
        return email.lower()

    @field_validator("insurance_id")
    @classmethod
    def validate_insurance(cls, value: str | None) -> str | None:
        insurance = _empty_to_none(value)
        if insurance is None:
            return None
        if not INSURANCE_RE.match(insurance):
            raise ValueError("Insurance ID must be 3–63 alphanumeric characters")
        return insurance

    @field_validator("guardian_name")
    @classmethod
    def validate_guardian(cls, value: str | None) -> str | None:
        guardian = _empty_to_none(value)
        if guardian is None:
            return None
        if not NAME_RE.match(guardian):
            raise ValueError("Guardian name must be 2–120 letters (spaces, hyphens, apostrophes allowed)")
        return guardian

    @field_validator("guardian_relationship")
    @classmethod
    def validate_guardian_relationship(cls, value: str | None) -> str | None:
        relationship = _empty_to_none(value)
        if relationship is None:
            return None
        allowed = {
            "Parent",
            "Mother",
            "Father",
            "Spouse",
            "Sibling",
            "Grandparent",
            "Legal guardian",
            "Other",
        }
        if relationship not in allowed:
            raise ValueError("Invalid guardian relationship")
        return relationship

    @field_validator("guardian_phone")
    @classmethod
    def validate_guardian_phone(cls, value: str | None) -> str | None:
        phone = _empty_to_none(value)
        if phone is None:
            return None
        return cls.validate_phone(phone)

    @field_validator("guardian_email")
    @classmethod
    def validate_guardian_email(cls, value: str | None) -> str | None:
        return cls.validate_email(value)

    @field_validator("address")
    @classmethod
    def validate_address(cls, value: str) -> str:
        address = value.strip()
        if len(address) < 5:
            raise ValueError("Address is required (at least 5 characters)")
        if len(address) > 512:
            raise ValueError("Address must be at most 512 characters")
        return address

    @field_validator("pincode")
    @classmethod
    def validate_pincode(cls, value: str) -> str:
        pincode = value.strip()
        if not PINCODE_RE.match(pincode):
            raise ValueError("Pincode must be a valid 6-digit Indian PIN code")
        return pincode

    @field_validator("conditions")
    @classmethod
    def validate_conditions(cls, value: list[dict]) -> list[dict]:
        cleaned: list[dict] = []
        for item in value or []:
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            if len(name) > 120:
                raise ValueError("Condition name is too long")
            code = str(item.get("code") or "UNSPEC").strip() or "UNSPEC"
            if code != "UNSPEC" and not ICD10_RE.match(code):
                raise ValueError(f"Invalid ICD-10 code: {code}")
            cleaned.append({**item, "name": name, "code": code.upper() if code != "UNSPEC" else code})
        return cleaned

    @field_validator("medications")
    @classmethod
    def validate_medications(cls, value: list[dict]) -> list[dict]:
        cleaned: list[dict] = []
        for item in value or []:
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            if len(name) > 120:
                raise ValueError("Medication name is too long")
            dose = str(item.get("dose") or "—").strip() or "—"
            if len(dose) > 64:
                raise ValueError("Medication dose is too long")
            cleaned.append({**item, "name": name, "dose": dose})
        return cleaned

    # conditions / medications remain optional; validated only when provided.


class PatientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    patient_id: str
    name: str
    first_name: str | None = None
    middle_name: str | None = None
    last_name: str | None = None
    date_of_birth: str
    gender: str
    age: int
    risk: str
    conditions: list
    medications: list
    encounters: list
    labs: list
    workflow_status: str
    last_encounter: str
    issues_count: int
    referrals_count: int

    # New intake / queue fields
    chief_complaint: str | None = None
    assigned_doctor_id: str | None = None
    queue_status: str = "Not Checked In"
    queue_position: int | None = None
    checked_in_at: datetime | None = None
    contact_phone: str | None = None
    contact_email: str | None = None
    insurance_id: str | None = None
    address: str | None = None
    pincode: str | None = None
    guardian_name: str | None = None
    guardian_relationship: str | None = None
    guardian_phone: str | None = None
    guardian_email: str | None = None
