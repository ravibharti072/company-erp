from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.core.constants import (
    ADMIN_ROLES,
    TASK_ALLOWED_PRIORITIES,
    TASK_STATUS_ORDER,
)
from app.core.dependencies import (
    get_current_user,
    normalize_task_status,
    require_roles,
)
from app.schemas_modules.tasks import (
    TaskCreate,
    TaskUpdate,
    TaskResponse,
)


router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
)


def validate_task_status_change(old_status: str, new_status: str):
    old_status = normalize_task_status(old_status)
    new_status = normalize_task_status(new_status)

    if old_status not in TASK_STATUS_ORDER:
        raise HTTPException(
            status_code=400,
            detail="Invalid current task status",
        )

    if new_status not in TASK_STATUS_ORDER:
        raise HTTPException(
            status_code=400,
            detail="Invalid new task status",
        )

    if TASK_STATUS_ORDER[new_status] < TASK_STATUS_ORDER[old_status]:
        raise HTTPException(
            status_code=400,
            detail=f"Task status cannot be reverted from {old_status} to {new_status}",
        )

    return new_status


@router.post("", response_model=TaskResponse)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager"])
    ),
):
    assigned_user = db.query(models.User).filter(
        models.User.id == task.assigned_to_user_id
    ).first()

    if not assigned_user:
        raise HTTPException(
            status_code=404,
            detail="Assigned user not found",
        )

    if not assigned_user.is_active:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign task to inactive user",
        )

    if assigned_user.role == "super-admin":
        raise HTTPException(
            status_code=400,
            detail="Cannot assign task to super admin",
        )

    if current_user.role == "super-admin":
        company_id = assigned_user.company_id
    else:
        company_id = current_user.company_id

        if assigned_user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot assign task to another company user",
            )

    if not company_id:
        raise HTTPException(
            status_code=400,
            detail="Company ID not found for task",
        )

    priority = task.priority.strip().lower()

    if priority not in TASK_ALLOWED_PRIORITIES:
        raise HTTPException(
            status_code=400,
            detail="Invalid task priority",
        )

    new_task = models.Task(
        company_id=company_id,
        assigned_to_user_id=task.assigned_to_user_id,
        assigned_by_user_id=current_user.id,
        title=task.title,
        description=task.description,
        priority=priority,
        status="pending",
        due_date=task.due_date,
        remarks=task.remarks,
        submission_note=None,
    )

    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return new_task


@router.get("", response_model=list[TaskResponse])
def get_tasks(
    company_id: Optional[int] = None,
    assigned_to_user_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Task)

    if current_user.role == "super-admin":
        if company_id:
            query = query.filter(models.Task.company_id == company_id)

    elif current_user.role in ADMIN_ROLES:
        query = query.filter(
            models.Task.company_id == current_user.company_id
        )

    else:
        query = query.filter(
            models.Task.assigned_to_user_id == current_user.id
        )

    if assigned_to_user_id:
        query = query.filter(
            models.Task.assigned_to_user_id == assigned_to_user_id
        )

    if status_filter:
        status_value = normalize_task_status(status_filter)

        if status_value not in TASK_STATUS_ORDER:
            raise HTTPException(
                status_code=400,
                detail="Invalid task status",
            )

        query = query.filter(models.Task.status == status_value)

    tasks = query.order_by(
        models.Task.id.desc()
    ).all()

    return tasks


@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(
        models.Task.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    if current_user.role == "super-admin":
        return task

    if current_user.role in ADMIN_ROLES:
        if task.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot access another company task",
            )

        return task

    if task.assigned_to_user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot access this task",
        )

    return task


@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = db.query(models.Task).filter(
        models.Task.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    is_admin_user = current_user.role in ADMIN_ROLES

    if current_user.role == "super-admin":
        is_admin_user = True

    elif is_admin_user:
        if task.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update another company task",
            )

    else:
        if task.assigned_to_user_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You cannot update this task",
            )

    update_data = task_update.model_dump(exclude_unset=True)

    if not is_admin_user:
        allowed_staff_fields = {
            "status",
            "submission_note",
        }

        for field in update_data.keys():
            if field not in allowed_staff_fields:
                raise HTTPException(
                    status_code=403,
                    detail="You can only update task status and submission note",
                )

    if "status" in update_data and update_data["status"]:
        update_data["status"] = validate_task_status_change(
            task.status,
            update_data["status"],
        )

    if "priority" in update_data and update_data["priority"]:
        priority_value = update_data["priority"].strip().lower()

        if priority_value not in TASK_ALLOWED_PRIORITIES:
            raise HTTPException(
                status_code=400,
                detail="Invalid task priority",
            )

        update_data["priority"] = priority_value

    if "assigned_to_user_id" in update_data and update_data["assigned_to_user_id"]:
        if not is_admin_user:
            raise HTTPException(
                status_code=403,
                detail="Only admin/manager can reassign task",
            )

        new_assigned_user = db.query(models.User).filter(
            models.User.id == update_data["assigned_to_user_id"]
        ).first()

        if not new_assigned_user:
            raise HTTPException(
                status_code=404,
                detail="New assigned user not found",
            )

        if not new_assigned_user.is_active:
            raise HTTPException(
                status_code=400,
                detail="Cannot assign task to inactive user",
            )

        if new_assigned_user.role == "super-admin":
            raise HTTPException(
                status_code=400,
                detail="Cannot assign task to super admin",
            )

        if current_user.role != "super-admin":
            if new_assigned_user.company_id != current_user.company_id:
                raise HTTPException(
                    status_code=403,
                    detail="You cannot assign task to another company user",
                )

        task.company_id = new_assigned_user.company_id

    for key, value in update_data.items():
        setattr(task, key, value)

    task.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    return task


@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin", "hr", "manager"])
    ),
):
    task = db.query(models.Task).filter(
        models.Task.id == task_id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    if current_user.role != "super-admin":
        if task.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="You cannot delete another company task",
            )

    db.delete(task)
    db.commit()

    return {
        "message": "Task deleted successfully",
    }