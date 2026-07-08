from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class AttendanceCheckIn(BaseModel):
    remarks: Optional[str] = None


class AttendanceResponse(BaseModel):
    id: int
    company_id: int
    user_id: int

    attendance_date: date

    check_in_time: datetime
    check_out_time: Optional[datetime] = None

    total_hours: Optional[float] = None

    status: str
    remarks: Optional[str] = None

    created_at: datetime

    model_config = {
        "from_attributes": True
    }