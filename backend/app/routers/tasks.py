from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.core.constants import (
    ADMIN_ROLES,
    TASK_ALLOWED_PRIORITIES,
    TASK_STATUS_ORDER,
)
from app.core.dependencies import (
    get_current_user,
    normalize_task_status,
)
from app.database import get_db
from app.schemas_modules.tasks import (
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)


router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"],
)


# Higher number means higher authority.
ROLE_LEVELS = {
    "super-admin": 100,
    "company-admin": 90,
    "admin": 90,
    "owner": 90,
    "hr": 80,
    "manager": 70,
    "team-lead": 65,
    "project-manager": 65,
    "employee": 50,
    "sales-representative": 50,
    "accountant": 50,
    "developer": 50,
    "designer": 50,
    "freelancer": 40,
    "intern": 10,
}


TASK_CREATOR_ROLES = {
    "super-admin",
    "company-admin",
    "admin",
    "owner",
    "hr",
    "manager",
    "team-lead",
    "project-manager",
    "intern",
}


MANAGEMENT_ROLES = {
    "super-admin",
    "company-admin",
    "admin",
    "owner",
    "hr",
    "manager",
    "team-lead",
    "project-manager",
}


STAFF_UPDATE_FIELDS = {
    "status",
    "submission_note",
}


def normalize_role(value: Optional[str]) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .replace("_", "-")
        .replace(" ", "-")
    )


def get_role_level(role: Optional[str]) -> int:
    return ROLE_LEVELS.get(normalize_role(role), 20)


def is_super_admin(user: models.User) -> bool:
    return normalize_role(user.role) == "super-admin"


def is_management_user(user: models.User) -> bool:
    return normalize_role(user.role) in MANAGEMENT_ROLES


def is_intern(user: models.User) -> bool:
    return normalize_role(user.role) == "intern"


def validate_task_status_change(
    old_status: str,
    new_status: str,
) -> str:
    old_status = normalize_task_status(old_status)
    new_status = normalize_task_status(new_status)

    if old_status not in TASK_STATUS_ORDER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid current task status",
        )

    if new_status not in TASK_STATUS_ORDER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid new task status",
        )

    if TASK_STATUS_ORDER[new_status] < TASK_STATUS_ORDER[old_status]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Task status cannot be reverted from "
                f"{old_status} to {new_status}"
            ),
        )

    return new_status


def get_task_or_404(
    db: Session,
    task_id: int,
) -> models.Task:
    task = (
        db.query(models.Task)
        .filter(models.Task.id == task_id)
        .first()
    )

    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    return task


def get_user_or_404(
    db: Session,
    user_id: int,
    detail: str = "User not found",
) -> models.User:
    user = (
        db.query(models.User)
        .filter(models.User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )

    return user


def get_task_creator(
    db: Session,
    task: models.Task,
) -> Optional[models.User]:
    assigned_by_user_id = getattr(
        task,
        "assigned_by_user_id",
        None,
    )

    if not assigned_by_user_id:
        return None

    return (
        db.query(models.User)
        .filter(models.User.id == assigned_by_user_id)
        .first()
    )


def validate_same_company_access(
    current_user: models.User,
    task: models.Task,
    action: str,
) -> None:
    if is_super_admin(current_user):
        return

    if task.company_id != current_user.company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You cannot {action} another company task",
        )


def validate_creator_hierarchy(
    db: Session,
    current_user: models.User,
    task: models.Task,
    action: str,
) -> None:
    """
    A lower role cannot edit/delete a task created by a higher role.

    The task creator is stored in assigned_by_user_id in the current
    database structure.
    """
    if is_super_admin(current_user):
        return

    creator = get_task_creator(db, task)

    if not creator:
        return

    if creator.id == current_user.id:
        return

    current_level = get_role_level(current_user.role)
    creator_level = get_role_level(creator.role)

    if creator_level > current_level:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"You cannot {action} this task because it was "
                f"created by a higher-role user"
            ),
        )


def validate_assignment_user(
    db: Session,
    assigned_user_id: int,
    current_user: models.User,
) -> models.User:
    assigned_user = get_user_or_404(
        db,
        assigned_user_id,
        "Assigned user not found",
    )

    if not assigned_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign task to inactive user",
        )

    if normalize_role(assigned_user.role) == "super-admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot assign task to super admin",
        )

    if (
        not is_super_admin(current_user)
        and assigned_user.company_id != current_user.company_id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot assign task to another company user",
        )

    return assigned_user


def validate_task_priority(priority: str) -> str:
    priority_value = str(priority or "").strip().lower()

    if priority_value not in TASK_ALLOWED_PRIORITIES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid task priority",
        )

    return priority_value


def can_view_task(
    current_user: models.User,
    task: models.Task,
) -> bool:
    if is_super_admin(current_user):
        return True

    if is_management_user(current_user):
        return task.company_id == current_user.company_id

    return task.assigned_to_user_id == current_user.id


