from datetime import date, datetime

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app import models, schemas
from app.auth import (
    create_access_token,
    decode_access_token,
    get_password_hash,
    oauth2_scheme,
    verify_password,
)
from app.database import Base, engine, get_db


Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="Company Management ERP",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


ALLOWED_ROLES = {
    "super-admin",
    "company-admin",
    "hr",
    "manager",
    "employee",
    "intern",
    "sales-representative",
    "freelancer",
    "accountant",
}


ADMIN_ROLES = {
    "super-admin",
    "company-admin",
    "hr",
    "manager",
    "accountant",
}


COMPANY_ADMIN_ROLES = {
    "super-admin",
    "company-admin",
}


NORMAL_COMPANY_ROLES = {
    "hr",
    "manager",
    "employee",
    "intern",
    "sales-representative",
    "freelancer",
    "accountant",
}


TASK_ALLOWED_STATUSES = {
    "pending",
    "in-progress",
    "submitted",
    "completed",
    "cancelled",
}


TASK_ALLOWED_PRIORITIES = {
    "low",
    "medium",
    "high",
    "urgent",
}


SALES_ALLOWED_STATUSES = {
    "new",
    "contacted",
    "interested",
    "follow-up",
    "converted",
    "not-interested",
    "lost",
}


COMMISSION_ALLOWED_STATUSES = {
    "pending",
    "approved",
    "paid",
    "cancelled",
}


FREELANCER_PROJECT_ALLOWED_STATUSES = {
    "assigned",
    "in-progress",
    "submitted",
    "approved",
    "completed",
    "cancelled",
}


FREELANCER_PAYMENT_ALLOWED_STATUSES = {
    "pending",
    "approved",
    "paid",
    "cancelled",
}


# -----------------------------
# HELPER FUNCTIONS
# -----------------------------

def normalize_role(role: str):
    return role.strip().lower()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    email = payload.get("sub")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )

    user = db.query(models.User).filter(
        models.User.email == email
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    return user


def require_roles(allowed_roles: list[str]):
    def checker(current_user: models.User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission for this action"
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
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "department": user.department,
        "is_active": user.is_active,
    }


def is_company_admin_user(user: models.User):
    return user.role in COMPANY_ADMIN_ROLES


def is_company_level_report_user(user: models.User):
    return user.role in {
        "super-admin",
        "company-admin",
        "hr",
        "manager",
        "accountant",
    }


# -----------------------------
# HEALTH CHECK
# -----------------------------

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "Company ERP backend is running"
    }


# -----------------------------
# FIRST SUPER ADMIN SETUP
# -----------------------------

@app.post("/setup/super-admin", response_model=schemas.UserResponse)
def create_first_super_admin(
    user: schemas.UserCreate,
    db: Session = Depends(get_db)
):
    existing_super_admin = db.query(models.User).filter(
        models.User.role == "super-admin"
    ).first()

    if existing_super_admin:
        raise HTTPException(
            status_code=400,
            detail="Super admin already exists"
        )

    existing_email = db.query(models.User).filter(
        models.User.email == user.email
    ).first()

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    new_user = models.User(
        company_id=None,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        hashed_password=get_password_hash(user.password),
        role="super-admin",
        department="System",
        salary_type=None,
        salary_amount=None,
        joining_date=user.joining_date,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


# -----------------------------
# AUTH APIs
# -----------------------------

@app.post("/token")
def login_for_swagger(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(
        db=db,
        email=form_data.username,
        password=form_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role,
            "company_id": user.company_id
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_to_dict(user)
    }


@app.post("/auth/login", response_model=schemas.TokenResponse)
def login_for_frontend(
    login_data: schemas.LoginRequest,
    db: Session = Depends(get_db)
):
    user = authenticate_user(
        db=db,
        email=login_data.email,
        password=login_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role,
            "company_id": user.company_id
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_to_dict(user)
    }


@app.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return user_to_dict(current_user)


@app.put("/auth/change-password")
def change_password(
    password_data: schemas.ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not verify_password(
        password_data.current_password,
        current_user.hashed_password
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 6 characters"
        )

    current_user.hashed_password = get_password_hash(
        password_data.new_password
    )

    db.commit()

    return {
        "message": "Password changed successfully"
    }


# -----------------------------
# COMPANY APIs
# -----------------------------

@app.post("/companies", response_model=schemas.CompanyResponse)
def create_company(
    company: schemas.CompanyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["super-admin"]))
):
    existing_company = db.query(models.Company).filter(
        models.Company.email == company.email
    ).first()

    if existing_company:
        raise HTTPException(
            status_code=400,
            detail="Company with this email already exists"
        )

    new_company = models.Company(
        name=company.name,
        email=company.email,
        phone=company.phone,
        address=company.address,
    )

    db.add(new_company)
    db.commit()
    db.refresh(new_company)

    return new_company


@app.get("/companies", response_model=list[schemas.CompanyResponse])
def get_companies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["super-admin"]))
):
    companies = db.query(models.Company).order_by(
        models.Company.id.desc()
    ).all()

    return companies


@app.get("/companies/{company_id}", response_model=schemas.CompanyResponse)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin"])
    )
):
    company = db.query(models.Company).filter(
        models.Company.id == company_id
    ).first()

    if not company:
        raise HTTPException(
            status_code=404,
            detail="Company not found"
        )

    if current_user.role != "super-admin" and current_user.company_id != company.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot access another company"
        )

    return company


# -----------------------------
# USER APIs
# -----------------------------

