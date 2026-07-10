from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app import models
from app.core.dependencies import (
    get_current_user,
    has_portal_access,
    normalize_role,
)
from app.database import get_db
from app.schemas_modules.commissions import (
    CommissionPaymentCreate,
    CommissionPaymentResponse,
    CommissionPercentageUpdate,
    CommissionResponse,
    CommissionSummaryResponse,
)


router = APIRouter(
    prefix="/commissions",
    tags=["Sales Commissions"],
)


COMMISSION_ADMIN_ROLES = {
    "super-admin",
    "company-admin",
    "admin",
    "owner",
}

PAYMENT_METHODS = {
    "cash",
    "upi",
    "bank_transfer",
    "cheque",
    "card",
    "other",
}


# =========================================================
# HELPERS
# =========================================================

def is_admin_user(user: models.User) -> bool:
    return normalize_role(user.role) in COMMISSION_ADMIN_ROLES


def ensure_commission_access(current_user: models.User):
    if is_admin_user(current_user):
        return

    if has_portal_access(current_user, "sales"):
        return

    if has_portal_access(current_user, "sales-commission"):
        return

    if has_portal_access(current_user, "sales_commission"):
        return

    raise HTTPException(
        status_code=403,
        detail="You do not have access to Sales Commission module",
    )


def ensure_commission_admin(current_user: models.User):
    if not is_admin_user(current_user):
        raise HTTPException(
            status_code=403,
            detail="Only admin can manage sales commission",
        )


def ensure_company_user(current_user: models.User):
    if (
        normalize_role(current_user.role) != "super-admin"
        and not current_user.company_id
    ):
        raise HTTPException(
            status_code=400,
            detail="Current user is not linked with any company",
        )


def normalize_payment_method(value: Optional[str]) -> str:
    if not value:
        return "cash"

    cleaned = (
        value.strip()
        .lower()
        .replace("-", "_")
        .replace(" ", "_")
    )

    method_aliases = {
        "bank": "bank_transfer",
        "banktransfer": "bank_transfer",
        "bank_transfer": "bank_transfer",
        "online": "upi",
        "gpay": "upi",
        "google_pay": "upi",
        "phonepe": "upi",
        "phone_pe": "upi",
        "paytm": "upi",
    }

    cleaned = method_aliases.get(cleaned, cleaned)

    if cleaned not in PAYMENT_METHODS:
        return "other"

    return cleaned


def get_commission_or_404(
    db: Session,
    commission_id: int,
) -> models.SalesCommission:
    commission = (
        db.query(models.SalesCommission)
        .filter(models.SalesCommission.id == commission_id)
        .first()
    )

    if not commission:
        raise HTTPException(
            status_code=404,
            detail="Sales commission not found",
        )

    return commission


def get_commission_payment_or_404(
    db: Session,
    payment_id: int,
) -> models.CommissionPayment:
    payment = (
        db.query(models.CommissionPayment)
        .filter(models.CommissionPayment.id == payment_id)
        .first()
    )

    if not payment:
        raise HTTPException(
            status_code=404,
            detail="Commission payment not found",
        )

    return payment


def ensure_commission_view_access(
    commission: models.SalesCommission,
    current_user: models.User,
):
    current_role = normalize_role(current_user.role)

    if is_admin_user(current_user):
        if current_role == "super-admin":
            return

        if commission.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access another company commission",
            )

        return

    has_sales_access = (
        has_portal_access(current_user, "sales")
        or has_portal_access(current_user, "sales-commission")
        or has_portal_access(current_user, "sales_commission")
    )

    if has_sales_access:
        if commission.sales_rep_user_id == current_user.id:
            return

        if commission.lead:
            if (
                commission.lead.sales_rep_user_id == current_user.id
                or commission.lead.created_by_user_id == current_user.id
            ):
                return

    raise HTTPException(
        status_code=403,
        detail="You do not have permission to access this commission",
    )


def ensure_commission_manage_access(
    commission: models.SalesCommission,
    current_user: models.User,
):
    ensure_commission_admin(current_user)

    current_role = normalize_role(current_user.role)

    if current_role == "super-admin":
        return

    if commission.company_id != current_user.company_id:
        raise HTTPException(
            status_code=403,
            detail="You cannot manage another company commission",
        )


