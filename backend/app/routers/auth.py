import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import models
from app.auth import create_access_token, get_password_hash, verify_password
from app.database import get_db
from app.schemas_modules.auth import (
    ChangePasswordRequest,
    LoginRequest,
    TokenResponse,
)
from app.schemas_modules.users import (
    UserCreate,
    UserResponse,
)
from app.core.dependencies import (
    authenticate_user,
    get_current_user,
)


router = APIRouter(tags=["Auth"])


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


def normalize_role_value(value: str | None) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("_", "-")
        .replace(" ", "-")
    )


def parse_portal_access(value, role: str | None = None) -> list[str]:
    if value is None or value == "":
        return DEFAULT_PORTAL_ACCESS_BY_ROLE.get(
            normalize_role_value(role),
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
        portal = str(item or "").strip().lower()

        if portal in ALLOWED_PORTALS and portal not in cleaned_access:
            cleaned_access.append(portal)

    if not cleaned_access:
        cleaned_access = DEFAULT_PORTAL_ACCESS_BY_ROLE.get(
            normalize_role_value(role),
            ["attendance", "tasks", "settings"],
        )

    return cleaned_access


def encode_portal_access(value, role: str | None = None) -> str:
    return json.dumps(parse_portal_access(value, role))


def user_to_auth_dict(user: models.User) -> dict:
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


def create_login_response(user: models.User) -> dict:
    portal_access = parse_portal_access(
        getattr(user, "portal_access", None),
        user.role,
    )

    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role,
            "company_id": user.company_id,
            "portal_access": portal_access,
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_to_auth_dict(user),
    }


# -----------------------------
# FIRST SUPER ADMIN SETUP
# -----------------------------

@router.post("/setup/super-admin", response_model=UserResponse)
def create_first_super_admin(
    user: UserCreate,
    db: Session = Depends(get_db),
):
    existing_super_admin = db.query(models.User).filter(
        models.User.role == "super-admin"
    ).first()

    if existing_super_admin:
        raise HTTPException(
            status_code=400,
            detail="Super admin already exists",
        )

    existing_email = db.query(models.User).filter(
        models.User.email == user.email
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    new_user = models.User(
        company_id=None,
        full_name=user.full_name or "Super Admin",
        email=user.email,
        phone=user.phone,
        hashed_password=get_password_hash(user.password),
        role="super-admin",
        department="System",
        portal_access=encode_portal_access(ALLOWED_PORTALS, "super-admin"),
        salary_type=None,
        salary_amount=None,
        joining_date=user.joining_date,
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# -----------------------------
# AUTH APIs
# -----------------------------

@router.post("/token")
def login_for_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(
        db=db,
        email=form_data.username,
        password=form_data.password,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive. Please contact company admin.",
        )

    return create_login_response(user)


@router.post("/auth/login", response_model=TokenResponse)
def login_for_frontend(
    login_data: LoginRequest,
    db: Session = Depends(get_db),
):
    user = authenticate_user(
        db=db,
        email=login_data.email,
        password=login_data.password,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if user.is_active is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is inactive. Please contact company admin.",
        )

    return create_login_response(user)


@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return user_to_auth_dict(current_user)


@router.get("/auth/me")
def get_auth_me(current_user: models.User = Depends(get_current_user)):
    return user_to_auth_dict(current_user)


@router.put("/auth/profile")
def update_profile(
    profile_data: dict,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    full_name = (
        profile_data.get("full_name")
        or profile_data.get("name")
        or current_user.full_name
    )

    email = profile_data.get("email") or current_user.email
    department = profile_data.get("department")

    if not full_name:
        raise HTTPException(
            status_code=400,
            detail="Name is required",
        )

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Email is required",
        )

    existing_email_user = db.query(models.User).filter(
        models.User.email == email,
        models.User.id != current_user.id,
    ).first()

    if existing_email_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    current_user.full_name = full_name
    current_user.email = email

    if department is not None:
        current_user.department = department

    db.commit()
    db.refresh(current_user)

    return {
        "message": "Profile updated successfully",
        "user": user_to_auth_dict(current_user),
    }


@router.put("/auth/change-password")
def change_password(
    password_data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not verify_password(
        password_data.current_password,
        current_user.hashed_password,
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect",
        )

    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 6 characters",
        )

    current_user.hashed_password = get_password_hash(
        password_data.new_password
    )

    db.commit()

    return {
        "message": "Password changed successfully",
    }


@router.post("/auth/change-password")
def change_password_post(
    password_data: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return change_password(
        password_data=password_data,
        db=db,
        current_user=current_user,
    )