@app.post("/users", response_model=schemas.UserResponse)
def create_user(
    user: schemas.UserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin"])
    )
):
    role = normalize_role(user.role)

    if role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=400,
            detail="Invalid role"
        )

    existing_user = db.query(models.User).filter(
        models.User.email == user.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Super admin creates only super-admin or company-admin users.
    if current_user.role == "super-admin":
        if role not in ["super-admin", "company-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Super admin can create only super admin or company admin users"
            )

        if role == "super-admin":
            company_id = None
        else:
            company_id = user.company_id

            if not company_id:
                raise HTTPException(
                    status_code=400,
                    detail="company_id is required for company admin"
                )

            company = db.query(models.Company).filter(
                models.Company.id == company_id
            ).first()

            if not company:
                raise HTTPException(
                    status_code=404,
                    detail="Company not found"
                )

    # Company admin creates only normal company users.
    else:
        if role in ["super-admin", "company-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Company admin cannot create super admin or company admin users"
            )

        company_id = current_user.company_id

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="Company ID not found"
            )

    new_user = models.User(
        company_id=company_id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        hashed_password=get_password_hash(user.password),
        role=role,
        department=user.department,
        salary_type=user.salary_type,
        salary_amount=user.salary_amount,
        joining_date=user.joining_date,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@app.get("/users", response_model=list[schemas.UserResponse])
def get_users(
    company_id: int | None = None,
    role: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager", "accountant"])
    )
):
    query = db.query(models.User)

    if current_user.role == "super-admin":
        if company_id:
            query = query.filter(models.User.company_id == company_id)
    else:
        query = query.filter(models.User.company_id == current_user.company_id)

    if role:
        query = query.filter(models.User.role == normalize_role(role))

    users = query.order_by(models.User.id.desc()).all()

    return users


@app.get("/users/{user_id}", response_model=schemas.UserResponse)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if current_user.role != "super-admin":
        if user.company_id != current_user.company_id and user.id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access this user"
            )

    return user


@app.put("/users/{user_id}", response_model=schemas.UserResponse)
def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin"])
    )
):
    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if user.id == current_user.id and current_user.role == "company-admin":
        raise HTTPException(
            status_code=403,
            detail="Company admin cannot update own profile from user management. Use settings for password."
        )

    if current_user.role != "super-admin":
        if user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another company user"
            )

        if user.role in ["super-admin", "company-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Company admin cannot update super admin or company admin users"
            )

    update_data = user_update.model_dump(exclude_unset=True)

    if "role" in update_data and update_data["role"]:
        role = normalize_role(update_data["role"])

        if role not in ALLOWED_ROLES:
            raise HTTPException(
                status_code=400,
                detail="Invalid role"
            )

        if current_user.role == "super-admin":
            if role not in ["super-admin", "company-admin"]:
                raise HTTPException(
                    status_code=403,
                    detail="Super admin can assign only super admin or company admin role"
                )

        if current_user.role == "company-admin":
            if role in ["super-admin", "company-admin"]:
                raise HTTPException(
                    status_code=403,
                    detail="Company admin cannot assign super admin or company admin role"
                )

        update_data["role"] = role

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    return user


@app.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin"])
    )
):
    user = db.query(models.User).filter(
        models.User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own account"
        )

    if current_user.role != "super-admin":
        if user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot delete another company user"
            )

        if user.role in ["super-admin", "company-admin"]:
            raise HTTPException(
                status_code=403,
                detail="Company admin cannot delete super admin or company admin users"
            )

    db.delete(user)
    db.commit()

    return {
        "message": "User deleted successfully"
    }


# -----------------------------
# ATTENDANCE APIs
# -----------------------------

@app.post("/attendance/check-in", response_model=schemas.AttendanceResponse)
def check_in(
    attendance_data: schemas.AttendanceCheckIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role == "super-admin" or not current_user.company_id:
        raise HTTPException(
            status_code=400,
            detail="Super admin cannot mark attendance"
        )

    today = date.today()

    existing_attendance = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.attendance_date == today
    ).first()

    if existing_attendance:
        raise HTTPException(
            status_code=400,
            detail="Attendance already marked for today"
        )

    new_attendance = models.Attendance(
        company_id=current_user.company_id,
        user_id=current_user.id,
        attendance_date=today,
        check_in_time=datetime.now(),
        status="present",
        remarks=attendance_data.remarks,
    )

    db.add(new_attendance)
    db.commit()
    db.refresh(new_attendance)

    return new_attendance


@app.post("/attendance/check-out", response_model=schemas.AttendanceResponse)
def check_out(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role == "super-admin" or not current_user.company_id:
        raise HTTPException(
            status_code=400,
            detail="Super admin cannot mark attendance"
        )

    today = date.today()

    attendance = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.attendance_date == today
    ).first()

    if not attendance:
        raise HTTPException(
            status_code=404,
            detail="Check-in record not found for today"
        )

    if attendance.check_out_time:
        raise HTTPException(
            status_code=400,
            detail="Already checked out today"
        )

    checkout_time = datetime.now()

    total_seconds = (
        checkout_time - attendance.check_in_time
    ).total_seconds()

    total_hours = round(total_seconds / 3600, 2)

    attendance.check_out_time = checkout_time
    attendance.total_hours = total_hours

    db.commit()
    db.refresh(attendance)

    return attendance


@app.get("/attendance", response_model=list[schemas.AttendanceResponse])
def get_attendance_records(
    company_id: int | None = None,
    user_id: int | None = None,
    attendance_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Attendance)

    if current_user.role == "super-admin":
        if company_id:
            query = query.filter(models.Attendance.company_id == company_id)

    elif current_user.role in ADMIN_ROLES:
        query = query.filter(
            models.Attendance.company_id == current_user.company_id
        )

    else:
        query = query.filter(
            models.Attendance.user_id == current_user.id
        )

    if user_id:
        query = query.filter(models.Attendance.user_id == user_id)

    if attendance_date:
        query = query.filter(models.Attendance.attendance_date == attendance_date)

    records = query.order_by(
        models.Attendance.id.desc()
    ).all()

    return records


