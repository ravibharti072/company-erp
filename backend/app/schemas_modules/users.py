from datetime import date, datetime
from typing import Optional
import json

from pydantic import BaseModel, EmailStr, Field, field_validator


# ---------------------------------------------------------
# PEOPLE / ONBOARDING SCHEMAS
# ---------------------------------------------------------
# People are company members: employee, intern, freelancer,
# sales representative, etc.
#
# Important:
# A person can be onboarded without software login access.
# Software login access is created separately in UserCreate.
# ---------------------------------------------------------


class PersonCreate(BaseModel):
    company_id: Optional[int] = None

    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    person_type: str = "employee"
    department: Optional[str] = None
    designation: Optional[str] = None

    salary_type: Optional[str] = "unpaid"
    salary_amount: Optional[float] = 0

    joining_date: Optional[date] = None

    status: Optional[str] = "active"
    notes: Optional[str] = None


class PersonUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    person_type: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None

    salary_type: Optional[str] = None
    salary_amount: Optional[float] = None

    joining_date: Optional[date] = None

    status: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class PersonResponse(BaseModel):
    id: int
    company_id: int

    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    person_type: str
    department: Optional[str] = None
    designation: Optional[str] = None

    salary_type: Optional[str] = None
    salary_amount: Optional[float] = None

    joining_date: Optional[date] = None

    status: str
    notes: Optional[str] = None

    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {
        "from_attributes": True
    }


# ---------------------------------------------------------
# SOFTWARE USER / LOGIN ACCESS SCHEMAS
# ---------------------------------------------------------
# Users are only for software login access.
#
# A software user can be linked to an onboarded person using
# person_id. Not every person needs a software user account.
#
# portal_access example:
# ["attendance", "tasks", "sales", "settings"]
# ---------------------------------------------------------


class UserCreate(BaseModel):
    company_id: Optional[int] = None
    person_id: Optional[int] = None

    full_name: Optional[str] = None
    email: EmailStr
    phone: Optional[str] = None
    password: str

    role: str = "employee"
    department: Optional[str] = None

    portal_access: list[str] = Field(default_factory=list)

    salary_type: Optional[str] = None
    salary_amount: Optional[float] = None

    joining_date: Optional[date] = None


class UserUpdate(BaseModel):
    person_id: Optional[int] = None

    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

    role: Optional[str] = None
    department: Optional[str] = None

    portal_access: Optional[list[str]] = None

    salary_type: Optional[str] = None
    salary_amount: Optional[float] = None

    joining_date: Optional[date] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    company_id: Optional[int] = None
    person_id: Optional[int] = None

    full_name: str
    email: EmailStr
    phone: Optional[str] = None

    role: str
    department: Optional[str] = None

    portal_access: list[str] = Field(default_factory=list)

    salary_type: Optional[str] = None
    salary_amount: Optional[float] = None
    joining_date: Optional[date] = None

    is_active: bool
    created_at: datetime

    @field_validator("portal_access", mode="before")
    @classmethod
    def parse_portal_access(cls, value):
        if value is None or value == "":
            return []

        if isinstance(value, list):
            return value

        if isinstance(value, str):
            try:
                parsed = json.loads(value)

                if isinstance(parsed, list):
                    return parsed

                return []
            except Exception:
                return []

        return []

    model_config = {
        "from_attributes": True
    }


class UserWithPersonResponse(UserResponse):
    person: Optional[PersonResponse] = None