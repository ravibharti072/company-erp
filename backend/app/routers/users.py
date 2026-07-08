import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.auth import get_password_hash
from app.database import get_db
from app.core.constants import ALLOWED_ROLES
from app.core.dependencies import (
    get_current_user,
    normalize_role,
    require_roles,
)
from app.schemas_modules.users import (
    PersonCreate,
    PersonUpdate,
    PersonResponse,
    UserCreate,
    UserUpdate,
    UserResponse,
)


router = APIRouter(
    tags=["People & Users"],
)


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


def clean_portal_access(value) -> list[str]:
    if value is None:
        return []

    if isinstance(value, str):
        try:
            parsed_value = json.loads(value)
        except Exception:
            parsed_value = []
    else:
        parsed_value = value

    if not isinstance(parsed_value, list):
        return []

    cleaned = []

    for item in parsed_value:
        portal = str(item or "").strip().lower()

        if portal in ALLOWED_PORTALS and portal not in cleaned:
            cleaned.append(portal)

    return cleaned


def get_default_portal_access(role: str) -> list[str]:
    normalized_role = normalize_role(role)

    return DEFAULT_PORTAL_ACCESS_BY_ROLE.get(
        normalized_role,
        ["attendance", "tasks", "settings"],
    )


def encode_portal_access(value, role: str | None = None) -> str:
    cleaned = clean_portal_access(value)

    if not cleaned and role:
        cleaned = get_default_portal_access(role)

    return json.dumps(cleaned)


# ---------------------------------------------------------
# HELPERS
# ---------------------------------------------------------

def get_company_id_for_person(
    person_company_id: int | None,
    current_user: models.User,
    db: Session,
) -> int:
    if current_user.role == "super-admin":
        if not person_company_id:
            raise HTTPException(
                status_code=400,
                detail="company_id is required",
            )

        company = db.query(models.Company).filter(
            models.Company.id == person_company_id
        ).first()

        if not company:
            raise HTTPException(
                status_code=404,
                detail="Company not found",
            )

        return person_company_id

    if not current_user.company_id:
        raise HTTPException(
            status_code=400,
            detail="Company ID not found",
        )

    return current_user.company_id


def check_person_access(person: models.Person, current_user: models.User):
    if current_user.role == "super-admin":
        return

    if person.company_id != current_user.company_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot access another company person",
        )


def check_user_access(user: models.User, current_user: models.User):
    if current_user.role == "super-admin":
        return

    if user.company_id != current_user.company_id and user.id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot access this user",
        )


# ---------------------------------------------------------
# PEOPLE / ONBOARDING ROUTES
# ---------------------------------------------------------


@router.post("/people", response_model=PersonResponse)
def create_person(
    person: PersonCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager"])
    ),
):
    company_id = get_company_id_for_person(
        person_company_id=person.company_id,
        current_user=current_user,
        db=db,
    )

    salary_type = person.salary_type or "unpaid"

    new_person = models.Person(
        company_id=company_id,
        full_name=person.full_name,
        email=person.email,
        phone=person.phone,
        person_type=person.person_type,
        department=person.department,
        designation=person.designation,
        salary_type=salary_type,
        salary_amount=0 if salary_type == "unpaid" else person.salary_amount,
        joining_date=person.joining_date,
        status=person.status or "active",
        notes=person.notes,
        is_active=True,
    )

    db.add(new_person)
    db.commit()
    db.refresh(new_person)

    return new_person


@router.get("/people", response_model=list[PersonResponse])
def get_people(
    company_id: int | None = None,
    person_type: str | None = None,
    status: str | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager", "accountant"])
    ),
):
    query = db.query(models.Person)

    if current_user.role == "super-admin":
        if company_id:
            query = query.filter(models.Person.company_id == company_id)
    else:
        query = query.filter(models.Person.company_id == current_user.company_id)

    if person_type:
        query = query.filter(models.Person.person_type == person_type)

    if status:
        query = query.filter(models.Person.status == status)

    if is_active is not None:
        query = query.filter(models.Person.is_active == is_active)

    return query.order_by(models.Person.id.desc()).all()