@app.get("/attendance/today", response_model=list[schemas.AttendanceResponse])
def get_today_attendance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    today = date.today()

    query = db.query(models.Attendance).filter(
        models.Attendance.attendance_date == today
    )

    if current_user.role == "super-admin":
        pass

    elif current_user.role in ADMIN_ROLES:
        query = query.filter(
            models.Attendance.company_id == current_user.company_id
        )

    else:
        query = query.filter(
            models.Attendance.user_id == current_user.id
        )

    records = query.order_by(
        models.Attendance.id.desc()
    ).all()

    return records


# -----------------------------
# TASK APIs
# -----------------------------

TASK_STATUS_ORDER = {
    "pending": 1,
    "in-progress": 2,
    "in_progress": 2,
    "completed": 3,
}


def normalize_task_status(status: str):
    if not status:
        return status

    status = status.strip().lower()

    if status == "in_progress":
        return "in-progress"

    return status


def validate_task_status_change(old_status: str, new_status: str):
    old_status = normalize_task_status(old_status)
    new_status = normalize_task_status(new_status)

    if old_status not in TASK_STATUS_ORDER:
        raise HTTPException(
            status_code=400,
            detail="Invalid current task status"
        )

    if new_status not in TASK_STATUS_ORDER:
        raise HTTPException(
            status_code=400,
            detail="Invalid new task status"
        )

    if TASK_STATUS_ORDER[new_status] < TASK_STATUS_ORDER[old_status]:
        raise HTTPException(
            status_code=400,
            detail=f"Task status cannot be reverted from {old_status} to {new_status}"
        )

    return new_status


@app.post("/tasks", response_model=schemas.TaskResponse)
def create_task(
    task: schemas.TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager"])
    )
):
    assigned_user = db.query(models.User).filter(
        models.User.id == task.assigned_to_user_id
    ).first()

    if not assigned_user:
        raise HTTPException(
            status_code=404,
            detail="Assigned user not found"
        )

    if not assigned_user.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign task to inactive user"
        )

    if assigned_user.role == "super-admin":
        raise HTTPException(
            status_code=400,
            detail="Cannot assign task to super admin"
        )

    if current_user.role == "super-admin":
        company_id = assigned_user.company_id
    else:
        company_id = current_user.company_id

        if assigned_user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot assign task to another company user"
            )

    if not company_id:
        raise HTTPException(
            status_code=400,
            detail="Company ID not found for task"
        )

    priority = task.priority.strip().lower()

    if priority not in TASK_ALLOWED_PRIORITIES:
        raise HTTPException(
            status_code=400,
            detail="Invalid task priority"
        )

    new_task = models.Task(
        company_id=company_id,
        assigned_to_user_id=task.assigned_to_user_id,
        assigned_by_user_id=current_user.id,
        title=task.title,
        description=task.description,
        priority=priority,
        status="pending",
        due_date=task.due_date,
        remarks=task.remarks,
        submission_note=None,
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


@app.get("/tasks", response_model=list[schemas.TaskResponse])
def get_tasks(
    company_id: int | None = None,
    assigned_to_user_id: int | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.Task)

    if current_user.role == "super-admin":
        if company_id:
            query = query.filter(models.Task.company_id == company_id)

    elif current_user.role in ADMIN_ROLES:
        query = query.filter(
            models.Task.company_id == current_user.company_id
        )

    else:
        query = query.filter(
            models.Task.assigned_to_user_id == current_user.id
        )

    if assigned_to_user_id:
        query = query.filter(
            models.Task.assigned_to_user_id == assigned_to_user_id
        )

    if status_filter:
        status_value = normalize_task_status(status_filter)

        if status_value not in TASK_STATUS_ORDER:
            raise HTTPException(
                status_code=400,
                detail="Invalid task status"
            )

        query = query.filter(models.Task.status == status_value)

    tasks = query.order_by(
        models.Task.id.desc()
    ).all()

    return tasks


@app.get("/tasks/{task_id}", response_model=schemas.TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).filter(
        models.Task.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    if current_user.role == "super-admin":
        return task

    if current_user.role in ADMIN_ROLES:
        if task.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access another company task"
            )

        return task

    if task.assigned_to_user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot access this task"
        )

    return task


@app.put("/tasks/{task_id}", response_model=schemas.TaskResponse)
def update_task(
    task_id: int,
    task_update: schemas.TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.Task).filter(
        models.Task.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    is_admin_user = current_user.role in ADMIN_ROLES

    if current_user.role == "super-admin":
        is_admin_user = True

    elif is_admin_user:
        if task.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another company task"
            )

    else:
        if task.assigned_to_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update this task"
            )

    update_data = task_update.model_dump(exclude_unset=True)

    if not is_admin_user:
        allowed_staff_fields = {
            "status",
            "submission_note",
        }

        for field in update_data.keys():
            if field not in allowed_staff_fields:
                raise HTTPException(
                    status_code=403,
                    detail="You can only update task status and submission note"
                )

    if "status" in update_data and update_data["status"]:
        update_data["status"] = validate_task_status_change(
            task.status,
            update_data["status"]
        )

    if "priority" in update_data and update_data["priority"]:
        priority_value = update_data["priority"].strip().lower()

        if priority_value not in TASK_ALLOWED_PRIORITIES:
            raise HTTPException(
                status_code=400,
                detail="Invalid task priority"
            )

        update_data["priority"] = priority_value

    if "assigned_to_user_id" in update_data and update_data["assigned_to_user_id"]:
        if not is_admin_user:
            raise HTTPException(
                status_code=403,
                detail="Only admin/manager can reassign task"
            )

        new_assigned_user = db.query(models.User).filter(
            models.User.id == update_data["assigned_to_user_id"]
        ).first()

        if not new_assigned_user:
            raise HTTPException(
                status_code=404,
                detail="New assigned user not found"
            )

        if not new_assigned_user.is_active:
            raise HTTPException(
                status_code=400,
                detail="Cannot assign task to inactive user"
            )

        if new_assigned_user.role == "super-admin":
            raise HTTPException(
                status_code=400,
                detail="Cannot assign task to super admin"
            )

        if current_user.role != "super-admin":
            if new_assigned_user.company_id != current_user.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="You cannot assign task to another company user"
                )

        task.company_id = new_assigned_user.company_id

    for key, value in update_data.items():
        setattr(task, key, value)

    task.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    return task


