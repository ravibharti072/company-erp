from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.core.dependencies import (
    get_current_user,
    is_company_level_report_user,
)


router = APIRouter(
    prefix="/reports",
    tags=["Dashboard / Reports"],
)


@router.get("/dashboard-summary")
def get_dashboard_summary(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
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
            users_query = users_query.filter(
                models.User.company_id == target_company_id
            )
            attendance_query = attendance_query.filter(
                models.Attendance.company_id == target_company_id
            )
            tasks_query = tasks_query.filter(
                models.Task.company_id == target_company_id
            )
            leads_query = leads_query.filter(
                models.SalesLead.company_id == target_company_id
            )
            commissions_query = commissions_query.filter(
                models.SalesCommission.company_id == target_company_id
            )
            freelancer_projects_query = freelancer_projects_query.filter(
                models.FreelancerProject.company_id == target_company_id
            )
            freelancer_payments_query = freelancer_payments_query.filter(
                models.FreelancerPayment.company_id == target_company_id
            )

    elif current_user.role in ["company-admin", "admin", "owner", "hr", "manager", "accountant"]:
        target_company_id = current_user.company_id

        if not target_company_id:
            raise HTTPException(
                status_code=400,
                detail="Company ID not found",
            )

        users_query = users_query.filter(
            models.User.company_id == target_company_id
        )
        attendance_query = attendance_query.filter(
            models.Attendance.company_id == target_company_id
        )
        tasks_query = tasks_query.filter(
            models.Task.company_id == target_company_id
        )
        leads_query = leads_query.filter(
            models.SalesLead.company_id == target_company_id
        )
        commissions_query = commissions_query.filter(
            models.SalesCommission.company_id == target_company_id
        )
        freelancer_projects_query = freelancer_projects_query.filter(
            models.FreelancerProject.company_id == target_company_id
        )
        freelancer_payments_query = freelancer_payments_query.filter(
            models.FreelancerPayment.company_id == target_company_id
        )

    else:
        target_company_id = current_user.company_id

        if not target_company_id:
            raise HTTPException(
                status_code=400,
                detail="Company ID not found",
            )

        users_query = users_query.filter(
            models.User.id == current_user.id
        )
        attendance_query = attendance_query.filter(
            models.Attendance.user_id == current_user.id
        )
        tasks_query = tasks_query.filter(
            models.Task.assigned_to_user_id == current_user.id
        )

        if current_user.role == "sales-representative":
            leads_query = leads_query.filter(
                models.SalesLead.sales_rep_user_id == current_user.id
            )
            commissions_query = commissions_query.filter(
                models.SalesCommission.sales_rep_user_id == current_user.id
            )
        else:
            leads_query = leads_query.filter(
                models.SalesLead.id == -1
            )
            commissions_query = commissions_query.filter(
                models.SalesCommission.id == -1
            )

        if current_user.role == "freelancer":
            freelancer_projects_query = freelancer_projects_query.filter(
                models.FreelancerProject.freelancer_user_id == current_user.id
            )
            freelancer_payments_query = freelancer_payments_query.filter(
                models.FreelancerPayment.freelancer_user_id == current_user.id
            )
        else:
            freelancer_projects_query = freelancer_projects_query.filter(
                models.FreelancerProject.id == -1
            )
            freelancer_payments_query = freelancer_payments_query.filter(
                models.FreelancerPayment.id == -1
            )

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
        sum(item.commission_amount or 0 for item in pending_commissions),
        2,
    )

    paid_commission_amount = round(
        sum(item.commission_amount or 0 for item in paid_commissions),
        2,
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
        sum(item.amount or 0 for item in pending_freelancer_payments),
        2,
    )

    paid_freelancer_payment_amount = round(
        sum(item.amount or 0 for item in paid_freelancer_payments),
        2,
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
        },
    }