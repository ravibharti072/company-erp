from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.core.constants import (
    ADMIN_ROLES,
    FREELANCER_PROJECT_ALLOWED_STATUSES,
    FREELANCER_PAYMENT_ALLOWED_STATUSES,
)
from app.core.dependencies import get_current_user, require_roles
from app.schemas_modules.freelancers import (
    FreelancerProjectCreate,
    FreelancerProjectUpdate,
    FreelancerProjectResponse,
    FreelancerPaymentCreate,
    FreelancerPaymentUpdate,
    FreelancerPaymentResponse,
    FreelancerPaymentGenerateResponse,
)


router = APIRouter(
    prefix="/freelancers",
    tags=["Freelancers"],
)


# -----------------------------
# FREELANCER PROJECT APIs
# -----------------------------

@router.post("/projects", response_model=FreelancerProjectResponse)
def create_freelancer_project(
    project: FreelancerProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager"])
    ),
):
    freelancer = db.query(models.User).filter(
        models.User.id == project.freelancer_user_id
    ).first()

    if not freelancer:
        raise HTTPException(
            status_code=404,
            detail="Freelancer not found",
        )

    if freelancer.role != "freelancer":
        raise HTTPException(
            status_code=400,
            detail="Assigned user must be a freelancer",
        )

    if not freelancer.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign project to inactive freelancer",
        )

    if current_user.role != "super-admin":
        if freelancer.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot assign project to another company freelancer",
            )

    if project.project_amount < 0:
        raise HTTPException(
            status_code=400,
            detail="Project amount cannot be negative",
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


@router.get("/projects", response_model=list[FreelancerProjectResponse])
def get_freelancer_projects(
    company_id: Optional[int] = None,
    freelancer_user_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    payment_status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ADMIN_ROLES and current_user.role != "freelancer":
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view freelancer projects",
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
                detail="Invalid freelancer project status",
            )

        query = query.filter(
            models.FreelancerProject.status == status_value
        )

    if payment_status_filter:
        payment_status_value = payment_status_filter.strip().lower()

        if payment_status_value not in FREELANCER_PAYMENT_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid freelancer payment status",
            )

        query = query.filter(
            models.FreelancerProject.payment_status == payment_status_value
        )

    projects = query.order_by(
        models.FreelancerProject.id.desc()
    ).all()

    return projects


@router.get("/projects/{project_id}", response_model=FreelancerProjectResponse)
def get_freelancer_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = db.query(models.FreelancerProject).filter(
        models.FreelancerProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Freelancer project not found",
        )

    if current_user.role == "super-admin":
        return project

    if current_user.role in ADMIN_ROLES:
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access another company project",
            )

        return project

    if current_user.role == "freelancer":
        if project.freelancer_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access this project",
            )

        return project

    raise HTTPException(
        status_code=403,
        detail="You do not have permission to view this project",
    )


