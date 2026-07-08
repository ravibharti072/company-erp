from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class TaskCreate(BaseModel):
    assigned_to_user_id: int
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    due_date: Optional[date] = None
    remarks: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assigned_to_user_id: Optional[int] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None
    remarks: Optional[str] = None
    submission_note: Optional[str] = None


class TaskResponse(BaseModel):
    id: int
    company_id: int

    assigned_to_user_id: int
    assigned_by_user_id: int

    title: str
    description: Optional[str] = None

    priority: str
    status: str

    due_date: Optional[date] = None

    remarks: Optional[str] = None
    submission_note: Optional[str] = None

    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True
    }