@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager"])
    )
):
    task = db.query(models.Task).filter(
        models.Task.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    if current_user.role != "super-admin":
        if task.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot delete another company task"
            )

    db.delete(task)
    db.commit()

    return {
        "message": "Task deleted successfully"
    }


# -----------------------------
# SALES LEAD APIs
# -----------------------------

@app.post("/sales/leads", response_model=schemas.SalesLeadResponse)
def create_sales_lead(
    lead: schemas.SalesLeadCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ADMIN_ROLES and current_user.role != "sales-representative":
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to create sales leads"
        )

    if current_user.role == "sales-representative":
        sales_rep_user_id = current_user.id
    else:
        if not lead.sales_rep_user_id:
            raise HTTPException(
                status_code=400,
                detail="sales_rep_user_id is required"
            )

        sales_rep_user_id = lead.sales_rep_user_id

    sales_rep = db.query(models.User).filter(
        models.User.id == sales_rep_user_id
    ).first()

    if not sales_rep:
        raise HTTPException(
            status_code=404,
            detail="Sales representative not found"
        )

    if sales_rep.role != "sales-representative":
        raise HTTPException(
            status_code=400,
            detail="Assigned user must be a sales representative"
        )

    if not sales_rep.is_active:
        raise HTTPException(
            status_code=400,
            detail="Sales representative is inactive"
        )

    if current_user.role != "super-admin":
        if sales_rep.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot create lead for another company"
            )

    company_id = sales_rep.company_id

    new_lead = models.SalesLead(
        company_id=company_id,
        sales_rep_user_id=sales_rep_user_id,
        created_by_user_id=current_user.id,

        client_name=lead.client_name,
        client_phone=lead.client_phone,
        client_email=lead.client_email,
        client_company_name=lead.client_company_name,

        service_interest=lead.service_interest,
        lead_source=lead.lead_source,

        status="new",

        expected_value=lead.expected_value,
        final_sale_amount=None,

        follow_up_date=lead.follow_up_date,

        notes=lead.notes,
    )

    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)

    return new_lead


@app.get("/sales/leads", response_model=list[schemas.SalesLeadResponse])
def get_sales_leads(
    company_id: int | None = None,
    sales_rep_user_id: int | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ADMIN_ROLES and current_user.role != "sales-representative":
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view sales leads"
        )

    query = db.query(models.SalesLead)

    if current_user.role == "super-admin":
        if company_id:
            query = query.filter(models.SalesLead.company_id == company_id)

    elif current_user.role in ADMIN_ROLES:
        query = query.filter(
            models.SalesLead.company_id == current_user.company_id
        )

    else:
        query = query.filter(
            models.SalesLead.sales_rep_user_id == current_user.id
        )

    if sales_rep_user_id:
        query = query.filter(
            models.SalesLead.sales_rep_user_id == sales_rep_user_id
        )

    if status_filter:
        status_value = status_filter.strip().lower()

        if status_value not in SALES_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid sales lead status"
            )

        query = query.filter(models.SalesLead.status == status_value)

    leads = query.order_by(
        models.SalesLead.id.desc()
    ).all()

    return leads


@app.get("/sales/leads/{lead_id}", response_model=schemas.SalesLeadResponse)
def get_sales_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.SalesLead).filter(
        models.SalesLead.id == lead_id
    ).first()

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Sales lead not found"
        )

    if current_user.role == "super-admin":
        return lead

    if current_user.role in ADMIN_ROLES:
        if lead.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access another company lead"
            )

        return lead

    if current_user.role == "sales-representative":
        if lead.sales_rep_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access this lead"
            )

        return lead

    raise HTTPException(
        status_code=403,
        detail="You do not have permission to view this lead"
    )


@app.put("/sales/leads/{lead_id}", response_model=schemas.SalesLeadResponse)
def update_sales_lead(
    lead_id: int,
    lead_update: schemas.SalesLeadUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.SalesLead).filter(
        models.SalesLead.id == lead_id
    ).first()

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Sales lead not found"
        )

    is_admin_user = current_user.role in ADMIN_ROLES or current_user.role == "super-admin"

    if is_admin_user:
        if current_user.role != "super-admin" and lead.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another company lead"
            )
    else:
        if current_user.role != "sales-representative":
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to update sales lead"
            )

        if lead.sales_rep_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another sales representative lead"
            )

    update_data = lead_update.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"]:
        status_value = update_data["status"].strip().lower()

        if status_value not in SALES_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid sales lead status"
            )

        update_data["status"] = status_value

    if "sales_rep_user_id" in update_data and update_data["sales_rep_user_id"]:
        if not is_admin_user:
            raise HTTPException(
                status_code=403,
                detail="Only admin can reassign sales lead"
            )

        new_sales_rep = db.query(models.User).filter(
            models.User.id == update_data["sales_rep_user_id"]
        ).first()

        if not new_sales_rep:
            raise HTTPException(
                status_code=404,
                detail="New sales representative not found"
            )

        if new_sales_rep.role != "sales-representative":
            raise HTTPException(
                status_code=400,
                detail="Assigned user must be a sales representative"
            )

        if current_user.role != "super-admin":
            if new_sales_rep.company_id != current_user.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="You cannot assign lead to another company sales representative"
                )

    for key, value in update_data.items():
        setattr(lead, key, value)

    lead.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(lead)

    return lead


