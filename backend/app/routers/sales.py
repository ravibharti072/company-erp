from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.core.dependencies import (
    get_current_user,
    has_portal_access,
    normalize_role,
)
from app.schemas_modules.sales import (
    CRMProjectCreate,
    CRMProjectResponse,
    CRMProjectStatusUpdate,
    CRMProjectUpdate,
    CRMSummaryResponse,
    LeadCompleteRequest,
    LeadConvertRequest,
    LeadConvertResponse,
    LeadDeliverRequest,
    LeadPaymentSummaryResponse,
    ReceivedPaymentCreate,
    ReceivedPaymentResponse,
    ReceivedPaymentSummaryResponse,
    ReceivedPaymentUpdate,
    SalesCommissionResponse,
    SalesCommissionUpdate,
    SalesLeadCreate,
    SalesLeadResponse,
    SalesLeadStatusUpdate,
    SalesLeadUpdate,
)


router = APIRouter(
    prefix="/sales",
    tags=["Sales CRM"],
)


SALES_REP_ROLE = "sales-representative"

SALES_ADMIN_ROLES = {
    "super-admin",
    "company-admin",
    "admin",
    "owner",
}

CRM_ALLOWED_STATUSES = {
    "new",
    "contacted",
    "interested",
    "proposal-sent",
    "converted",
    "delivered",
    "completed",
    "not-interested",
    "lost",
}

CRM_ONGOING_STATUSES = {
    "new",
    "contacted",
    "interested",
    "proposal-sent",
}

CRM_LOST_STATUSES = {
    "not-interested",
    "lost",
}

SERVICE_TYPES = {
    "custom_software",
    "existing_software",
    "social_media_management",
    "internal_project",
    "other",
}

PROJECT_REQUIRED_SERVICE_TYPES = {
    "custom_software",
    "social_media_management",
    "internal_project",
}

CRM_PROJECT_ALLOWED_STATUSES = {
    "ongoing",
    "in-progress",
    "delivered",
    "completed",
    "cancelled",
}

CRM_PROJECT_TYPES = {
    "custom_software",
    "existing_software",
    "social_media_management",
    "internal_project",
    "other",
}

PRIORITIES = {
    "low",
    "medium",
    "high",
    "urgent",
}

COMMISSION_ALLOWED_STATUSES = {
    "pending",
    "paid",
    "cancelled",
}

PAYMENT_TYPES = {
    "lead_payment",
    "other_payment",
}

PAYMENT_METHODS = {
    "cash",
    "upi",
    "bank_transfer",
    "cheque",
    "card",
    "other",
}


# -----------------------------
# HELPERS
# -----------------------------

def normalize_status(value: str | None, default: str = "new") -> str:
    if not value:
        return default

    cleaned = value.strip().lower().replace("_", "-")

    if cleaned == "proposal_sent":
        return "proposal-sent"

    if cleaned == "not_interested":
        return "not-interested"

    return cleaned


def normalize_service_type(value: str | None) -> str:
    if not value:
        return "custom_software"

    cleaned = value.strip().lower().replace("-", "_").replace(" ", "_")

    service_aliases = {
        "custom": "custom_software",
        "custom_software_development": "custom_software",
        "software": "custom_software",
        "existing": "existing_software",
        "existing_product": "existing_software",
        "existing_software_sale": "existing_software",
        "social_media": "social_media_management",
        "smm": "social_media_management",
        "internal": "internal_project",
        "internal_task": "internal_project",
    }

    cleaned = service_aliases.get(cleaned, cleaned)

    if cleaned not in SERVICE_TYPES:
        return "other"

    return cleaned


def normalize_project_type(value: str | None) -> str:
    cleaned = normalize_service_type(value)

    if cleaned not in CRM_PROJECT_TYPES:
        return "other"

    return cleaned


def normalize_priority(value: str | None) -> str:
    if not value:
        return "medium"

    cleaned = value.strip().lower()

    if cleaned not in PRIORITIES:
        return "medium"

    return cleaned


def normalize_payment_type(value: str | None) -> str:
    if not value:
        return "lead_payment"

    cleaned = value.strip().lower().replace("-", "_").replace(" ", "_")

    payment_aliases = {
        "lead": "lead_payment",
        "sales": "lead_payment",
        "client": "lead_payment",
        "other": "other_payment",
        "other_income": "other_payment",
        "income": "other_payment",
    }

    cleaned = payment_aliases.get(cleaned, cleaned)

    if cleaned not in PAYMENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Invalid payment type",
        )

    return cleaned


def normalize_payment_method(value: str | None) -> str:
    if not value:
        return "cash"

    cleaned = value.strip().lower().replace("-", "_").replace(" ", "_")

    method_aliases = {
        "bank": "bank_transfer",
        "banktransfer": "bank_transfer",
        "bank_transfer": "bank_transfer",
        "online": "upi",
        "gpay": "upi",
        "phonepe": "upi",
        "paytm": "upi",
    }

    cleaned = method_aliases.get(cleaned, cleaned)

    if cleaned not in PAYMENT_METHODS:
        return "other"

    return cleaned


def is_admin_user(user: models.User) -> bool:
    return normalize_role(user.role) in SALES_ADMIN_ROLES


def is_sales_rep_user(user: models.User) -> bool:
    return normalize_role(user.role) == SALES_REP_ROLE


def is_sales_portal_user(user: models.User) -> bool:
    return is_admin_user(user) or has_portal_access(user, "sales")


def ensure_sales_permission(current_user: models.User):
    if not is_sales_portal_user(current_user):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to Sales portal",
        )


def ensure_sales_admin(current_user: models.User):
    if not is_admin_user(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only admin can perform this sales action",
        )


def ensure_company_user(current_user: models.User):
    if normalize_role(current_user.role) != "super-admin" and not current_user.company_id:
        raise HTTPException(
            status_code=400,
            detail="Current user is not linked with any company",
        )


def validate_lead_status(status: str):
    if status not in CRM_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid lead status",
        )