@router.get("/people/{person_id}", response_model=PersonResponse)
def get_person(
    person_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    person = db.query(models.Person).filter(models.Person.id == person_id).first()

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Person not found",
        )

    check_person_access(person, current_user)

    return person


@router.put("/people/{person_id}", response_model=PersonResponse)
def update_person(
    person_id: int,
    person_update: PersonUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager"])
    ),
):
    person = db.query(models.Person).filter(models.Person.id == person_id).first()

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Person not found",
        )

    check_person_access(person, current_user)

    update_data = person_update.model_dump(exclude_unset=True)

    if "salary_type" in update_data:
        salary_type = update_data.get("salary_type")

        if salary_type == "unpaid":
            update_data["salary_amount"] = 0

    for key, value in update_data.items():
        setattr(person, key, value)

    db.commit()
    db.refresh(person)

    return person


@router.delete("/people/{person_id}")
def delete_person(
    person_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr"])
    ),
):
    person = db.query(models.Person).filter(models.Person.id == person_id).first()

    if not person:
        raise HTTPException(
            status_code=404,
            detail="Person not found",
        )

    check_person_access(person, current_user)

    active_linked_user = db.query(models.User).filter(
        models.User.person_id == person.id,
        models.User.is_active == True,
    ).first()

    if active_linked_user:
        raise HTTPException(
            status_code=400,
            detail="This person has active software login access. Deactivate the login user first.",
        )

    person.is_active = False
    person.status = "inactive"

    db.commit()
    db.refresh(person)

    return {
        "message": "Person deactivated successfully",
    }


# ---------------------------------------------------------
# SOFTWARE USER ROUTES
# ---------------------------------------------------------