@app.post("/sales/leads/{lead_id}/convert", response_model=schemas.LeadConvertResponse)
def convert_sales_lead(
    lead_id: int,
    convert_data: schemas.LeadConvertRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.SalesLead).filter(
        models.SalesLead.id == lead_id
    ).first()

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Sales lead not found"
        )

    is_admin_user = current_user.role in ADMIN_ROLES or current_user.role == "super-admin"

    if is_admin_user:
        if current_user.role != "super-admin" and lead.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot convert another company lead"
            )
    else:
        if current_user.role != "sales-representative":
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to convert lead"
            )

        if lead.sales_rep_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot convert another sales representative lead"
            )

    if lead.status == "converted":
        raise HTTPException(
            status_code=400,
            detail="Lead already converted"
        )

    if convert_data.final_sale_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Final sale amount must be greater than 0"
        )

    if convert_data.commission_percentage < 0:
        raise HTTPException(
            status_code=400,
            detail="Commission percentage cannot be negative"
        )

    existing_commission = db.query(models.SalesCommission).filter(
        models.SalesCommission.lead_id == lead.id
    ).first()

    if existing_commission:
        raise HTTPException(
            status_code=400,
            detail="Commission already generated for this lead"
        )

    commission_amount = round(
        convert_data.final_sale_amount * convert_data.commission_percentage / 100,
        2
    )

    lead.status = "converted"
    lead.final_sale_amount = convert_data.final_sale_amount
    lead.updated_at = datetime.utcnow()

    new_commission = models.SalesCommission(
        company_id=lead.company_id,
        sales_rep_user_id=lead.sales_rep_user_id,
        lead_id=lead.id,

        sale_amount=convert_data.final_sale_amount,
        commission_percentage=convert_data.commission_percentage,
        commission_amount=commission_amount,

        status="pending",
        payment_date=None,
        remarks=convert_data.remarks,
    )

    db.add(new_commission)
    db.commit()
    db.refresh(lead)
    db.refresh(new_commission)

    return {
        "message": "Lead converted and commission generated successfully",
        "lead": lead,
        "commission": new_commission,
    }


@app.delete("/sales/leads/{lead_id}")
def delete_sales_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager"])
    )
):
    lead = db.query(models.SalesLead).filter(
        models.SalesLead.id == lead_id
    ).first()

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Sales lead not found"
        )

    if current_user.role != "super-admin":
        if lead.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot delete another company lead"
            )

    commission = db.query(models.SalesCommission).filter(
        models.SalesCommission.lead_id == lead.id
    ).first()

    if commission:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete lead because commission exists"
        )

    db.delete(lead)
    db.commit()

    return {
        "message": "Sales lead deleted successfully"
    }


# -----------------------------
# SALES COMMISSION APIs
# -----------------------------

@app.get("/sales/commissions", response_model=list[schemas.SalesCommissionResponse])
def get_sales_commissions(
    company_id: int | None = None,
    sales_rep_user_id: int | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ADMIN_ROLES and current_user.role != "sales-representative":
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view commissions"
        )

    query = db.query(models.SalesCommission)

    if current_user.role == "super-admin":
        if company_id:
            query = query.filter(models.SalesCommission.company_id == company_id)

    elif current_user.role in ADMIN_ROLES:
        query = query.filter(
            models.SalesCommission.company_id == current_user.company_id
        )

    else:
        query = query.filter(
            models.SalesCommission.sales_rep_user_id == current_user.id
        )

    if sales_rep_user_id:
        query = query.filter(
            models.SalesCommission.sales_rep_user_id == sales_rep_user_id
        )

    if status_filter:
        status_value = status_filter.strip().lower()

        if status_value not in COMMISSION_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid commission status"
            )

        query = query.filter(models.SalesCommission.status == status_value)

    commissions = query.order_by(
        models.SalesCommission.id.desc()
    ).all()

    return commissions


@app.put("/sales/commissions/{commission_id}", response_model=schemas.SalesCommissionResponse)
def update_sales_commission(
    commission_id: int,
    commission_update: schemas.SalesCommissionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager", "accountant"])
    )
):
    commission = db.query(models.SalesCommission).filter(
        models.SalesCommission.id == commission_id
    ).first()

    if not commission:
        raise HTTPException(
            status_code=404,
            detail="Commission not found"
        )

    if current_user.role != "super-admin":
        if commission.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another company commission"
            )

    update_data = commission_update.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"]:
        status_value = update_data["status"].strip().lower()

        if status_value not in COMMISSION_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid commission status"
            )

        update_data["status"] = status_value

    for key, value in update_data.items():
        setattr(commission, key, value)

    commission.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(commission)

    return commission


# -----------------------------
# FREELANCER PROJECT APIs
# -----------------------------