def validate_project_status(status: str):
    if status not in CRM_PROJECT_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid project status",
        )


def validate_commission_status(status: str):
    if status not in COMMISSION_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid commission status",
        )


def get_sales_access_user_or_404(
    db: Session,
    sales_user_id: int,
    current_user: models.User,
) -> models.User:
    sales_user = db.query(models.User).filter(
        models.User.id == sales_user_id
    ).first()

    if not sales_user:
        raise HTTPException(
            status_code=404,
            detail="Sales user not found",
        )

    if not sales_user.is_active:
        raise HTTPException(
            status_code=400,
            detail="Selected sales user is inactive",
        )

    if not has_portal_access(sales_user, "sales") and not is_sales_rep_user(sales_user):
        raise HTTPException(
            status_code=400,
            detail="Assigned user must have Sales portal access",
        )

    if normalize_role(current_user.role) != "super-admin":
        if sales_user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot assign lead to another company user",
            )

    if not sales_user.company_id:
        raise HTTPException(
            status_code=400,
            detail="Selected sales user is not linked with any company",
        )

    return sales_user


def get_lead_or_404(db: Session, lead_id: int) -> models.SalesLead:
    lead = db.query(models.SalesLead).filter(
        models.SalesLead.id == lead_id
    ).first()

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Sales lead not found",
        )

    return lead


def ensure_lead_access(
    lead: models.SalesLead,
    current_user: models.User,
    action_text: str = "access",
):
    if is_admin_user(current_user):
        if normalize_role(current_user.role) == "super-admin":
            return

        if lead.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail=f"You cannot {action_text} another company lead",
            )

        return

    if has_portal_access(current_user, "sales"):
        if (
            lead.sales_rep_user_id == current_user.id
            or lead.created_by_user_id == current_user.id
        ):
            return

        raise HTTPException(
            status_code=403,
            detail=f"You cannot {action_text} another user's lead",
        )

    raise HTTPException(
        status_code=403,
        detail=f"You do not have permission to {action_text} this lead",
    )


def apply_lead_status_dates(lead: models.SalesLead, status: str):
    today = date.today()

    if status == "proposal-sent" and not lead.proposal_sent_date:
        lead.proposal_sent_date = today

    if status == "converted" and not lead.converted_date:
        lead.converted_date = today

    if status == "delivered" and not lead.delivered_date:
        lead.delivered_date = today

    if status == "completed" and not lead.completed_date:
        lead.completed_date = today

    if status in CRM_LOST_STATUSES and not lead.lost_date:
        lead.lost_date = today


def get_project_or_404(db: Session, project_id: int) -> models.CRMProject:
    project = db.query(models.CRMProject).filter(
        models.CRMProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="CRM project not found",
        )

    return project


def ensure_project_access(
    project: models.CRMProject,
    current_user: models.User,
    action_text: str = "access",
):
    if is_admin_user(current_user):
        if normalize_role(current_user.role) == "super-admin":
            return

        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail=f"You cannot {action_text} another company project",
            )

        return

    if has_portal_access(current_user, "sales"):
        if (
            project.assigned_to_user_id == current_user.id
            or project.created_by_user_id == current_user.id
        ):
            return

        if project.lead:
            if (
                project.lead.sales_rep_user_id == current_user.id
                or project.lead.created_by_user_id == current_user.id
            ):
                return

    raise HTTPException(
        status_code=403,
        detail=f"You do not have permission to {action_text} this project",
    )


def apply_project_status_dates(project: models.CRMProject, status: str):
    today = date.today()

    if status == "delivered" and not project.delivered_date:
        project.delivered_date = today

    if status == "completed" and not project.completed_date:
        project.completed_date = today


def get_payment_or_404(db: Session, payment_id: int) -> models.ReceivedPayment:
    payment = db.query(models.ReceivedPayment).filter(
        models.ReceivedPayment.id == payment_id
    ).first()

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Received payment not found",
        )

    return payment


def ensure_payment_access(
    payment: models.ReceivedPayment,
    current_user: models.User,
    action_text: str = "access",
):
    if is_admin_user(current_user):
        if normalize_role(current_user.role) == "super-admin":
            return

        if payment.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail=f"You cannot {action_text} another company payment",
            )

        return

    if payment.payment_type == "other_payment":
        raise HTTPException(
            status_code=403,
            detail=f"Only admin can {action_text} other payments",
        )

    if has_portal_access(current_user, "sales"):
        if payment.created_by_user_id == current_user.id:
            return

        if payment.lead:
            if (
                payment.lead.sales_rep_user_id == current_user.id
                or payment.lead.created_by_user_id == current_user.id
            ):
                return

    raise HTTPException(
        status_code=403,
        detail=f"You do not have permission to {action_text} this payment",
    )


def safe_sum(values):
    return float(sum(value or 0 for value in values))


def get_lead_payment_status(final_sale_amount: float, total_received: float) -> str:
    if final_sale_amount <= 0 and total_received > 0:
        return "advance_received"

    if total_received <= 0:
        return "unpaid"

    if final_sale_amount > 0 and total_received >= final_sale_amount:
        return "paid"

    return "partial"


# -----------------------------
# SALES LEAD APIs
# -----------------------------

