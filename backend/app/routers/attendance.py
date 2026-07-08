from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.core.constants import ADMIN_ROLES
from app.core.dependencies import get_current_user
from app.schemas_modules.attendance import (
    AttendanceCheckIn,
    AttendanceResponse,
)


router = APIRouter(
    prefix="/attendance",
    tags=["Attendance"],
)


@router.post("/check-in", response_model=AttendanceResponse)
def check_in(
    attendance_data: AttendanceCheckIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "super-admin" or not current_user.company_id:
        raise HTTPException(
            status_code=400,
            detail="Super admin cannot mark attendance",
        )

    today = date.today()

    existing_attendance = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.attendance_date == today,
    ).first()

    if existing_attendance:
        raise HTTPException(
            status_code=400,
            detail="Attendance already marked for today",
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


@router.post("/check-out", response_model=AttendanceResponse)
def check_out(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role == "super-admin" or not current_user.company_id:
        raise HTTPException(
            status_code=400,
            detail="Super admin cannot mark attendance",
        )

    today = date.today()

    attendance = db.query(models.Attendance).filter(
        models.Attendance.user_id == current_user.id,
        models.Attendance.attendance_date == today,
    ).first()

    if not attendance:
        raise HTTPException(
            status_code=404,
            detail="Check-in record not found for today",
        )

    if attendance.check_out_time:
        raise HTTPException(
            status_code=400,
            detail="Already checked out today",
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


@router.get("", response_model=list[AttendanceResponse])
def get_attendance_records(
    company_id: int | None = None,
    user_id: int | None = None,
    attendance_date: date | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Attendance)

    if current_user.role == "super-admin":
        if company_id:
            query = query.filter(
                models.Attendance.company_id == company_id
            )

    elif current_user.role in ADMIN_ROLES:
        query = query.filter(
            models.Attendance.company_id == current_user.company_id
        )

    else:
        query = query.filter(
            models.Attendance.user_id == current_user.id
        )

    if user_id:
        query = query.filter(
            models.Attendance.user_id == user_id
        )

    if attendance_date:
        query = query.filter(
            models.Attendance.attendance_date == attendance_date
        )

    records = query.order_by(
        models.Attendance.id.desc()
    ).all()

    return records


@router.get("/today", response_model=list[AttendanceResponse])
def get_today_attendance(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
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