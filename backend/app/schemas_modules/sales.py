from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, field_validator



def clean_optional_float(value):
    if value is None:
        return None

    if isinstance(value, str):
        cleaned = (
            value.strip()
            .replace("₹", "")
            .replace(",", "")
        )

        if cleaned == "":
            return None

        return float(cleaned)

    return value


def clean_zero_float(value):
    if value is None:
        return 0

    if isinstance(value, str):
        cleaned = (
            value.strip()
            .replace("₹", "")
            .replace(",", "")
        )

        if cleaned == "":
            return 0

        return float(cleaned)

    return value


def clean_optional_int(value):
    if value is None:
        return None

    if isinstance(value, str):
        cleaned = value.strip()

        if cleaned == "":
            return None

        return int(cleaned)

    return value


# ----------------------------------------
# SALES / LEAD CRM SCHEMAS
# ----------------------------------------

class SalesLeadCreate(BaseModel):
    sales_rep_user_id: Optional[int] = None
    software_product_id: Optional[int] = None

    client_name: str
    client_phone: Optional[str] = None
    client_email: Optional[EmailStr] = None

    client_company_name: Optional[str] = None
    client_address: Optional[str] = None

    # Old field kept for compatibility with current frontend/router.
    service_interest: str = "custom_software"

    # Options:
    # custom_software, existing_software, social_media_management,
    # internal_project, other
    service_type: str = "custom_software"

    lead_source: Optional[str] = None

    # CRM pipeline:
    # new, contacted, interested, proposal-sent, converted,
    # delivered, completed, not-interested, lost
    status: str = "new"

    priority: str = "medium"

    expected_value: Optional[float] = None
    proposal_amount: Optional[float] = None
    final_sale_amount: Optional[float] = None

    recurring_amount: Optional[float] = None
    recurring_cycle: Optional[str] = None

    follow_up_date: Optional[date] = None

    proposal_sent_date: Optional[date] = None
    converted_date: Optional[date] = None
    delivered_date: Optional[date] = None
    completed_date: Optional[date] = None
    lost_date: Optional[date] = None

    project_required: bool = False
    project_created: bool = False

    delivery_notes: Optional[str] = None
    completion_notes: Optional[str] = None
    lost_reason: Optional[str] = None

    notes: Optional[str] = None
    is_active: bool = True

    @field_validator(
        "software_product_id",
        "sales_rep_user_id",
        mode="before",
    )
    @classmethod
    def validate_optional_ids(cls, value):
        return clean_optional_int(value)

    @field_validator(
        "expected_value",
        "proposal_amount",
        "final_sale_amount",
        "recurring_amount",
        mode="before",
    )
    @classmethod
    def validate_optional_amounts(cls, value):
        return clean_optional_float(value)


class SalesLeadUpdate(BaseModel):
    sales_rep_user_id: Optional[int] = None
    software_product_id: Optional[int] = None

    client_name: Optional[str] = None
    client_phone: Optional[str] = None
    client_email: Optional[EmailStr] = None

    client_company_name: Optional[str] = None
    client_address: Optional[str] = None

    service_interest: Optional[str] = None
    service_type: Optional[str] = None

    lead_source: Optional[str] = None

    status: Optional[str] = None
    priority: Optional[str] = None

    expected_value: Optional[float] = None
    proposal_amount: Optional[float] = None
    final_sale_amount: Optional[float] = None

    recurring_amount: Optional[float] = None
    recurring_cycle: Optional[str] = None

    follow_up_date: Optional[date] = None

    proposal_sent_date: Optional[date] = None
    converted_date: Optional[date] = None
    delivered_date: Optional[date] = None
    completed_date: Optional[date] = None
    lost_date: Optional[date] = None

    project_required: Optional[bool] = None
    project_created: Optional[bool] = None

    delivery_notes: Optional[str] = None
    completion_notes: Optional[str] = None
    lost_reason: Optional[str] = None

    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator(
        "software_product_id",
        "sales_rep_user_id",
        mode="before",
    )
    @classmethod
    def validate_optional_ids(cls, value):
        return clean_optional_int(value)

    @field_validator(
        "expected_value",
        "proposal_amount",
        "final_sale_amount",
        "recurring_amount",
        mode="before",
    )
    @classmethod
    def validate_optional_amounts(cls, value):
        return clean_optional_float(value)