@router.post("/leads", response_model=SalesLeadResponse)
def create_sales_lead(
    lead: SalesLeadCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_permission(current_user)

    sales_rep_user_id = None
    company_id = None

    if is_admin_user(current_user):
        if lead.sales_rep_user_id:
            sales_user = get_sales_access_user_or_404(
                db=db,
                sales_user_id=lead.sales_rep_user_id,
                current_user=current_user,
            )

            sales_rep_user_id = sales_user.id
            company_id = sales_user.company_id
        else:
            company_id = current_user.company_id

            if normalize_role(current_user.role) == "super-admin" and not company_id:
                raise HTTPException(
                    status_code=400,
                    detail="Super admin must assign this lead to a company sales user",
                )

            if not company_id:
                raise HTTPException(
                    status_code=400,
                    detail="Current admin is not linked with any company",
                )

    else:
        company_id = current_user.company_id

        if not company_id:
            raise HTTPException(
                status_code=400,
                detail="Current user is not linked with any company",
            )

        sales_rep_user_id = current_user.id

    status_value = normalize_status(lead.status)
    validate_lead_status(status_value)

    service_type = normalize_service_type(
        lead.service_type or lead.service_interest
    )

    priority = normalize_priority(lead.priority)

    new_lead = models.SalesLead(
        company_id=company_id,
        sales_rep_user_id=sales_rep_user_id,
        created_by_user_id=current_user.id,

        client_name=lead.client_name,
        client_phone=lead.client_phone,
        client_email=lead.client_email,
        client_company_name=lead.client_company_name,
        client_address=lead.client_address,

        service_interest=lead.service_interest or service_type,
        service_type=service_type,
        lead_source=lead.lead_source,

        status=status_value,
        priority=priority,

        expected_value=lead.expected_value,
        proposal_amount=lead.proposal_amount,
        final_sale_amount=lead.final_sale_amount,

        recurring_amount=lead.recurring_amount,
        recurring_cycle=lead.recurring_cycle,

        follow_up_date=lead.follow_up_date,

        proposal_sent_date=lead.proposal_sent_date,
        converted_date=lead.converted_date,
        delivered_date=lead.delivered_date,
        completed_date=lead.completed_date,
        lost_date=lead.lost_date,

        project_required=service_type in PROJECT_REQUIRED_SERVICE_TYPES,
        project_created=lead.project_created,

        delivery_notes=lead.delivery_notes,
        completion_notes=lead.completion_notes,
        lost_reason=lead.lost_reason,

        notes=lead.notes,
        is_active=lead.is_active,
    )

    apply_lead_status_dates(new_lead, status_value)

    db.add(new_lead)
    db.commit()
    db.refresh(new_lead)

    return new_lead


@router.get("/leads", response_model=list[SalesLeadResponse])
def get_sales_leads(
    company_id: int | None = None,
    sales_rep_user_id: int | None = None,
    status_filter: str | None = None,
    service_type: str | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_permission(current_user)

    query = db.query(models.SalesLead)

    if is_admin_user(current_user):
        if normalize_role(current_user.role) == "super-admin":
            if company_id:
                query = query.filter(models.SalesLead.company_id == company_id)
        else:
            query = query.filter(
                models.SalesLead.company_id == current_user.company_id
            )

    else:
        query = query.filter(
            or_(
                models.SalesLead.sales_rep_user_id == current_user.id,
                models.SalesLead.created_by_user_id == current_user.id,
            )
        )

    if active_only:
        query = query.filter(models.SalesLead.is_active == True)

    if sales_rep_user_id:
        if not is_admin_user(current_user) and sales_rep_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot filter another user's leads",
            )

        query = query.filter(
            models.SalesLead.sales_rep_user_id == sales_rep_user_id
        )

    if status_filter:
        status_value = normalize_status(status_filter)
        validate_lead_status(status_value)

        query = query.filter(models.SalesLead.status == status_value)

    if service_type:
        service_value = normalize_service_type(service_type)
        query = query.filter(models.SalesLead.service_type == service_value)

    leads = query.order_by(
        models.SalesLead.id.desc()
    ).all()

    return leads


@router.get("/leads/{lead_id}", response_model=SalesLeadResponse)
def get_sales_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = get_lead_or_404(db, lead_id)

    ensure_lead_access(lead, current_user, "access")

    return lead


@router.put("/leads/{lead_id}", response_model=SalesLeadResponse)
def update_sales_lead(
    lead_id: int,
    lead_update: SalesLeadUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = get_lead_or_404(db, lead_id)

    ensure_lead_access(lead, current_user, "update")

    is_current_admin = is_admin_user(current_user)

    update_data = lead_update.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"]:
        status_value = normalize_status(update_data["status"])
        validate_lead_status(status_value)

        update_data["status"] = status_value
        apply_lead_status_dates(lead, status_value)

    if "priority" in update_data and update_data["priority"]:
        update_data["priority"] = normalize_priority(update_data["priority"])

    if "service_type" in update_data and update_data["service_type"]:
        service_type = normalize_service_type(update_data["service_type"])
        update_data["service_type"] = service_type

        if not update_data.get("service_interest"):
            update_data["service_interest"] = service_type

        update_data["project_required"] = service_type in PROJECT_REQUIRED_SERVICE_TYPES

    elif "service_interest" in update_data and update_data["service_interest"]:
        service_type = normalize_service_type(update_data["service_interest"])
        update_data["service_type"] = service_type
        update_data["project_required"] = service_type in PROJECT_REQUIRED_SERVICE_TYPES

    if "sales_rep_user_id" in update_data and update_data["sales_rep_user_id"]:
        if not is_current_admin:
            raise HTTPException(
                status_code=403,
                detail="Only admin can reassign sales lead",
            )

        new_sales_user = get_sales_access_user_or_404(
            db=db,
            sales_user_id=update_data["sales_rep_user_id"],
            current_user=current_user,
        )

        update_data["company_id"] = new_sales_user.company_id
        update_data["sales_rep_user_id"] = new_sales_user.id

    if "sales_rep_user_id" in update_data and update_data["sales_rep_user_id"] is None:
        if not is_current_admin:
            raise HTTPException(
                status_code=403,
                detail="Only admin can remove lead assignment",
            )

    for key, value in update_data.items():
        setattr(lead, key, value)

    lead.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(lead)

    return lead


@router.put("/leads/{lead_id}/status", response_model=SalesLeadResponse)
def update_sales_lead_status(
    lead_id: int,
    status_data: SalesLeadStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = get_lead_or_404(db, lead_id)

    ensure_lead_access(lead, current_user, "update")

    status_value = normalize_status(status_data.status)
    validate_lead_status(status_value)

    lead.status = status_value
    apply_lead_status_dates(lead, status_value)

    if status_data.notes is not None:
        lead.notes = status_data.notes

    if status_data.follow_up_date is not None:
        lead.follow_up_date = status_data.follow_up_date

    if status_data.lost_reason is not None:
        lead.lost_reason = status_data.lost_reason

    if status_data.delivery_notes is not None:
        lead.delivery_notes = status_data.delivery_notes

    if status_data.completion_notes is not None:
        lead.completion_notes = status_data.completion_notes

    lead.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(lead)

    return lead


@router.post("/leads/{lead_id}/convert", response_model=LeadConvertResponse)
def convert_sales_lead(
    lead_id: int,
    convert_data: LeadConvertRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = get_lead_or_404(db, lead_id)

    ensure_lead_access(lead, current_user, "convert")

    if lead.status in {"converted", "delivered", "completed"}:
        raise HTTPException(
            status_code=400,
            detail="Lead is already converted",
        )

    if lead.status in CRM_LOST_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Lost or not interested lead cannot be converted",
        )

    if convert_data.final_sale_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Final sale amount must be greater than 0",
        )

    if convert_data.commission_percentage < 0:
        raise HTTPException(
            status_code=400,
            detail="Commission percentage cannot be negative",
        )

    existing_commission = db.query(models.SalesCommission).filter(
        models.SalesCommission.lead_id == lead.id
    ).first()

    new_commission = None

    if convert_data.commission_percentage > 0:
        if existing_commission:
            raise HTTPException(
                status_code=400,
                detail="Commission already generated for this lead",
            )

        commission_amount = round(
            convert_data.final_sale_amount * convert_data.commission_percentage / 100,
            2,
        )

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

    lead.status = "converted"
    lead.final_sale_amount = convert_data.final_sale_amount
    lead.converted_date = date.today()
    lead.project_required = lead.service_type in PROJECT_REQUIRED_SERVICE_TYPES

    if convert_data.remarks:
        lead.notes = convert_data.remarks

    lead.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(lead)

    if new_commission:
        db.refresh(new_commission)

    return {
        "message": "Lead converted successfully",
        "lead": lead,
        "commission": new_commission,
    }


@router.post("/leads/{lead_id}/deliver", response_model=SalesLeadResponse)
def deliver_sales_lead(
    lead_id: int,
    deliver_data: LeadDeliverRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = get_lead_or_404(db, lead_id)

    ensure_lead_access(lead, current_user, "deliver")

    if lead.status not in {"converted", "delivered", "completed"}:
        raise HTTPException(
            status_code=400,
            detail="Only converted lead can be marked as delivered",
        )

    lead.status = "delivered"
    lead.delivered_date = date.today()

    if deliver_data.delivery_notes is not None:
        lead.delivery_notes = deliver_data.delivery_notes

    lead.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(lead)

    return lead


@router.post("/leads/{lead_id}/complete", response_model=SalesLeadResponse)
def complete_sales_lead(
    lead_id: int,
    complete_data: LeadCompleteRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = get_lead_or_404(db, lead_id)

    ensure_lead_access(lead, current_user, "complete")

    if lead.status not in {"converted", "delivered", "completed"}:
        raise HTTPException(
            status_code=400,
            detail="Only converted or delivered lead can be completed",
        )

    lead.status = "completed"
    lead.completed_date = date.today()

    if complete_data.completion_notes is not None:
        lead.completion_notes = complete_data.completion_notes

    lead.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(lead)

    return lead


@router.post("/leads/{lead_id}/create-project", response_model=CRMProjectResponse)
def create_project_from_lead(
    lead_id: int,
    project_data: CRMProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = get_lead_or_404(db, lead_id)

    ensure_lead_access(lead, current_user, "create project from")

    if lead.status not in {"converted", "delivered", "completed"}:
        raise HTTPException(
            status_code=400,
            detail="Project can be created only after lead conversion",
        )

    if lead.project_created:
        existing_project = db.query(models.CRMProject).filter(
            models.CRMProject.lead_id == lead.id,
            models.CRMProject.is_active == True,
        ).first()

        if existing_project:
            raise HTTPException(
                status_code=400,
                detail="Project already created for this lead",
            )

    project_type = normalize_project_type(
        project_data.project_type or lead.service_type
    )

    status_value = normalize_status(project_data.status, default="ongoing")
    validate_project_status(status_value)

    priority = normalize_priority(project_data.priority)

    new_project = models.CRMProject(
        company_id=lead.company_id,
        lead_id=lead.id,
        assigned_to_user_id=project_data.assigned_to_user_id,
        created_by_user_id=current_user.id,

        title=project_data.title or f"{lead.client_name} Project",
        description=project_data.description,

        project_type=project_type,
        priority=priority,
        status=status_value,

        client_name=project_data.client_name or lead.client_name,
        client_company_name=project_data.client_company_name or lead.client_company_name,

        project_amount=project_data.project_amount
        if project_data.project_amount is not None
        else lead.final_sale_amount,

        recurring_amount=project_data.recurring_amount or lead.recurring_amount,
        recurring_cycle=project_data.recurring_cycle or lead.recurring_cycle,

        start_date=project_data.start_date or date.today(),
        due_date=project_data.due_date,
        delivered_date=project_data.delivered_date,
        completed_date=project_data.completed_date,

        submission_note=project_data.submission_note,
        submission_link=project_data.submission_link,
        admin_remarks=project_data.admin_remarks,

        is_active=project_data.is_active,
    )

    apply_project_status_dates(new_project, status_value)

    lead.project_required = True
    lead.project_created = True
    lead.updated_at = datetime.utcnow()

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return new_project


@router.delete("/leads/{lead_id}")
def delete_sales_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_admin(current_user)

    lead = get_lead_or_404(db, lead_id)

    if normalize_role(current_user.role) != "super-admin":
        if lead.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot delete another company lead",
            )

    commission = db.query(models.SalesCommission).filter(
        models.SalesCommission.lead_id == lead.id
    ).first()

    if commission:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete lead because commission exists",
        )

    received_payment = db.query(models.ReceivedPayment).filter(
        models.ReceivedPayment.lead_id == lead.id,
        models.ReceivedPayment.is_active == True,
    ).first()

    if received_payment:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete lead because received payment exists",
        )

    project = db.query(models.CRMProject).filter(
        models.CRMProject.lead_id == lead.id
    ).first()

    if project:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete lead because CRM project exists",
        )

    db.delete(lead)
    db.commit()

    return {
        "message": "Sales lead deleted successfully",
    }


# -----------------------------
# RECEIVED PAYMENT APIs
# -----------------------------

@router.post("/payments", response_model=ReceivedPaymentResponse)
def create_received_payment(
    payment: ReceivedPaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_permission(current_user)

    if payment.amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Payment amount must be greater than 0",
        )

    payment_type = normalize_payment_type(payment.payment_type)
    payment_method = normalize_payment_method(payment.payment_method)

    linked_lead = None

    if payment.lead_id:
        linked_lead = get_lead_or_404(db, payment.lead_id)
        ensure_lead_access(linked_lead, current_user, "add payment to")

        company_id = linked_lead.company_id
        payment_type = "lead_payment"

    else:
        if payment_type != "other_payment":
            raise HTTPException(
                status_code=400,
                detail="Lead payment requires lead_id. Use other_payment for payment not linked with lead.",
            )

        ensure_sales_admin(current_user)
        ensure_company_user(current_user)

        company_id = current_user.company_id

        if normalize_role(current_user.role) == "super-admin" and not company_id:
            raise HTTPException(
                status_code=400,
                detail="Super admin must use company-linked account to add other payment",
            )

    new_payment = models.ReceivedPayment(
        company_id=company_id,
        lead_id=linked_lead.id if linked_lead else None,
        created_by_user_id=current_user.id,

        payment_type=payment_type,
        payment_title=payment.payment_title
        or (f"Payment from {linked_lead.client_name}" if linked_lead else "Other payment"),

        payer_name=payment.payer_name or (linked_lead.client_name if linked_lead else None),
        payer_phone=payment.payer_phone or (linked_lead.client_phone if linked_lead else None),
        payer_email=payment.payer_email or (linked_lead.client_email if linked_lead else None),

        amount=payment.amount,

        payment_method=payment_method,
        payment_date=payment.payment_date or date.today(),

        reference_number=payment.reference_number,
        remarks=payment.remarks,

        is_active=payment.is_active,
    )

    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)

    return new_payment