def get_active_commission_payments(
    db: Session,
    commission_id: int,
) -> list[models.CommissionPayment]:
    return (
        db.query(models.CommissionPayment)
        .filter(
            models.CommissionPayment.commission_id == commission_id,
            models.CommissionPayment.is_active.is_(True),
        )
        .order_by(
            models.CommissionPayment.payment_date.desc(),
            models.CommissionPayment.id.desc(),
        )
        .all()
    )


def calculate_paid_amount(
    db: Session,
    commission_id: int,
) -> float:
    payments = get_active_commission_payments(db, commission_id)

    return float(
        sum(float(payment.amount or 0) for payment in payments)
    )


def sync_commission_payment_status(
    db: Session,
    commission: models.SalesCommission,
):
    paid_amount = calculate_paid_amount(db, commission.id)
    commission_amount = float(commission.commission_amount or 0)

    commission.paid_amount = round(paid_amount, 2)

    active_payments = get_active_commission_payments(
        db,
        commission.id,
    )

    if active_payments:
        latest_payment = active_payments[0]
        commission.payment_date = latest_payment.payment_date
        commission.payment_method = latest_payment.payment_method
    else:
        commission.payment_date = None
        commission.payment_method = None

    if commission_amount <= 0:
        commission.status = "pending"
    elif paid_amount <= 0:
        commission.status = "pending"
    elif paid_amount < commission_amount:
        commission.status = "partial"
    else:
        commission.status = "paid"

    commission.updated_at = datetime.utcnow()


def serialize_commission(
    db: Session,
    commission: models.SalesCommission,
) -> dict:
    payments = get_active_commission_payments(
        db,
        commission.id,
    )

    paid_amount = float(
        sum(float(payment.amount or 0) for payment in payments)
    )

    commission_amount = float(
        commission.commission_amount or 0
    )

    due_amount = max(
        commission_amount - paid_amount,
        0,
    )

    return {
        "id": commission.id,
        "company_id": commission.company_id,
        "sales_rep_user_id": commission.sales_rep_user_id,
        "lead_id": commission.lead_id,
        "sale_amount": float(commission.sale_amount or 0),
        "commission_percentage": float(
            commission.commission_percentage or 0
        ),
        "commission_amount": round(commission_amount, 2),
        "paid_amount": round(paid_amount, 2),
        "due_amount": round(due_amount, 2),
        "status": commission.status,
        "payment_date": commission.payment_date,
        "payment_method": commission.payment_method,
        "remarks": commission.remarks,
        "created_at": commission.created_at,
        "updated_at": commission.updated_at,
        "payments": payments,
    }


# =========================================================
# COMMISSION LIST
# =========================================================