class SalesLeadResponse(BaseModel):
    id: int
    company_id: int

    sales_rep_user_id: Optional[int] = None
    created_by_user_id: int
    software_product_id: Optional[int] = None

    client_name: str
    client_phone: Optional[str] = None
    client_email: Optional[EmailStr] = None

    client_company_name: Optional[str] = None
    client_address: Optional[str] = None

    service_interest: str
    service_type: str

    lead_source: Optional[str] = None

    status: str
    priority: str

    expected_value: Optional[float] = None
    proposal_amount: Optional[float] = None
    final_sale_amount: Optional[float] = None

    recurring_amount: Optional[float] = None
    recurring_cycle: Optional[str] = None

    follow_up_date: Optional[date] = None

    proposal_sent_date: Optional[date] = None
    converted_date: Optional[date] = None
    delivered_date: Optional[date] = None
    completed_date: Optional[date] = None
    lost_date: Optional[date] = None

    project_required: bool
    project_created: bool

    delivery_notes: Optional[str] = None
    completion_notes: Optional[str] = None
    lost_reason: Optional[str] = None

    notes: Optional[str] = None
    is_active: bool

    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class SalesLeadStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None
    follow_up_date: Optional[date] = None
    lost_reason: Optional[str] = None
    delivery_notes: Optional[str] = None
    completion_notes: Optional[str] = None


class LeadConvertRequest(BaseModel):
    final_sale_amount: Optional[float] = None
    commission_percentage: float = 0
    software_product_id: Optional[int] = None
    remarks: Optional[str] = None

    @field_validator("final_sale_amount", mode="before")
    @classmethod
    def validate_final_sale_amount(cls, value):
        return clean_optional_float(value)

    @field_validator("commission_percentage", mode="before")
    @classmethod
    def validate_commission_percentage(cls, value):
        return clean_zero_float(value)

    @field_validator("software_product_id", mode="before")
    @classmethod
    def validate_software_product_id(cls, value):
        return clean_optional_int(value)


class LeadDeliverRequest(BaseModel):
    delivery_notes: Optional[str] = None


class LeadCompleteRequest(BaseModel):
    completion_notes: Optional[str] = None


# ----------------------------------------
# SALES COMMISSION SCHEMAS
# ----------------------------------------

class SalesCommissionUpdate(BaseModel):
    status: Optional[str] = None
    payment_date: Optional[date] = None
    payment_method: Optional[str] = None
    remarks: Optional[str] = None


class SalesCommissionResponse(BaseModel):
    id: int
    company_id: int

    sales_rep_user_id: Optional[int] = None
    lead_id: int

    sale_amount: float
    commission_percentage: float
    commission_amount: float
    paid_amount: float = 0

    status: str

    payment_date: Optional[date] = None
    payment_method: Optional[str] = None
    remarks: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class LeadConvertResponse(BaseModel):
    message: str
    lead: SalesLeadResponse
    commission: Optional[SalesCommissionResponse] = None


# ----------------------------------------
# RECEIVED PAYMENT SCHEMAS
# ----------------------------------------
# Used for:
# 1. Lead payment: payment linked with sales_leads.id
# 2. Other payment: payment not linked with any lead