@app.post("/freelancers/projects", response_model=schemas.FreelancerProjectResponse)
def create_freelancer_project(
    project: schemas.FreelancerProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager"])
    )
):
    freelancer = db.query(models.User).filter(
        models.User.id == project.freelancer_user_id
    ).first()

    if not freelancer:
        raise HTTPException(
            status_code=404,
            detail="Freelancer not found"
        )

    if freelancer.role != "freelancer":
        raise HTTPException(
            status_code=400,
            detail="Assigned user must be a freelancer"
        )

    if not freelancer.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign project to inactive freelancer"
        )

    if current_user.role != "super-admin":
        if freelancer.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot assign project to another company freelancer"
            )

    if project.project_amount < 0:
        raise HTTPException(
            status_code=400,
            detail="Project amount cannot be negative"
        )

    company_id = freelancer.company_id

    new_project = models.FreelancerProject(
        company_id=company_id,
        freelancer_user_id=project.freelancer_user_id,
        assigned_by_user_id=current_user.id,

        title=project.title,
        description=project.description,

        project_amount=project.project_amount,

        status="assigned",
        payment_status="pending",

        start_date=project.start_date,
        due_date=project.due_date,
        completed_date=None,

        submission_note=None,
        submission_link=None,

        admin_remarks=project.admin_remarks,
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return new_project


@app.get("/freelancers/projects", response_model=list[schemas.FreelancerProjectResponse])
def get_freelancer_projects(
    company_id: int | None = None,
    freelancer_user_id: int | None = None,
    status_filter: str | None = None,
    payment_status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ADMIN_ROLES and current_user.role != "freelancer":
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view freelancer projects"
        )

    query = db.query(models.FreelancerProject)

    if current_user.role == "super-admin":
        if company_id:
            query = query.filter(
                models.FreelancerProject.company_id == company_id
            )

    elif current_user.role in ADMIN_ROLES:
        query = query.filter(
            models.FreelancerProject.company_id == current_user.company_id
        )

    else:
        query = query.filter(
            models.FreelancerProject.freelancer_user_id == current_user.id
        )

    if freelancer_user_id:
        query = query.filter(
            models.FreelancerProject.freelancer_user_id == freelancer_user_id
        )

    if status_filter:
        status_value = status_filter.strip().lower()

        if status_value not in FREELANCER_PROJECT_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid freelancer project status"
            )

        query = query.filter(
            models.FreelancerProject.status == status_value
        )

    if payment_status_filter:
        payment_status_value = payment_status_filter.strip().lower()

        if payment_status_value not in FREELANCER_PAYMENT_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid freelancer payment status"
            )

        query = query.filter(
            models.FreelancerProject.payment_status == payment_status_value
        )

    projects = query.order_by(
        models.FreelancerProject.id.desc()
    ).all()

    return projects


@app.get("/freelancers/projects/{project_id}", response_model=schemas.FreelancerProjectResponse)
def get_freelancer_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.FreelancerProject).filter(
        models.FreelancerProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Freelancer project not found"
        )

    if current_user.role == "super-admin":
        return project

    if current_user.role in ADMIN_ROLES:
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access another company project"
            )

        return project

    if current_user.role == "freelancer":
        if project.freelancer_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access this project"
            )

        return project

    raise HTTPException(
        status_code=403,
        detail="You do not have permission to view this project"
    )


@app.put("/freelancers/projects/{project_id}", response_model=schemas.FreelancerProjectResponse)
def update_freelancer_project(
    project_id: int,
    project_update: schemas.FreelancerProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.FreelancerProject).filter(
        models.FreelancerProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Freelancer project not found"
        )

    is_admin_user = current_user.role in ADMIN_ROLES or current_user.role == "super-admin"

    if is_admin_user:
        if current_user.role != "super-admin":
            if project.company_id != current_user.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="You cannot update another company project"
                )
    else:
        if current_user.role != "freelancer":
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to update freelancer project"
            )

        if project.freelancer_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another freelancer project"
            )

    update_data = project_update.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"]:
        status_value = update_data["status"].strip().lower()

        if status_value not in FREELANCER_PROJECT_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid freelancer project status"
            )

        update_data["status"] = status_value

        if status_value in ["approved", "completed"]:
            if not update_data.get("completed_date"):
                update_data["completed_date"] = date.today()

    if "payment_status" in update_data and update_data["payment_status"]:
        if not is_admin_user:
            raise HTTPException(
                status_code=403,
                detail="Only admin/accountant can update payment status"
            )

        payment_status_value = update_data["payment_status"].strip().lower()

        if payment_status_value not in FREELANCER_PAYMENT_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid freelancer payment status"
            )

        update_data["payment_status"] = payment_status_value

    if "project_amount" in update_data and update_data["project_amount"] is not None:
        if update_data["project_amount"] < 0:
            raise HTTPException(
                status_code=400,
                detail="Project amount cannot be negative"
            )

    if "freelancer_user_id" in update_data and update_data["freelancer_user_id"]:
        if not is_admin_user:
            raise HTTPException(
                status_code=403,
                detail="Only admin/manager can reassign project"
            )

        new_freelancer = db.query(models.User).filter(
            models.User.id == update_data["freelancer_user_id"]
        ).first()

        if not new_freelancer:
            raise HTTPException(
                status_code=404,
                detail="New freelancer not found"
            )

        if new_freelancer.role != "freelancer":
            raise HTTPException(
                status_code=400,
                detail="Assigned user must be a freelancer"
            )

        if current_user.role != "super-admin":
            if new_freelancer.company_id != current_user.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="You cannot assign project to another company freelancer"
                )

    if not is_admin_user:
        allowed_freelancer_fields = {
            "status",
            "submission_note",
            "submission_link",
        }

        for field in update_data.keys():
            if field not in allowed_freelancer_fields:
                raise HTTPException(
                    status_code=403,
                    detail="Freelancer can only update status, submission note, and submission link"
                )

    for key, value in update_data.items():
        setattr(project, key, value)

    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    return project