@router.put("/projects/{project_id}", response_model=FreelancerProjectResponse)
def update_freelancer_project(
    project_id: int,
    project_update: FreelancerProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = db.query(models.FreelancerProject).filter(
        models.FreelancerProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Freelancer project not found",
        )

    is_admin_user = (
        current_user.role in ADMIN_ROLES
        or current_user.role == "super-admin"
    )

    if is_admin_user:
        if current_user.role != "super-admin":
            if project.company_id != current_user.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="You cannot update another company project",
                )
    else:
        if current_user.role != "freelancer":
            raise HTTPException(
                status_code=403,
                detail="You do not have permission to update freelancer project",
            )

        if project.freelancer_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another freelancer project",
            )

    update_data = project_update.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"]:
        status_value = update_data["status"].strip().lower()

        if status_value not in FREELANCER_PROJECT_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid freelancer project status",
            )

        update_data["status"] = status_value

        if status_value in ["approved", "completed"]:
            if not update_data.get("completed_date"):
                update_data["completed_date"] = date.today()

    if "payment_status" in update_data and update_data["payment_status"]:
        if not is_admin_user:
            raise HTTPException(
                status_code=403,
                detail="Only admin/accountant can update payment status",
            )

        payment_status_value = update_data["payment_status"].strip().lower()

        if payment_status_value not in FREELANCER_PAYMENT_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid freelancer payment status",
            )

        update_data["payment_status"] = payment_status_value

    if "project_amount" in update_data and update_data["project_amount"] is not None:
        if update_data["project_amount"] < 0:
            raise HTTPException(
                status_code=400,
                detail="Project amount cannot be negative",
            )

    if "freelancer_user_id" in update_data and update_data["freelancer_user_id"]:
        if not is_admin_user:
            raise HTTPException(
                status_code=403,
                detail="Only admin/manager can reassign project",
            )

        new_freelancer = db.query(models.User).filter(
            models.User.id == update_data["freelancer_user_id"]
        ).first()

        if not new_freelancer:
            raise HTTPException(
                status_code=404,
                detail="New freelancer not found",
            )

        if new_freelancer.role != "freelancer":
            raise HTTPException(
                status_code=400,
                detail="Assigned user must be a freelancer",
            )

        if current_user.role != "super-admin":
            if new_freelancer.company_id != current_user.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="You cannot assign project to another company freelancer",
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
                    detail="Freelancer can only update status, submission note, and submission link",
                )

    for key, value in update_data.items():
        setattr(project, key, value)

    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    return project


@router.delete("/projects/{project_id}")
def delete_freelancer_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager"])
    ),
):
    project = db.query(models.FreelancerProject).filter(
        models.FreelancerProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Freelancer project not found",
        )

    if current_user.role != "super-admin":
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot delete another company project",
            )

    existing_payment = db.query(models.FreelancerPayment).filter(
        models.FreelancerPayment.project_id == project.id
    ).first()

    if existing_payment:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete project because payment record exists",
        )

    db.delete(project)
    db.commit()

    return {
        "message": "Freelancer project deleted successfully",
    }


# -----------------------------
# FREELANCER PAYMENT APIs
# -----------------------------

@router.post(
    "/projects/{project_id}/generate-payment",
    response_model=FreelancerPaymentGenerateResponse,
)
def generate_freelancer_payment(
    project_id: int,
    payment_data: FreelancerPaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager", "accountant"])
    ),
):
    project = db.query(models.FreelancerProject).filter(
        models.FreelancerProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Freelancer project not found",
        )

    if current_user.role != "super-admin":
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot generate payment for another company project",
            )

    if project.project_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Project amount must be greater than 0",
        )

    if project.status not in ["submitted", "approved", "completed"]:
        raise HTTPException(
            status_code=400,
            detail="Payment can be generated only after project is submitted, approved, or completed",
        )

    existing_payment = db.query(models.FreelancerPayment).filter(
        models.FreelancerPayment.project_id == project.id
    ).first()

    if existing_payment:
        raise HTTPException(
            status_code=400,
            detail="Payment already generated for this project",
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


@router.get("/payments", response_model=list[FreelancerPaymentResponse])
def get_freelancer_payments(
    company_id: Optional[int] = None,
    freelancer_user_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role not in ADMIN_ROLES and current_user.role != "freelancer":
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to view freelancer payments",
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
                detail="Invalid freelancer payment status",
            )

        query = query.filter(
            models.FreelancerPayment.status == status_value
        )

    payments = query.order_by(
        models.FreelancerPayment.id.desc()
    ).all()

    return payments


@router.put("/payments/{payment_id}", response_model=FreelancerPaymentResponse)
def update_freelancer_payment(
    payment_id: int,
    payment_update: FreelancerPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager", "accountant"])
    ),
):
    payment = db.query(models.FreelancerPayment).filter(
        models.FreelancerPayment.id == payment_id
    ).first()

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Freelancer payment not found",
        )

    if current_user.role != "super-admin":
        if payment.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another company payment",
            )

    update_data = payment_update.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"]:
        status_value = update_data["status"].strip().lower()

        if status_value not in FREELANCER_PAYMENT_ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid freelancer payment status",
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