@router.get(
    "",
    response_model=list[CommissionResponse],
)
def get_commissions(
    company_id: Optional[int] = None,
    sales_rep_user_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    lead_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_commission_access(current_user)
    ensure_company_user(current_user)

    query = db.query(models.SalesCommission)

    if is_admin_user(current_user):
        if normalize_role(current_user.role) == "super-admin":
            if company_id:
                query = query.filter(
                    models.SalesCommission.company_id == company_id
                )
        else:
            query = query.filter(
                models.SalesCommission.company_id
                == current_user.company_id
            )
    else:
        query = query.outerjoin(models.SalesLead).filter(
            or_(
                models.SalesCommission.sales_rep_user_id
                == current_user.id,
                models.SalesLead.sales_rep_user_id
                == current_user.id,
                models.SalesLead.created_by_user_id
                == current_user.id,
            )
        )

    if sales_rep_user_id:
        if (
            not is_admin_user(current_user)
            and sales_rep_user_id != current_user.id
        ):
            raise HTTPException(
                status_code=403,
                detail="You cannot filter another user's commission",
            )

        query = query.filter(
            models.SalesCommission.sales_rep_user_id
            == sales_rep_user_id
        )

    if lead_id:
        query = query.filter(
            models.SalesCommission.lead_id == lead_id
        )

    if status_filter:
        normalized_status = (
            status_filter.strip()
            .lower()
            .replace("-", "_")
            .replace(" ", "_")
        )

        if normalized_status == "partial_paid":
            normalized_status = "partial"

        query = query.filter(
            models.SalesCommission.status == normalized_status
        )

    commissions = (
        query.order_by(models.SalesCommission.id.desc())
        .all()
    )

    response = []

    for commission in commissions:
        sync_commission_payment_status(
            db,
            commission,
        )

        response.append(
            serialize_commission(
                db,
                commission,
            )
        )

    db.commit()

    return response


# =========================================================
# COMMISSION SUMMARY
# =========================================================

@router.get(
    "/summary",
    response_model=CommissionSummaryResponse,
)
def get_commission_summary(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    ensure_commission_access(current_user)
    ensure_company_user(current_user)

    query = db.query(models.SalesCommission)

    if is_admin_user(current_user):
        if normalize_role(current_user.role) == "super-admin":
            if company_id:
                query = query.filter(
                    models.SalesCommission.company_id == company_id
                )
        else:
            query = query.filter(
                models.SalesCommission.company_id
                == current_user.company_id
            )
    else:
        query = query.outerjoin(models.SalesLead).filter(
            or_(
                models.SalesCommission.sales_rep_user_id
                == current_user.id,
                models.SalesLead.sales_rep_user_id
                == current_user.id,
                models.SalesLead.created_by_user_id
                == current_user.id,
            )
        )

    commissions = query.all()

    total_sale_amount = 0.0
    total_commission_amount = 0.0
    total_paid_amount = 0.0
    total_due_amount = 0.0

    pending_count = 0
    partial_count = 0
    paid_count = 0

    for commission in commissions:
        sync_commission_payment_status(
            db,
            commission,
        )

        sale_amount = float(
            commission.sale_amount or 0
        )

        commission_amount = float(
            commission.commission_amount or 0
        )

        paid_amount = float(
            commission.paid_amount or 0
        )

        due_amount = max(
            commission_amount - paid_amount,
            0,
        )

        total_sale_amount += sale_amount
        total_commission_amount += commission_amount
        total_paid_amount += paid_amount
        total_due_amount += due_amount

        if commission.status == "paid":
            paid_count += 1
        elif commission.status == "partial":
            partial_count += 1
        else:
            pending_count += 1

    db.commit()

    return {
        "total_commissions": len(commissions),
        "pending_count": pending_count,
        "partial_count": partial_count,
        "paid_count": paid_count,
        "total_sale_amount": round(total_sale_amount, 2),
        "total_commission_amount": round(
            total_commission_amount,
            2,
        ),
        "total_paid_amount": round(
            total_paid_amount,
            2,
        ),
        "total_due_amount": round(
            total_due_amount,
            2,
        ),
    }


# =========================================================
# SINGLE COMMISSION
# =========================================================

@router.get(
    "/{commission_id}",
    response_model=CommissionResponse,
)
def get_commission(
    commission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    commission = get_commission_or_404(
        db,
        commission_id,
    )

    ensure_commission_view_access(
        commission,
        current_user,
    )

    sync_commission_payment_status(
        db,
        commission,
    )

    db.commit()
    db.refresh(commission)

    return serialize_commission(
        db,
        commission,
    )


# =========================================================
# UPDATE COMMISSION PERCENTAGE
# =========================================================

@router.put(
    "/{commission_id}/percentage",
    response_model=CommissionResponse,
)
def update_commission_percentage(
    commission_id: int,
    percentage_data: CommissionPercentageUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    commission = get_commission_or_404(
        db,
        commission_id,
    )

    ensure_commission_manage_access(
        commission,
        current_user,
    )

    commission_percentage = float(
        percentage_data.commission_percentage or 0
    )

    if commission_percentage < 0:
        raise HTTPException(
            status_code=400,
            detail="Commission percentage cannot be negative",
        )

    if commission_percentage > 100:
        raise HTTPException(
            status_code=400,
            detail="Commission percentage cannot be greater than 100",
        )

    sale_amount = float(
        commission.sale_amount or 0
    )

    new_commission_amount = round(
        sale_amount * commission_percentage / 100,
        2,
    )

    current_paid_amount = calculate_paid_amount(
        db,
        commission.id,
    )

    if new_commission_amount < current_paid_amount:
        raise HTTPException(
            status_code=400,
            detail=(
                "New commission amount cannot be less than "
                "already paid amount"
            ),
        )

    commission.commission_percentage = commission_percentage
    commission.commission_amount = new_commission_amount

    if percentage_data.remarks is not None:
        commission.remarks = percentage_data.remarks

    sync_commission_payment_status(
        db,
        commission,
    )

    db.commit()
    db.refresh(commission)

    return serialize_commission(
        db,
        commission,
    )


# =========================================================
# COMMISSION PAYMENTS
# =========================================================

@router.get(
    "/{commission_id}/payments",
    response_model=list[CommissionPaymentResponse],
)
def get_commission_payments(
    commission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    commission = get_commission_or_404(
        db,
        commission_id,
    )

    ensure_commission_view_access(
        commission,
        current_user,
    )

    return get_active_commission_payments(
        db,
        commission.id,
    )


@router.post(
    "/{commission_id}/payments",
    response_model=CommissionResponse,
)
def add_commission_payment(
    commission_id: int,
    payment_data: CommissionPaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    commission = get_commission_or_404(
        db,
        commission_id,
    )

    ensure_commission_manage_access(
        commission,
        current_user,
    )

    payment_amount = float(
        payment_data.amount or 0
    )

    if payment_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Payment amount must be greater than 0",
        )

    commission_amount = float(
        commission.commission_amount or 0
    )

    if commission_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="First enter commission percentage before payment",
        )

    current_paid_amount = calculate_paid_amount(
        db,
        commission.id,
    )

    due_amount = max(
        commission_amount - current_paid_amount,
        0,
    )

    if due_amount <= 0:
        raise HTTPException(
            status_code=400,
            detail="Commission already fully paid",
        )

    if payment_amount > due_amount:
        raise HTTPException(
            status_code=400,
            detail=(
                "Payment amount cannot be greater than "
                f"due amount: {round(due_amount, 2)}"
            ),
        )

    payment_method = normalize_payment_method(
        payment_data.payment_method
    )

    new_payment = models.CommissionPayment(
        company_id=commission.company_id,
        commission_id=commission.id,
        paid_by_user_id=current_user.id,
        amount=round(payment_amount, 2),
        payment_date=payment_data.payment_date or date.today(),
        payment_method=payment_method,
        remarks=payment_data.remarks,
        is_active=True,
    )

    db.add(new_payment)
    db.flush()

    sync_commission_payment_status(
        db,
        commission,
    )

    db.commit()
    db.refresh(commission)

    return serialize_commission(
        db,
        commission,
    )


# =========================================================
# DELETE COMMISSION PAYMENT
# =========================================================

@router.delete(
    "/payments/{payment_id}",
    response_model=CommissionResponse,
)
def delete_commission_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    payment = get_commission_payment_or_404(
        db,
        payment_id,
    )

    commission = get_commission_or_404(
        db,
        payment.commission_id,
    )

    ensure_commission_manage_access(
        commission,
        current_user,
    )

    if not payment.is_active:
        raise HTTPException(
            status_code=400,
            detail="Commission payment is already deleted",
        )

    payment.is_active = False
    payment.updated_at = datetime.utcnow()

    sync_commission_payment_status(
        db,
        commission,
    )

    db.commit()
    db.refresh(commission)

    return serialize_commission(
        db,
        commission,
    )


# =========================================================
# DELETE COMPLETE COMMISSION
# =========================================================

@router.delete("/{commission_id}")
def delete_commission(
    commission_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    commission = get_commission_or_404(
        db,
        commission_id,
    )

    ensure_commission_manage_access(
        commission,
        current_user,
    )

    deleted_commission_id = commission.id
    deleted_lead_id = commission.lead_id

    try:
        (
            db.query(models.CommissionPayment)
            .filter(
                models.CommissionPayment.commission_id
                == commission.id
            )
            .delete(synchronize_session=False)
        )

        db.delete(commission)
        db.commit()

        return {
            "message": "Sales commission deleted successfully",
            "commission_id": deleted_commission_id,
            "lead_id": deleted_lead_id,
        }

    except Exception as delete_error:
        db.rollback()

        print(
            "Sales commission delete error:",
            delete_error,
        )

        raise HTTPException(
            status_code=500,
            detail="Unable to delete sales commission",
        )