class ReceivedPaymentCreate(BaseModel):
    # For lead payment, pass lead_id.
    # For other payment, keep lead_id empty/null.
    lead_id: Optional[int] = None

    # Options:
    # lead_payment, other_payment
    payment_type: str = "lead_payment"

    payment_title: Optional[str] = None

    payer_name: Optional[str] = None
    payer_phone: Optional[str] = None
    payer_email: Optional[EmailStr] = None

    amount: float

    # cash, upi, bank_transfer, cheque, card, other
    payment_method: str = "cash"

    payment_date: Optional[date] = None

    reference_number: Optional[str] = None
    remarks: Optional[str] = None

    is_active: bool = True

    @field_validator("lead_id", mode="before")
    @classmethod
    def validate_lead_id(cls, value):
        return clean_optional_int(value)

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, value):
        return clean_zero_float(value)


class ReceivedPaymentUpdate(BaseModel):
    lead_id: Optional[int] = None

    payment_type: Optional[str] = None
    payment_title: Optional[str] = None

    payer_name: Optional[str] = None
    payer_phone: Optional[str] = None
    payer_email: Optional[EmailStr] = None

    amount: Optional[float] = None

    payment_method: Optional[str] = None
    payment_date: Optional[date] = None

    reference_number: Optional[str] = None
    remarks: Optional[str] = None

    is_active: Optional[bool] = None

    @field_validator("lead_id", mode="before")
    @classmethod
    def validate_lead_id(cls, value):
        return clean_optional_int(value)

    @field_validator("amount", mode="before")
    @classmethod
    def validate_amount(cls, value):
        return clean_optional_float(value)


class ReceivedPaymentResponse(BaseModel):
    id: int
    company_id: int

    lead_id: Optional[int] = None
    created_by_user_id: int

    payment_type: str
    payment_title: Optional[str] = None

    payer_name: Optional[str] = None
    payer_phone: Optional[str] = None
    payer_email: Optional[EmailStr] = None

    amount: float

    payment_method: str
    payment_date: date

    reference_number: Optional[str] = None
    remarks: Optional[str] = None

    is_active: bool

    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class LeadPaymentSummaryResponse(BaseModel):
    lead_id: int
    client_name: str
    final_sale_amount: float
    total_received: float
    due_amount: float
    payment_status: str
    payments: List[ReceivedPaymentResponse] = []


class ReceivedPaymentSummaryResponse(BaseModel):
    total_received: float
    total_lead_payments: float
    total_other_payments: float
    today_received: float
    this_month_received: float

    total_pending_due_from_leads: float

    lead_payment_count: int
    other_payment_count: int
    total_payment_count: int


# ----------------------------------------
# CRM PROJECT SCHEMAS
# ----------------------------------------

class CRMProjectCreate(BaseModel):
    lead_id: Optional[int] = None
    software_product_id: Optional[int] = None

    assigned_to_user_id: Optional[int] = None

    title: str
    description: Optional[str] = None

    # custom_software, existing_software, social_media_management,
    # internal_project, maintenance, other
    project_type: str = "internal_project"

    priority: str = "medium"

    # ongoing, in-progress, delivered, completed, cancelled
    status: str = "ongoing"

    client_name: Optional[str] = None
    client_company_name: Optional[str] = None

    project_amount: Optional[float] = 0
    recurring_amount: Optional[float] = None
    recurring_cycle: Optional[str] = None

    start_date: Optional[date] = None
    due_date: Optional[date] = None
    delivered_date: Optional[date] = None
    completed_date: Optional[date] = None

    submission_note: Optional[str] = None
    submission_link: Optional[str] = None

    admin_remarks: Optional[str] = None

    is_active: bool = True


class CRMProjectUpdate(BaseModel):
    lead_id: Optional[int] = None
    software_product_id: Optional[int] = None

    assigned_to_user_id: Optional[int] = None

    title: Optional[str] = None
    description: Optional[str] = None

    project_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

    client_name: Optional[str] = None
    client_company_name: Optional[str] = None

    project_amount: Optional[float] = None
    recurring_amount: Optional[float] = None
    recurring_cycle: Optional[str] = None

    start_date: Optional[date] = None
    due_date: Optional[date] = None
    delivered_date: Optional[date] = None
    completed_date: Optional[date] = None

    submission_note: Optional[str] = None
    submission_link: Optional[str] = None

    admin_remarks: Optional[str] = None

    is_active: Optional[bool] = None