@router.post(
    "",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    current_role = normalize_role(current_user.role)

    if current_role not in TASK_CREATOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to create tasks",
        )

    assigned_user = validate_assignment_user(
        db=db,
        assigned_user_id=task.assigned_to_user_id,
        current_user=current_user,
    )

    # Interns can create tasks only for themselves.
    if is_intern(current_user):
        if task.assigned_to_user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Interns can only create tasks for themselves",
            )

    if is_super_admin(current_user):
        company_id = assigned_user.company_id
    else:
        company_id = current_user.company_id

    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company ID not found for task",
        )

    priority = validate_task_priority(task.priority)

    new_task = models.Task(
        company_id=company_id,
        assigned_to_user_id=task.assigned_to_user_id,
        assigned_by_user_id=current_user.id,
        title=task.title.strip(),
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


@router.get(
    "",
    response_model=list[TaskResponse],
)
def get_tasks(
    company_id: Optional[int] = None,
    assigned_to_user_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.Task)

    if is_super_admin(current_user):
        if company_id:
            query = query.filter(
                models.Task.company_id == company_id
            )

    elif is_management_user(current_user):
        query = query.filter(
            models.Task.company_id == current_user.company_id
        )

    else:
        query = query.filter(
            models.Task.assigned_to_user_id == current_user.id
        )

    if assigned_to_user_id:
        # Lower-role users cannot use this parameter to see other tasks.
        if (
            not is_super_admin(current_user)
            and not is_management_user(current_user)
            and assigned_to_user_id != current_user.id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot view another user's tasks",
            )

        query = query.filter(
            models.Task.assigned_to_user_id
            == assigned_to_user_id
        )

    if status_filter:
        status_value = normalize_task_status(status_filter)

        if status_value not in TASK_STATUS_ORDER:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid task status",
            )

        query = query.filter(
            models.Task.status == status_value
        )

    return (
        query.order_by(models.Task.id.desc())
        .all()
    )


@router.get(
    "/{task_id}",
    response_model=TaskResponse,
)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = get_task_or_404(db, task_id)

    if not can_view_task(current_user, task):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot access this task",
        )

    return task


@router.put(
    "/{task_id}",
    response_model=TaskResponse,
)
def update_task(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = get_task_or_404(db, task_id)

    validate_same_company_access(
        current_user=current_user,
        task=task,
        action="update",
    )

    update_data = task_update.model_dump(
        exclude_unset=True
    )

    if not update_data:
        return task

    current_role = normalize_role(current_user.role)
    management_user = is_management_user(current_user)
    assigned_user = (
        task.assigned_to_user_id == current_user.id
    )
    creator_user = (
        task.assigned_by_user_id == current_user.id
    )

    if not management_user:
        if not assigned_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot update this task",
            )

        invalid_fields = [
            field
            for field in update_data
            if field not in STAFF_UPDATE_FIELDS
        ]

        if invalid_fields:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "You can only update task status "
                    "and submission note"
                ),
            )

    else:
        validate_creator_hierarchy(
            db=db,
            current_user=current_user,
            task=task,
            action="edit",
        )

        # Managers/team leads may edit their own tasks or tasks created
        # by users at the same/lower level, but never higher-role tasks.
        if (
            current_role
            in {"manager", "team-lead", "project-manager"}
            and not creator_user
        ):
            creator = get_task_creator(db, task)

            if creator:
                creator_level = get_role_level(creator.role)
                current_level = get_role_level(current_user.role)

                if creator_level > current_level:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=(
                            "You cannot edit a task created by "
                            "a higher-role user"
                        ),
                    )

    if "status" in update_data:
        status_value = update_data.get("status")

        if status_value:
            update_data["status"] = (
                validate_task_status_change(
                    task.status,
                    status_value,
                )
            )
        else:
            update_data.pop("status")

    if "priority" in update_data:
        priority_value = update_data.get("priority")

        if priority_value:
            update_data["priority"] = (
                validate_task_priority(priority_value)
            )
        else:
            update_data.pop("priority")

    if "title" in update_data:
        title_value = str(
            update_data.get("title") or ""
        ).strip()

        if not title_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task title cannot be empty",
            )

        update_data["title"] = title_value

    if "assigned_to_user_id" in update_data:
        new_assigned_user_id = update_data.get(
            "assigned_to_user_id"
        )

        if not management_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Only admin or manager can reassign task"
                ),
            )

        if not new_assigned_user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Assigned user is required",
            )

        new_assigned_user = validate_assignment_user(
            db=db,
            assigned_user_id=new_assigned_user_id,
            current_user=current_user,
        )

        task.company_id = new_assigned_user.company_id

    # submission_note is the assigned user's progress note.
    # Management can also update it, but lower-role users cannot modify
    # remarks, description, priority, assignee, title, or due date.
    for key, value in update_data.items():
        setattr(task, key, value)

    task.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(task)

    return task


@router.delete(
    "/{task_id}",
)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    task = get_task_or_404(db, task_id)

    if not is_management_user(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only admin, HR, manager, or team lead "
                "can delete tasks"
            ),
        )

    validate_same_company_access(
        current_user=current_user,
        task=task,
        action="delete",
    )

    validate_creator_hierarchy(
        db=db,
        current_user=current_user,
        task=task,
        action="delete",
    )

    # Managers and team leads can delete only tasks they created,
    # or tasks created by users at the same/lower role level.
    current_role = normalize_role(current_user.role)

    if current_role in {
        "manager",
        "team-lead",
        "project-manager",
    }:
        creator = get_task_creator(db, task)

        if creator:
            creator_level = get_role_level(creator.role)
            current_level = get_role_level(current_user.role)

            if creator_level > current_level:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=(
                        "You cannot delete a task created by "
                        "a higher-role user"
                    ),
                )

    db.delete(task)
    db.commit()

    return {
        "message": "Task deleted successfully",
        "task_id": task_id,
    }