@app.delete("/freelancers/projects/{project_id}")
def delete_freelancer_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager"])
    )
):
    project = db.query(models.FreelancerProject).filter(
        models.FreelancerProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Freelancer project not found"
        )

    if current_user.role != "super-admin":
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot delete another company project"
            )

    existing_payment = db.query(models.FreelancerPayment).filter(
        models.FreelancerPayment.project_id == project.id
    ).first()

    if existing_payment:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete project because payment record exists"
        )

    db.delete(project)
    db.commit()

    return {
        "message": "Freelancer project deleted successfully"
    }


# -----------------------------
# FREELANCER PAYMENT APIs
# -----------------------------

@app.post(
    "/freelancers/projects/{project_id}/generate-payment",
    response_model=schemas.FreelancerPaymentGenerateResponse
)
def generate_freelancer_payment(
    project_id: int,
    payment_data: schemas.FreelancerPaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager", "accountant"])
    )
):
    project = db.query(models.FreelancerProject).filter(
        models.FreelancerProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Freelancer project not found"
        )

    if current_user.role != "super-admin":
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot generate payment for another company project"
            )

    if project.project_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Project amount must be greater than 0"
        )

    if project.status not in ["submitted", "approved", "completed"]:
        raise HTTPException(
            status_code=400,
            detail="Payment can be generated only after project is submitted, approved, or completed"
        )

    existing_payment = db.query(models.FreelancerPayment).filter(
        models.FreelancerPayment.project_id == project.id
    ).first()

    if existing_payment:
        raise HTTPException(
            status_code=400,
            detail="Payment already generated for this project"
        )

    new_payment = models.FreelancerPayment(
        company_id=project.company_id,
        freelancer_user_id=project.freelancer_user_id,
        project_id=project.id,

        amount=project.project_amount,

        status="pending",
        payment_date=None,
        payment_method=None,

        remarks=payment_data.remarks,
    )

    project.payment_status = "pending"
    project.updated_at = datetime.utcnow()

    db.add(new_payment)
    db.commit()
    db.refresh(project)
    db.refresh(new_payment)

    return {
        "message": "Freelancer payment generated successfully",
        "project": project,
        "payment": new_payment,
    }


@app.get("/freelancers/payments", response_model=list[schemas.FreelancerPaymentResponse])
def get_freelancer_payments(
    company_id: int | None = None,
    freelancer_user_id: int | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if current_user.role not in ADMIN_ROLES and current_user.role != "freelancer":
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view freelancer payments"
        )

    query = db.query(models.FreelancerPayment)

    if current_user.role == "super-admin":
        if company_id:
            query = query.filter(
                models.FreelancerPayment.company_id == company_id
            )

    elif current_user.role in ADMIN_ROLES:
        query = query.filter(
            models.FreelancerPayment.company_id == current_user.company_id
        )

    else:
        query = query.filter(
            models.FreelancerPayment.freelancer_user_id == current_user.id
        )

    if freelancer_user_id:
        query = query.filter(
            models.FreelancerPayment.freelancer_user_id == freelancer_user_id
        )

    if status_filter:
        status_value = status_filter.strip().lower()

        if status_value not in FREELANCER_PAYMENT_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid freelancer payment status"
            )

        query = query.filter(
            models.FreelancerPayment.status == status_value
        )

    payments = query.order_by(
        models.FreelancerPayment.id.desc()
    ).all()

    return payments


@app.put("/freelancers/payments/{payment_id}", response_model=schemas.FreelancerPaymentResponse)
def update_freelancer_payment(
    payment_id: int,
    payment_update: schemas.FreelancerPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager", "accountant"])
    )
):
    payment = db.query(models.FreelancerPayment).filter(
        models.FreelancerPayment.id == payment_id
    ).first()

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Freelancer payment not found"
        )

    if current_user.role != "super-admin":
        if payment.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another company payment"
            )

    update_data = payment_update.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"]:
        status_value = update_data["status"].strip().lower()

        if status_value not in FREELANCER_PAYMENT_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid freelancer payment status"
            )

        update_data["status"] = status_value

    for key, value in update_data.items():
        setattr(payment, key, value)

    payment.updated_at = datetime.utcnow()

    project = db.query(models.FreelancerProject).filter(
        models.FreelancerProject.id == payment.project_id
    ).first()

    if project and payment.status:
        project.payment_status = payment.status
        project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(payment)

    return payment


# -----------------------------
# DASHBOARD / REPORT SUMMARY API
# -----------------------------