@router.post("/users", response_model=UserResponse)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr"])
    ),
):
    role = normalize_role(user.role)

    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Invalid role",
        )

    existing_user = db.query(models.User).filter(
        models.User.email == user.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered",
        )

    selected_person = None

    if user.person_id:
        selected_person = db.query(models.Person).filter(
            models.Person.id == user.person_id
        ).first()

        if not selected_person:
            raise HTTPException(
                status_code=404,
                detail="Onboarded person not found",
            )

        check_person_access(selected_person, current_user)

        existing_person_login = db.query(models.User).filter(
            models.User.person_id == selected_person.id,
            models.User.is_active == True,
        ).first()

        if existing_person_login:
            raise HTTPException(
                status_code=400,
                detail="This person already has active software login access",
            )

    if current_user.role == "super-admin":
        if role not in ["super-admin", "company-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Super admin can create only super admin or company admin users",
            )

        if role == "super-admin":
            company_id = None
        else:
            company_id = selected_person.company_id if selected_person else user.company_id

            if not company_id:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required for company admin",
                )

            company = db.query(models.Company).filter(
                models.Company.id == company_id
            ).first()

            if not company:
                raise HTTPException(
                    status_code=404,
                    detail="Company not found",
                )

    else:
        if role in ["super-admin", "company-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Company admin or HR cannot create super admin or company admin users",
            )

        company_id = current_user.company_id

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="Company ID not found",
            )

        if selected_person and selected_person.company_id != company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot create login for another company person",
            )

    full_name = user.full_name or (selected_person.full_name if selected_person else None)

    if not full_name:
        raise HTTPException(
            status_code=400,
            detail="full_name is required when person_id is not provided",
        )

    new_user = models.User(
        company_id=company_id,
        person_id=selected_person.id if selected_person else None,
        full_name=full_name,
        email=user.email,
        phone=user.phone or (selected_person.phone if selected_person else None),
        hashed_password=get_password_hash(user.password),
        role=role,
        department=user.department or (selected_person.department if selected_person else None),
        portal_access=encode_portal_access(user.portal_access, role),
        salary_type=user.salary_type or (selected_person.salary_type if selected_person else None),
        salary_amount=(
            user.salary_amount
            if user.salary_amount is not None
            else selected_person.salary_amount if selected_person else None
        ),
        joining_date=user.joining_date or (selected_person.joining_date if selected_person else None),
        is_active=True,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.get("/users", response_model=list[UserResponse])
def get_users(
    company_id: int | None = None,
    role: str | None = None,
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager", "accountant"])
    ),
):
    query = db.query(models.User)

    if current_user.role == "super-admin":
        if company_id:
            query = query.filter(models.User.company_id == company_id)
    else:
        query = query.filter(models.User.company_id == current_user.company_id)

    if role:
        query = query.filter(models.User.role == normalize_role(role))

    if is_active is not None:
        query = query.filter(models.User.is_active == is_active)

    return query.order_by(models.User.id.desc()).all()


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    check_user_access(user, current_user)

    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr"])
    ),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if user.id == current_user.id and current_user.role in ["company-admin", "hr"]:
        raise HTTPException(
            status_code=403,
            detail="You cannot update your own profile from user management. Use settings for profile and password.",
        )

    if current_user.role != "super-admin":
        if user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another company user",
            )

        if user.role in ["super-admin", "company-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Company users cannot update super admin or company admin users",
            )

    update_data = user_update.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"]:
        existing_email_user = db.query(models.User).filter(
            models.User.email == update_data["email"],
            models.User.id != user.id,
        ).first()

        if existing_email_user:
            raise HTTPException(
                status_code=400,
                detail="Email already registered",
            )

    if "person_id" in update_data and update_data["person_id"]:
        selected_person = db.query(models.Person).filter(
            models.Person.id == update_data["person_id"]
        ).first()

        if not selected_person:
            raise HTTPException(
                status_code=404,
                detail="Onboarded person not found",
            )

        check_person_access(selected_person, current_user)

        existing_person_login = db.query(models.User).filter(
            models.User.person_id == selected_person.id,
            models.User.id != user.id,
            models.User.is_active == True,
        ).first()

        if existing_person_login:
            raise HTTPException(
                status_code=400,
                detail="This person already has active software login access",
            )

    if "role" in update_data and update_data["role"]:
        role = normalize_role(update_data["role"])

        if role not in ALLOWED_ROLES:
            raise HTTPException(
                status_code=400,
                detail="Invalid role",
            )

        if current_user.role == "super-admin":
            if role not in ["super-admin", "company-admin"]:
                raise HTTPException(
                    status_code=403,
                    detail="Super admin can assign only super admin or company admin role",
                )

        if current_user.role in ["company-admin", "hr"]:
            if role in ["super-admin", "company-admin"]:
                raise HTTPException(
                    status_code=403,
                    detail="Company users cannot assign super admin or company admin role",
                )

        update_data["role"] = role

    if "portal_access" in update_data:
        update_data["portal_access"] = encode_portal_access(
            update_data.get("portal_access"),
            update_data.get("role") or user.role,
        )

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    return user


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr"])
    ),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account",
        )

    if current_user.role != "super-admin":
        if user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot deactivate another company user",
            )

        if user.role in ["super-admin", "company-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Company users cannot deactivate company admin users",
            )

    if user.is_active is False:
        return {
            "message": "User is already inactive",
        }

    user.is_active = False

    db.commit()
    db.refresh(user)

    return {
        "message": "User deactivated successfully",
    }


@router.delete("/users/{user_id}/hard-delete")
def hard_delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr"])
    ),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot permanently delete your own account",
        )

    if current_user.role != "super-admin":
        if user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot permanently delete another company user",
            )

        if user.role in ["super-admin", "company-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Company users cannot permanently delete company admin users",
            )

    if user.is_active:
        raise HTTPException(
            status_code=400,
            detail="First deactivate this user, then permanently delete from Deactivated Users section.",
        )

    try:
        db.delete(user)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="This user has linked records like attendance, tasks, sales, or projects. Keep this user deactivated instead of hard deleting.",
        )

    return {
        "message": "User permanently deleted successfully",
    }