class CRMProjectResponse(BaseModel):
    id: int
    company_id: int

    lead_id: Optional[int] = None
    software_product_id: Optional[int] = None

    assigned_to_user_id: Optional[int] = None
    created_by_user_id: int

    title: str
    description: Optional[str] = None

    project_type: str
    priority: str
    status: str

    client_name: Optional[str] = None
    client_company_name: Optional[str] = None

    project_amount: Optional[float] = None
    recurring_amount: Optional[float] = None
    recurring_cycle: Optional[str] = None

    start_date: Optional[date] = None
    due_date: Optional[date] = None
    delivered_date: Optional[date] = None
    completed_date: Optional[date] = None

    submission_note: Optional[str] = None
    submission_link: Optional[str] = None

    admin_remarks: Optional[str] = None

    converted_to_software_product: bool = False
    is_active: bool

    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class CRMProjectStatusUpdate(BaseModel):
    status: str
    submission_note: Optional[str] = None
    submission_link: Optional[str] = None
    admin_remarks: Optional[str] = None


# ----------------------------------------
# SOFTWARE PRODUCT SCHEMAS
# ----------------------------------------

class SoftwareProductCreate(BaseModel):
    source_project_id: Optional[int] = None

    software_name: str
    software_type: str = "existing_software"
    description: Optional[str] = None

    base_price: float = 0
    setup_charge: Optional[float] = 0

    recurring_amount: Optional[float] = None
    recurring_cycle: Optional[str] = None

    version: Optional[str] = None
    demo_url: Optional[str] = None
    documentation_url: Optional[str] = None

    status: str = "active"
    notes: Optional[str] = None

    is_active: bool = True


class SoftwareProductUpdate(BaseModel):
    source_project_id: Optional[int] = None

    software_name: Optional[str] = None
    software_type: Optional[str] = None
    description: Optional[str] = None

    base_price: Optional[float] = None
    setup_charge: Optional[float] = None

    recurring_amount: Optional[float] = None
    recurring_cycle: Optional[str] = None

    version: Optional[str] = None
    demo_url: Optional[str] = None
    documentation_url: Optional[str] = None

    status: Optional[str] = None
    notes: Optional[str] = None

    is_active: Optional[bool] = None


class SoftwareProductResponse(BaseModel):
    id: int
    company_id: int
    source_project_id: Optional[int] = None

    software_name: str
    software_type: str
    description: Optional[str] = None

    base_price: float
    setup_charge: Optional[float] = None

    recurring_amount: Optional[float] = None
    recurring_cycle: Optional[str] = None

    version: Optional[str] = None
    demo_url: Optional[str] = None
    documentation_url: Optional[str] = None

    status: str
    notes: Optional[str] = None

    is_active: bool

    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class ProjectToSoftwareProductRequest(BaseModel):
    software_name: Optional[str] = None
    software_type: str = "existing_software"
    description: Optional[str] = None

    base_price: Optional[float] = None
    setup_charge: Optional[float] = 0

    recurring_amount: Optional[float] = None
    recurring_cycle: Optional[str] = None

    version: Optional[str] = None
    demo_url: Optional[str] = None
    documentation_url: Optional[str] = None

    notes: Optional[str] = None


# ----------------------------------------
# CRM SUMMARY SCHEMA
# ----------------------------------------

class CRMSummaryResponse(BaseModel):
    total_leads: int
    ongoing_leads: int
    converted_leads: int
    delivered_leads: int
    completed_leads: int
    lost_leads: int

    expected_value: float
    proposal_value: float
    final_sales: float

    total_projects: int
    ongoing_projects: int
    completed_projects: int