@app.get("/reports/dashboard-summary")
def get_dashboard_summary(
    company_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    today = date.today()

    users_query = db.query(models.User)
    attendance_query = db.query(models.Attendance)
    tasks_query = db.query(models.Task)
    leads_query = db.query(models.SalesLead)
    commissions_query = db.query(models.SalesCommission)
    freelancer_projects_query = db.query(models.FreelancerProject)
    freelancer_payments_query = db.query(models.FreelancerPayment)

    if current_user.role == "super-admin":
        target_company_id = company_id

        if target_company_id:
            users_query = users_query.filter(models.User.company_id == target_company_id)
            attendance_query = attendance_query.filter(models.Attendance.company_id == target_company_id)
            tasks_query = tasks_query.filter(models.Task.company_id == target_company_id)
            leads_query = leads_query.filter(models.SalesLead.company_id == target_company_id)
            commissions_query = commissions_query.filter(models.SalesCommission.company_id == target_company_id)
            freelancer_projects_query = freelancer_projects_query.filter(models.FreelancerProject.company_id == target_company_id)
            freelancer_payments_query = freelancer_payments_query.filter(models.FreelancerPayment.company_id == target_company_id)

    elif current_user.role in ["company-admin", "hr", "manager", "accountant"]:
        target_company_id = current_user.company_id

        if not target_company_id:
            raise HTTPException(
                status_code=400,
                detail="Company ID not found"
            )

        users_query = users_query.filter(models.User.company_id == target_company_id)
        attendance_query = attendance_query.filter(models.Attendance.company_id == target_company_id)
        tasks_query = tasks_query.filter(models.Task.company_id == target_company_id)
        leads_query = leads_query.filter(models.SalesLead.company_id == target_company_id)
        commissions_query = commissions_query.filter(models.SalesCommission.company_id == target_company_id)
        freelancer_projects_query = freelancer_projects_query.filter(models.FreelancerProject.company_id == target_company_id)
        freelancer_payments_query = freelancer_payments_query.filter(models.FreelancerPayment.company_id == target_company_id)

    else:
        target_company_id = current_user.company_id

        if not target_company_id:
            raise HTTPException(
                status_code=400,
                detail="Company ID not found"
            )

        users_query = users_query.filter(models.User.id == current_user.id)
        attendance_query = attendance_query.filter(models.Attendance.user_id == current_user.id)
        tasks_query = tasks_query.filter(models.Task.assigned_to_user_id == current_user.id)

        if current_user.role == "sales-representative":
            leads_query = leads_query.filter(models.SalesLead.sales_rep_user_id == current_user.id)
            commissions_query = commissions_query.filter(models.SalesCommission.sales_rep_user_id == current_user.id)
        else:
            leads_query = leads_query.filter(models.SalesLead.id == -1)
            commissions_query = commissions_query.filter(models.SalesCommission.id == -1)

        if current_user.role == "freelancer":
            freelancer_projects_query = freelancer_projects_query.filter(
                models.FreelancerProject.freelancer_user_id == current_user.id
            )
            freelancer_payments_query = freelancer_payments_query.filter(
                models.FreelancerPayment.freelancer_user_id == current_user.id
            )
        else:
            freelancer_projects_query = freelancer_projects_query.filter(models.FreelancerProject.id == -1)
            freelancer_payments_query = freelancer_payments_query.filter(models.FreelancerPayment.id == -1)

    today_attendance_count = attendance_query.filter(
        models.Attendance.attendance_date == today
    ).count()

    total_users = users_query.count()

    total_employees = users_query.filter(
        models.User.role == "employee"
    ).count()

    total_interns = users_query.filter(
        models.User.role == "intern"
    ).count()

    total_sales_representatives = users_query.filter(
        models.User.role == "sales-representative"
    ).count()

    total_freelancers = users_query.filter(
        models.User.role == "freelancer"
    ).count()

    pending_tasks = tasks_query.filter(
        models.Task.status == "pending"
    ).count()

    in_progress_tasks = tasks_query.filter(
        models.Task.status == "in-progress"
    ).count()

    completed_tasks = tasks_query.filter(
        models.Task.status == "completed"
    ).count()

    total_leads = leads_query.count()

    converted_leads = leads_query.filter(
        models.SalesLead.status == "converted"
    ).count()

    pending_commissions = commissions_query.filter(
        models.SalesCommission.status == "pending"
    ).all()

    paid_commissions = commissions_query.filter(
        models.SalesCommission.status == "paid"
    ).all()

    pending_commission_amount = round(
        sum(item.commission_amount for item in pending_commissions),
        2
    )

    paid_commission_amount = round(
        sum(item.commission_amount for item in paid_commissions),
        2
    )

    total_freelancer_projects = freelancer_projects_query.count()

    submitted_freelancer_projects = freelancer_projects_query.filter(
        models.FreelancerProject.status == "submitted"
    ).count()

    completed_freelancer_projects = freelancer_projects_query.filter(
        models.FreelancerProject.status == "completed"
    ).count()

    pending_freelancer_payments = freelancer_payments_query.filter(
        models.FreelancerPayment.status == "pending"
    ).all()

    paid_freelancer_payments = freelancer_payments_query.filter(
        models.FreelancerPayment.status == "paid"
    ).all()

    pending_freelancer_payment_amount = round(
        sum(item.amount for item in pending_freelancer_payments),
        2
    )

    paid_freelancer_payment_amount = round(
        sum(item.amount for item in paid_freelancer_payments),
        2
    )

    return {
        "company_id": target_company_id,
        "scope": "company" if is_company_level_report_user(current_user) else "personal",
        "users": {
            "total_users": total_users,
            "employees": total_employees,
            "interns": total_interns,
            "sales_representatives": total_sales_representatives,
            "freelancers": total_freelancers,
        },
        "attendance": {
            "today_present": today_attendance_count,
        },
        "tasks": {
            "pending": pending_tasks,
            "in_progress": in_progress_tasks,
            "completed": completed_tasks,
        },
        "sales": {
            "total_leads": total_leads,
            "converted_leads": converted_leads,
            "pending_commission_amount": pending_commission_amount,
            "paid_commission_amount": paid_commission_amount,
        },
        "freelancers": {
            "total_projects": total_freelancer_projects,
            "submitted_projects": submitted_freelancer_projects,
            "completed_projects": completed_freelancer_projects,
            "pending_payment_amount": pending_freelancer_payment_amount,
            "paid_payment_amount": paid_freelancer_payment_amount,
        }
    }