@router.get("/payments", response_model=list[ReceivedPaymentResponse])
def get_received_payments(
    company_id: int | None = None,
    lead_id: int | None = None,
    payment_type: str | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_permission(current_user)

    query = db.query(models.ReceivedPayment)

    if is_admin_user(current_user):
        if normalize_role(current_user.role) == "super-admin":
            if company_id:
                query = query.filter(models.ReceivedPayment.company_id == company_id)
        else:
            query = query.filter(
                models.ReceivedPayment.company_id == current_user.company_id
            )

    else:
        query = query.outerjoin(
            models.SalesLead,
            models.ReceivedPayment.lead_id == models.SalesLead.id,
        ).filter(
            or_(
                and_(
                    models.ReceivedPayment.payment_type == "lead_payment",
                    models.ReceivedPayment.created_by_user_id == current_user.id,
                ),
                and_(
                    models.ReceivedPayment.payment_type == "lead_payment",
                    models.SalesLead.sales_rep_user_id == current_user.id,
                ),
                and_(
                    models.ReceivedPayment.payment_type == "lead_payment",
                    models.SalesLead.created_by_user_id == current_user.id,
                ),
            )
        )

    if active_only:
        query = query.filter(models.ReceivedPayment.is_active == True)

    if lead_id:
        linked_lead = get_lead_or_404(db, lead_id)
        ensure_lead_access(linked_lead, current_user, "view payment of")

        query = query.filter(models.ReceivedPayment.lead_id == lead_id)

    if payment_type:
        type_value = normalize_payment_type(payment_type)
        query = query.filter(models.ReceivedPayment.payment_type == type_value)

    payments = query.order_by(
        models.ReceivedPayment.payment_date.desc(),
        models.ReceivedPayment.id.desc(),
    ).all()

    return payments


@router.get("/payments/summary", response_model=ReceivedPaymentSummaryResponse)
def get_received_payment_summary(
    company_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_permission(current_user)

    payments_query = db.query(models.ReceivedPayment).filter(
        models.ReceivedPayment.is_active == True
    )

    leads_query = db.query(models.SalesLead).filter(
        models.SalesLead.is_active == True
    )

    if is_admin_user(current_user):
        if normalize_role(current_user.role) == "super-admin":
            if company_id:
                payments_query = payments_query.filter(
                    models.ReceivedPayment.company_id == company_id
                )
                leads_query = leads_query.filter(
                    models.SalesLead.company_id == company_id
                )
        else:
            payments_query = payments_query.filter(
                models.ReceivedPayment.company_id == current_user.company_id
            )
            leads_query = leads_query.filter(
                models.SalesLead.company_id == current_user.company_id
            )

    else:
        payments_query = payments_query.outerjoin(
            models.SalesLead,
            models.ReceivedPayment.lead_id == models.SalesLead.id,
        ).filter(
            or_(
                and_(
                    models.ReceivedPayment.payment_type == "lead_payment",
                    models.ReceivedPayment.created_by_user_id == current_user.id,
                ),
                and_(
                    models.ReceivedPayment.payment_type == "lead_payment",
                    models.SalesLead.sales_rep_user_id == current_user.id,
                ),
                and_(
                    models.ReceivedPayment.payment_type == "lead_payment",
                    models.SalesLead.created_by_user_id == current_user.id,
                ),
            )
        )

        leads_query = leads_query.filter(
            or_(
                models.SalesLead.sales_rep_user_id == current_user.id,
                models.SalesLead.created_by_user_id == current_user.id,
            )
        )

    payments = payments_query.all()
    leads = leads_query.all()

    today = date.today()
    first_day_this_month = date(today.year, today.month, 1)

    total_received = safe_sum([payment.amount for payment in payments])
    total_lead_payments = safe_sum(
        [payment.amount for payment in payments if payment.payment_type == "lead_payment"]
    )
    total_other_payments = safe_sum(
        [payment.amount for payment in payments if payment.payment_type == "other_payment"]
    )

    today_received = safe_sum(
        [payment.amount for payment in payments if payment.payment_date == today]
    )
    this_month_received = safe_sum(
        [
            payment.amount
            for payment in payments
            if payment.payment_date and payment.payment_date >= first_day_this_month
        ]
    )

    lead_ids = [lead.id for lead in leads]

    received_by_lead = {}

    if lead_ids:
        lead_payments = db.query(models.ReceivedPayment).filter(
            models.ReceivedPayment.is_active == True,
            models.ReceivedPayment.payment_type == "lead_payment",
            models.ReceivedPayment.lead_id.in_(lead_ids),
        ).all()

        for payment in lead_payments:
            received_by_lead[payment.lead_id] = received_by_lead.get(payment.lead_id, 0) + float(payment.amount or 0)

    total_pending_due_from_leads = 0

    for lead in leads:
        final_sale_amount = float(lead.final_sale_amount or 0)
        total_paid_for_lead = float(received_by_lead.get(lead.id, 0))

        if final_sale_amount > total_paid_for_lead:
            total_pending_due_from_leads += final_sale_amount - total_paid_for_lead

    lead_payment_count = len(
        [payment for payment in payments if payment.payment_type == "lead_payment"]
    )
    other_payment_count = len(
        [payment for payment in payments if payment.payment_type == "other_payment"]
    )

    return {
        "total_received": total_received,
        "total_lead_payments": total_lead_payments,
        "total_other_payments": total_other_payments,
        "today_received": today_received,
        "this_month_received": this_month_received,

        "total_pending_due_from_leads": total_pending_due_from_leads,

        "lead_payment_count": lead_payment_count,
        "other_payment_count": other_payment_count,
        "total_payment_count": len(payments),
    }


@router.get("/leads/{lead_id}/payments", response_model=list[ReceivedPaymentResponse])
def get_lead_received_payments(
    lead_id: int,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = get_lead_or_404(db, lead_id)
    ensure_lead_access(lead, current_user, "view payments of")

    query = db.query(models.ReceivedPayment).filter(
        models.ReceivedPayment.lead_id == lead.id,
        models.ReceivedPayment.payment_type == "lead_payment",
    )

    if active_only:
        query = query.filter(models.ReceivedPayment.is_active == True)

    payments = query.order_by(
        models.ReceivedPayment.payment_date.desc(),
        models.ReceivedPayment.id.desc(),
    ).all()

    return payments


@router.get("/leads/{lead_id}/payment-summary", response_model=LeadPaymentSummaryResponse)
def get_lead_payment_summary(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    lead = get_lead_or_404(db, lead_id)
    ensure_lead_access(lead, current_user, "view payment summary of")

    payments = db.query(models.ReceivedPayment).filter(
        models.ReceivedPayment.lead_id == lead.id,
        models.ReceivedPayment.payment_type == "lead_payment",
        models.ReceivedPayment.is_active == True,
    ).order_by(
        models.ReceivedPayment.payment_date.desc(),
        models.ReceivedPayment.id.desc(),
    ).all()

    final_sale_amount = float(lead.final_sale_amount or 0)
    total_received = safe_sum([payment.amount for payment in payments])
    due_amount = max(final_sale_amount - total_received, 0)

    return {
        "lead_id": lead.id,
        "client_name": lead.client_name,
        "final_sale_amount": final_sale_amount,
        "total_received": total_received,
        "due_amount": due_amount,
        "payment_status": get_lead_payment_status(final_sale_amount, total_received),
        "payments": payments,
    }


@router.put("/payments/{payment_id}", response_model=ReceivedPaymentResponse)
def update_received_payment(
    payment_id: int,
    payment_update: ReceivedPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    payment = get_payment_or_404(db, payment_id)

    ensure_payment_access(payment, current_user, "update")

    update_data = payment_update.model_dump(exclude_unset=True)

    if "amount" in update_data and update_data["amount"] is not None:
        if update_data["amount"] <= 0:
            raise HTTPException(
                status_code=400,
                detail="Payment amount must be greater than 0",
            )

    if "payment_method" in update_data and update_data["payment_method"]:
        update_data["payment_method"] = normalize_payment_method(
            update_data["payment_method"]
        )

    if "payment_type" in update_data and update_data["payment_type"]:
        new_payment_type = normalize_payment_type(update_data["payment_type"])

        if payment.payment_type == "other_payment" and not is_admin_user(current_user):
            raise HTTPException(
                status_code=403,
                detail="Only admin can update other payment",
            )

        update_data["payment_type"] = new_payment_type

    if "lead_id" in update_data:
        if update_data["lead_id"]:
            linked_lead = get_lead_or_404(db, update_data["lead_id"])
            ensure_lead_access(linked_lead, current_user, "link payment with")

            update_data["company_id"] = linked_lead.company_id
            update_data["payment_type"] = "lead_payment"

            if not update_data.get("payer_name"):
                update_data["payer_name"] = linked_lead.client_name

            if not update_data.get("payer_phone"):
                update_data["payer_phone"] = linked_lead.client_phone

            if not update_data.get("payer_email"):
                update_data["payer_email"] = linked_lead.client_email

        else:
            ensure_sales_admin(current_user)
            update_data["payment_type"] = "other_payment"

    if update_data.get("payment_type") == "other_payment":
        ensure_sales_admin(current_user)

    for key, value in update_data.items():
        setattr(payment, key, value)

    payment.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(payment)

    return payment


@router.delete("/payments/{payment_id}")
def delete_received_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    payment = get_payment_or_404(db, payment_id)

    ensure_payment_access(payment, current_user, "delete")

    payment.is_active = False
    payment.updated_at = datetime.utcnow()

    db.commit()

    return {
        "message": "Received payment deleted successfully",
    }


# -----------------------------
# CRM PROJECT APIs
# -----------------------------

@router.post("/projects", response_model=CRMProjectResponse)
def create_crm_project(
    project: CRMProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_permission(current_user)

    linked_lead = None

    if project.lead_id:
        linked_lead = get_lead_or_404(db, project.lead_id)
        ensure_lead_access(linked_lead, current_user, "create project from")
        company_id = linked_lead.company_id
    else:
        ensure_company_user(current_user)
        company_id = current_user.company_id

        if normalize_role(current_user.role) == "super-admin" and not company_id:
            raise HTTPException(
                status_code=400,
                detail="Super admin must create project from a lead or use a company-linked account",
            )

    project_type = normalize_project_type(project.project_type)
    status_value = normalize_status(project.status, default="ongoing")

    validate_project_status(status_value)

    priority = normalize_priority(project.priority)

    new_project = models.CRMProject(
        company_id=company_id,
        lead_id=project.lead_id,

        assigned_to_user_id=project.assigned_to_user_id,
        created_by_user_id=current_user.id,

        title=project.title,
        description=project.description,

        project_type=project_type,
        priority=priority,
        status=status_value,

        client_name=project.client_name or (linked_lead.client_name if linked_lead else None),
        client_company_name=project.client_company_name
        or (linked_lead.client_company_name if linked_lead else None),

        project_amount=project.project_amount,
        recurring_amount=project.recurring_amount,
        recurring_cycle=project.recurring_cycle,

        start_date=project.start_date,
        due_date=project.due_date,
        delivered_date=project.delivered_date,
        completed_date=project.completed_date,

        submission_note=project.submission_note,
        submission_link=project.submission_link,

        admin_remarks=project.admin_remarks,

        is_active=project.is_active,
    )

    apply_project_status_dates(new_project, status_value)

    if linked_lead:
        linked_lead.project_required = True
        linked_lead.project_created = True
        linked_lead.updated_at = datetime.utcnow()

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return new_project


@router.get("/projects", response_model=list[CRMProjectResponse])
def get_crm_projects(
    company_id: int | None = None,
    status_filter: str | None = None,
    project_type: str | None = None,
    lead_id: int | None = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_permission(current_user)

    query = db.query(models.CRMProject)

    if is_admin_user(current_user):
        if normalize_role(current_user.role) == "super-admin":
            if company_id:
                query = query.filter(models.CRMProject.company_id == company_id)
        else:
            query = query.filter(
                models.CRMProject.company_id == current_user.company_id
            )

    else:
        query = query.outerjoin(models.SalesLead).filter(
            or_(
                models.CRMProject.assigned_to_user_id == current_user.id,
                models.CRMProject.created_by_user_id == current_user.id,
                models.SalesLead.sales_rep_user_id == current_user.id,
                models.SalesLead.created_by_user_id == current_user.id,
            )
        )

    if active_only:
        query = query.filter(models.CRMProject.is_active == True)

    if status_filter:
        status_value = normalize_status(status_filter, default="ongoing")
        validate_project_status(status_value)

        query = query.filter(models.CRMProject.status == status_value)

    if project_type:
        type_value = normalize_project_type(project_type)
        query = query.filter(models.CRMProject.project_type == type_value)

    if lead_id:
        query = query.filter(models.CRMProject.lead_id == lead_id)

    projects = query.order_by(
        models.CRMProject.id.desc()
    ).all()

    return projects


@router.get("/projects/{project_id}", response_model=CRMProjectResponse)
def get_crm_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = get_project_or_404(db, project_id)

    ensure_project_access(project, current_user, "access")

    return project


@router.put("/projects/{project_id}", response_model=CRMProjectResponse)
def update_crm_project(
    project_id: int,
    project_update: CRMProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = get_project_or_404(db, project_id)

    ensure_project_access(project, current_user, "update")

    update_data = project_update.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"]:
        status_value = normalize_status(update_data["status"], default="ongoing")
        validate_project_status(status_value)

        update_data["status"] = status_value
        apply_project_status_dates(project, status_value)

    if "project_type" in update_data and update_data["project_type"]:
        update_data["project_type"] = normalize_project_type(
            update_data["project_type"]
        )

    if "priority" in update_data and update_data["priority"]:
        update_data["priority"] = normalize_priority(update_data["priority"])

    if "lead_id" in update_data and update_data["lead_id"]:
        linked_lead = get_lead_or_404(db, update_data["lead_id"])
        ensure_lead_access(linked_lead, current_user, "link project with")

        update_data["company_id"] = linked_lead.company_id

    for key, value in update_data.items():
        setattr(project, key, value)

    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    return project


@router.put("/projects/{project_id}/status", response_model=CRMProjectResponse)
def update_crm_project_status(
    project_id: int,
    status_data: CRMProjectStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = get_project_or_404(db, project_id)

    ensure_project_access(project, current_user, "update")

    status_value = normalize_status(status_data.status, default="ongoing")
    validate_project_status(status_value)

    project.status = status_value
    apply_project_status_dates(project, status_value)

    if status_data.submission_note is not None:
        project.submission_note = status_data.submission_note

    if status_data.submission_link is not None:
        project.submission_link = status_data.submission_link

    if status_data.admin_remarks is not None:
        project.admin_remarks = status_data.admin_remarks

    project.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(project)

    return project


@router.delete("/projects/{project_id}")
def delete_crm_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_admin(current_user)

    project = get_project_or_404(db, project_id)

    if normalize_role(current_user.role) != "super-admin":
        if project.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot delete another company project",
            )

    linked_lead = None

    if project.lead_id:
        linked_lead = db.query(models.SalesLead).filter(
            models.SalesLead.id == project.lead_id
        ).first()

    db.delete(project)

    if linked_lead:
        remaining_project = db.query(models.CRMProject).filter(
            models.CRMProject.lead_id == linked_lead.id,
            models.CRMProject.id != project.id,
        ).first()

        if not remaining_project:
            linked_lead.project_created = False
            linked_lead.updated_at = datetime.utcnow()

    db.commit()

    return {
        "message": "CRM project deleted successfully",
    }


# -----------------------------
# SALES COMMISSION APIs
# -----------------------------

@router.get("/commissions", response_model=list[SalesCommissionResponse])
def get_sales_commissions(
    company_id: int | None = None,
    sales_rep_user_id: int | None = None,
    status_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_permission(current_user)

    query = db.query(models.SalesCommission)

    if is_admin_user(current_user):
        if normalize_role(current_user.role) == "super-admin":
            if company_id:
                query = query.filter(models.SalesCommission.company_id == company_id)
        else:
            query = query.filter(
                models.SalesCommission.company_id == current_user.company_id
            )

    else:
        query = query.outerjoin(models.SalesLead).filter(
            or_(
                models.SalesCommission.sales_rep_user_id == current_user.id,
                models.SalesLead.sales_rep_user_id == current_user.id,
                models.SalesLead.created_by_user_id == current_user.id,
            )
        )

    if sales_rep_user_id:
        if not is_admin_user(current_user) and sales_rep_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot filter another user's commission",
            )

        query = query.filter(
            models.SalesCommission.sales_rep_user_id == sales_rep_user_id
        )

    if status_filter:
        status_value = normalize_status(status_filter, default="pending")
        validate_commission_status(status_value)

        query = query.filter(models.SalesCommission.status == status_value)

    commissions = query.order_by(
        models.SalesCommission.id.desc()
    ).all()

    return commissions


@router.put("/commissions/{commission_id}", response_model=SalesCommissionResponse)
def update_sales_commission(
    commission_id: int,
    commission_update: SalesCommissionUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_admin(current_user)

    commission = db.query(models.SalesCommission).filter(
        models.SalesCommission.id == commission_id
    ).first()

    if not commission:
        raise HTTPException(
            status_code=404,
            detail="Commission not found",
        )

    if normalize_role(current_user.role) != "super-admin":
        if commission.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another company commission",
            )

    update_data = commission_update.model_dump(exclude_unset=True)

    if "status" in update_data and update_data["status"]:
        status_value = normalize_status(update_data["status"], default="pending")
        validate_commission_status(status_value)

        update_data["status"] = status_value

    for key, value in update_data.items():
        setattr(commission, key, value)

    commission.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(commission)

    return commission


# -----------------------------
# CRM SUMMARY API
# -----------------------------

@router.get("/summary", response_model=CRMSummaryResponse)
def get_crm_summary(
    company_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_sales_permission(current_user)

    leads_query = db.query(models.SalesLead)
    projects_query = db.query(models.CRMProject)

    if is_admin_user(current_user):
        if normalize_role(current_user.role) == "super-admin":
            if company_id:
                leads_query = leads_query.filter(models.SalesLead.company_id == company_id)
                projects_query = projects_query.filter(models.CRMProject.company_id == company_id)
        else:
            leads_query = leads_query.filter(
                models.SalesLead.company_id == current_user.company_id
            )
            projects_query = projects_query.filter(
                models.CRMProject.company_id == current_user.company_id
            )

    else:
        leads_query = leads_query.filter(
            or_(
                models.SalesLead.sales_rep_user_id == current_user.id,
                models.SalesLead.created_by_user_id == current_user.id,
            )
        )

        projects_query = projects_query.outerjoin(models.SalesLead).filter(
            or_(
                models.CRMProject.assigned_to_user_id == current_user.id,
                models.CRMProject.created_by_user_id == current_user.id,
                models.SalesLead.sales_rep_user_id == current_user.id,
                models.SalesLead.created_by_user_id == current_user.id,
            )
        )

    leads = leads_query.filter(models.SalesLead.is_active == True).all()
    projects = projects_query.filter(models.CRMProject.is_active == True).all()

    total_leads = len(leads)
    ongoing_leads = len(
        [lead for lead in leads if normalize_status(lead.status) in CRM_ONGOING_STATUSES]
    )
    converted_leads = len(
        [lead for lead in leads if normalize_status(lead.status) == "converted"]
    )
    delivered_leads = len(
        [lead for lead in leads if normalize_status(lead.status) == "delivered"]
    )
    completed_leads = len(
        [lead for lead in leads if normalize_status(lead.status) == "completed"]
    )
    lost_leads = len(
        [lead for lead in leads if normalize_status(lead.status) in CRM_LOST_STATUSES]
    )

    expected_value = safe_sum([lead.expected_value for lead in leads])
    proposal_value = safe_sum([lead.proposal_amount for lead in leads])
    final_sales = safe_sum([lead.final_sale_amount for lead in leads])

    total_projects = len(projects)
    ongoing_projects = len(
        [
            project
            for project in projects
            if normalize_status(project.status, default="ongoing")
            in {"ongoing", "in-progress"}
        ]
    )
    completed_projects = len(
        [
            project
            for project in projects
            if normalize_status(project.status, default="ongoing") == "completed"
        ]
    )

    return {
        "total_leads": total_leads,
        "ongoing_leads": ongoing_leads,
        "converted_leads": converted_leads,
        "delivered_leads": delivered_leads,
        "completed_leads": completed_leads,
        "lost_leads": lost_leads,

        "expected_value": expected_value,
        "proposal_value": proposal_value,
        "final_sales": final_sales,

        "total_projects": total_projects,
        "ongoing_projects": ongoing_projects,
        "completed_projects": completed_projects,
    }