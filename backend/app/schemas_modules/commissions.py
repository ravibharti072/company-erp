from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class CommissionPercentageUpdate(BaseModel):
    commission_percentage: float
    remarks: Optional[str] = None


class CommissionPaymentCreate(BaseModel):
    amount: float
    payment_date: Optional[date] = None
    payment_method: Optional[str] = "cash"
    remarks: Optional[str] = None


class CommissionPaymentResponse(BaseModel):
    id: int

    company_id: int
    commission_id: int
    paid_by_user_id: int

    amount: float
    payment_date: date
    payment_method: str

    remarks: Optional[str] = None

    is_active: bool

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class CommissionResponse(BaseModel):
    id: int

    company_id: int
    sales_rep_user_id: Optional[int] = None
    lead_id: int

    sale_amount: float
    commission_percentage: float
    commission_amount: float

    paid_amount: float = 0
    due_amount: float = 0

    status: str

    payment_date: Optional[date] = None
    payment_method: Optional[str] = None

    remarks: Optional[str] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    payments: list[CommissionPaymentResponse] = []

    model_config = ConfigDict(from_attributes=True)


class CommissionSummaryResponse(BaseModel):
    total_commissions: int = 0

    pending_count: int = 0
    partial_count: int = 0
    paid_count: int = 0

    total_sale_amount: float = 0
    total_commission_amount: float = 0
    total_paid_amount: float = 0
    total_due_amount: float = 0