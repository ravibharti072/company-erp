from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class FreelancerProjectCreate(BaseModel):
    freelancer_user_id: int

    title: str
    description: Optional[str] = None

    project_amount: float

    start_date: Optional[date] = None
    due_date: Optional[date] = None

    admin_remarks: Optional[str] = None


class FreelancerProjectUpdate(BaseModel):
    freelancer_user_id: Optional[int] = None

    title: Optional[str] = None
    description: Optional[str] = None

    project_amount: Optional[float] = None

    status: Optional[str] = None
    payment_status: Optional[str] = None

    start_date: Optional[date] = None
    due_date: Optional[date] = None
    completed_date: Optional[date] = None

    submission_note: Optional[str] = None
    submission_link: Optional[str] = None

    admin_remarks: Optional[str] = None


class FreelancerProjectResponse(BaseModel):
    id: int
    company_id: int

    freelancer_user_id: int
    assigned_by_user_id: int

    title: str
    description: Optional[str] = None

    project_amount: float

    status: str
    payment_status: str

    start_date: Optional[date] = None
    due_date: Optional[date] = None
    completed_date: Optional[date] = None

    submission_note: Optional[str] = None
    submission_link: Optional[str] = None

    admin_remarks: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class FreelancerPaymentCreate(BaseModel):
    remarks: Optional[str] = None


class FreelancerPaymentUpdate(BaseModel):
    status: Optional[str] = None
    payment_date: Optional[date] = None
    payment_method: Optional[str] = None
    remarks: Optional[str] = None


class FreelancerPaymentResponse(BaseModel):
    id: int
    company_id: int

    freelancer_user_id: int
    project_id: int

    amount: float

    status: str

    payment_date: Optional[date] = None
    payment_method: Optional[str] = None

    remarks: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }


class FreelancerPaymentGenerateResponse(BaseModel):
    message: str
    project: FreelancerProjectResponse
    payment: FreelancerPaymentResponse