import json
from typing import Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.auth import decode_access_token, oauth2_scheme, verify_password
from app.database import get_db
from app.core.constants import COMPANY_ADMIN_ROLES


# ---------------------------------------------------------
# PORTAL ACCESS CONFIG
# ---------------------------------------------------------

ALLOWED_PORTALS = [
    "people-onboarding",
    "users",
    "attendance",
    "tasks",
    "sales",
    "projects",
    "freelancers",
    "reports",
    "settings",
]

FULL_ACCESS_ROLES = [
    "super-admin",
    "company-admin",
    "admin",
    "owner",
]

DEFAULT_PORTAL_ACCESS_BY_ROLE = {
    "super-admin": ALLOWED_PORTALS,
    "company-admin": ALLOWED_PORTALS,
    "admin": ALLOWED_PORTALS,
    "owner": ALLOWED_PORTALS,
    "hr": [
        "people-onboarding",
        "users",
        "attendance",
        "tasks",
        "freelancers",
        "reports",
        "settings",
    ],
    "manager": [
        "people-onboarding",
        "users",
        "attendance",
        "tasks",
        "sales",
        "projects",
        "freelancers",
        "reports",
        "settings",
    ],
    "accountant": [
        "attendance",
        "tasks",
        "reports",
        "settings",
    ],
    "employee": [
        "attendance",
        "tasks",
        "settings",
    ],
    "intern": [
        "attendance",
        "tasks",
        "settings",
    ],
    "sales-representative": [
        "attendance",
        "tasks",
        "sales",
        "settings",
    ],
    "freelancer": [
        "attendance",
        "tasks",
        "settings",
    ],
}


# ---------------------------------------------------------
# NORMALIZERS
# ---------------------------------------------------------

def normalize_role(role: Optional[str]):
    return (
        str(role or "")
        .strip()
        .lower()
        .replace("_", "-")
        .replace(" ", "-")
    )


def normalize_portal(portal: Optional[str]):
    return (
        str(portal or "")
        .strip()
        .lower()
        .replace("_", "-")
        .replace(" ", "-")
    )


def parse_portal_access(value, role: Optional[str] = None) -> list[str]:
    if value is None or value == "":
        return DEFAULT_PORTAL_ACCESS_BY_ROLE.get(
            normalize_role(role),
            ["attendance", "tasks", "settings"],
        )

    if isinstance(value, list):
        raw_access = value
    elif isinstance(value, str):
        try:
            raw_access = json.loads(value)
        except Exception:
            raw_access = []
    else:
        raw_access = []

    if not isinstance(raw_access, list):
        raw_access = []

    cleaned_access = []

    for item in raw_access:
        portal = normalize_portal(item)

        if portal in ALLOWED_PORTALS and portal not in cleaned_access:
            cleaned_access.append(portal)

    if not cleaned_access:
        cleaned_access = DEFAULT_PORTAL_ACCESS_BY_ROLE.get(
            normalize_role(role),
            ["attendance", "tasks", "settings"],
        )

    return cleaned_access


def encode_portal_access(value, role: Optional[str] = None) -> str:
    return json.dumps(parse_portal_access(value, role))


# ---------------------------------------------------------
# AUTH USER
# ---------------------------------------------------------

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    email = payload.get("sub")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user = db.query(models.User).filter(
        models.User.email == email
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive",
        )

    return user


def require_roles(allowed_roles: list[str]):
    normalized_allowed_roles = [normalize_role(role) for role in allowed_roles]

    def checker(current_user: models.User = Depends(get_current_user)):
        if normalize_role(current_user.role) not in normalized_allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission for this action",
            )

        return current_user

    return checker


def has_portal_access(user: models.User, portal: str) -> bool:
    user_role = normalize_role(user.role)

    if user_role in FULL_ACCESS_ROLES:
        return True

    portal_name = normalize_portal(portal)

    if portal_name not in ALLOWED_PORTALS:
        return False

    access_list = parse_portal_access(
        getattr(user, "portal_access", None),
        user.role,
    )

    return portal_name in access_list


def require_portal_access(portal: str):
    def checker(current_user: models.User = Depends(get_current_user)):
        if not has_portal_access(current_user, portal):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You do not have access to {portal} portal",
            )

        return current_user

    return checker


def authenticate_user(db: Session, email: str, password: str):
    user = db.query(models.User).filter(
        models.User.email == email
    ).first()

    if not user:
        return None

    if not verify_password(password, user.hashed_password):
        return None

    return user


def user_to_dict(user: models.User):
    return {
        "id": user.id,
        "company_id": user.company_id,
        "person_id": user.person_id,
        "full_name": user.full_name,
        "name": user.full_name,
        "username": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "role": user.role,
        "department": user.department,
        "portal_access": parse_portal_access(
            getattr(user, "portal_access", None),
            user.role,
        ),
        "salary_type": user.salary_type,
        "salary_amount": user.salary_amount,
        "joining_date": user.joining_date.isoformat()
        if user.joining_date
        else None,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat()
        if user.created_at
        else None,
    }


# ---------------------------------------------------------
# ROLE HELPERS
# ---------------------------------------------------------

def is_company_admin_user(user: models.User):
    return normalize_role(user.role) in [
        normalize_role(role) for role in COMPANY_ADMIN_ROLES
    ]


def is_company_level_report_user(user: models.User):
    return normalize_role(user.role) in {
        "super-admin",
        "company-admin",
        "hr",
        "manager",
        "accountant",
    }


def is_full_access_user(user: models.User):
    return normalize_role(user.role) in FULL_ACCESS_ROLES


def can_view_company_level_data(user: models.User):
    return normalize_role(user.role) in {
        "super-admin",
        "company-admin",
        "admin",
        "owner",
        "hr",
        "manager",
        "accountant",
    }


# ---------------------------------------------------------
# TASK HELPERS
# ---------------------------------------------------------

def normalize_task_status(status: str):
    if not status:
        return status

    status = status.strip().lower()

    if status == "in_progress":
        return "in-progress"

    return status