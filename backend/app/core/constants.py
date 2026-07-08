ALLOWED_ROLES = {
    "super-admin",
    "company-admin",
    "hr",
    "manager",
    "employee",
    "intern",
    "sales-representative",
    "freelancer",
    "accountant",
}


ADMIN_ROLES = {
    "super-admin",
    "company-admin",
    "hr",
    "manager",
    "accountant",
}


COMPANY_ADMIN_ROLES = {
    "super-admin",
    "company-admin",
}


NORMAL_COMPANY_ROLES = {
    "hr",
    "manager",
    "employee",
    "intern",
    "sales-representative",
    "freelancer",
    "accountant",
}


TASK_ALLOWED_STATUSES = {
    "pending",
    "in-progress",
    "submitted",
    "completed",
    "cancelled",
}


TASK_ALLOWED_PRIORITIES = {
    "low",
    "medium",
    "high",
    "urgent",
}


TASK_STATUS_ORDER = {
    "pending": 1,
    "in-progress": 2,
    "in_progress": 2,
    "completed": 3,
}


SALES_ALLOWED_STATUSES = {
    "new",
    "contacted",
    "interested",
    "follow-up",
    "converted",
    "not-interested",
    "lost",
}


COMMISSION_ALLOWED_STATUSES = {
    "pending",
    "approved",
    "paid",
    "cancelled",
}


FREELANCER_PROJECT_ALLOWED_STATUSES = {
    "assigned",
    "in-progress",
    "submitted",
    "approved",
    "completed",
    "cancelled",
}


FREELANCER_PAYMENT_ALLOWED_STATUSES = {
    "pending",
    "approved",
    "paid",
    "cancelled",
}