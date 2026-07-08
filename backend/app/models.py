from datetime import datetime, date

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)
    address = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    people = relationship("Person", back_populates="company")
    users = relationship("User", back_populates="company")
    attendance_records = relationship("Attendance", back_populates="company")
    tasks = relationship("Task", back_populates="company")

    sales_leads = relationship("SalesLead", back_populates="company")
    sales_commissions = relationship("SalesCommission", back_populates="company")
    received_payments = relationship("ReceivedPayment", back_populates="company")
    crm_projects = relationship("CRMProject", back_populates="company")

    freelancer_projects = relationship("FreelancerProject", back_populates="company")
    freelancer_payments = relationship("FreelancerPayment", back_populates="company")


class Person(Base):
    __tablename__ = "people"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    full_name = Column(String, nullable=False)
    email = Column(String, index=True, nullable=True)
    phone = Column(String, nullable=True)

    person_type = Column(String, nullable=False, default="employee")
    department = Column(String, nullable=True)
    designation = Column(String, nullable=True)

    salary_type = Column(String, nullable=True, default="unpaid")
    salary_amount = Column(Float, nullable=True, default=0)

    joining_date = Column(Date, nullable=True)

    status = Column(String, default="active")
    notes = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    company = relationship("Company", back_populates="people")

    login_user = relationship(
        "User",
        back_populates="person",
        uselist=False,
    )


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True)
    person_id = Column(Integer, ForeignKey("people.id"), nullable=True, unique=True)

    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String, nullable=True)

    hashed_password = Column(String, nullable=False)

    role = Column(String, nullable=False, default="employee")
    department = Column(String, nullable=True)

    portal_access = Column(Text, nullable=True, default="[]")

    salary_type = Column(String, nullable=True)
    salary_amount = Column(Float, nullable=True)

    joining_date = Column(Date, nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="users")
    person = relationship("Person", back_populates="login_user")

    attendance_records = relationship("Attendance", back_populates="user")

    assigned_tasks = relationship(
        "Task",
        back_populates="assigned_to_user",
        foreign_keys="Task.assigned_to_user_id",
    )

    created_tasks = relationship(
        "Task",
        back_populates="assigned_by_user",
        foreign_keys="Task.assigned_by_user_id",
    )

    sales_leads = relationship(
        "SalesLead",
        back_populates="sales_rep_user",
        foreign_keys="SalesLead.sales_rep_user_id",
    )

    created_sales_leads = relationship(
        "SalesLead",
        back_populates="created_by_user",
        foreign_keys="SalesLead.created_by_user_id",
    )

    sales_commissions = relationship(
        "SalesCommission",
        back_populates="sales_rep_user",
    )

    created_received_payments = relationship(
        "ReceivedPayment",
        back_populates="created_by_user",
        foreign_keys="ReceivedPayment.created_by_user_id",
    )

    assigned_crm_projects = relationship(
        "CRMProject",
        back_populates="assigned_to_user",
        foreign_keys="CRMProject.assigned_to_user_id",
    )

    created_crm_projects = relationship(
        "CRMProject",
        back_populates="created_by_user",
        foreign_keys="CRMProject.created_by_user_id",
    )

    freelancer_projects = relationship(
        "FreelancerProject",
        back_populates="freelancer_user",
        foreign_keys="FreelancerProject.freelancer_user_id",
    )

    assigned_freelancer_projects = relationship(
        "FreelancerProject",
        back_populates="assigned_by_user",
        foreign_keys="FreelancerProject.assigned_by_user_id",
    )

    freelancer_payments = relationship(
        "FreelancerPayment",
        back_populates="freelancer_user",
    )


class Attendance(Base):
    __tablename__ = "attendance"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    attendance_date = Column(Date, default=date.today, nullable=False)

    check_in_time = Column(DateTime, nullable=False)
    check_out_time = Column(DateTime, nullable=True)

    total_hours = Column(Float, nullable=True)

    status = Column(String, default="present")
    remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company", back_populates="attendance_records")
    user = relationship("User", back_populates="attendance_records")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    priority = Column(String, default="medium")
    status = Column(String, default="pending")

    due_date = Column(Date, nullable=True)

    remarks = Column(Text, nullable=True)
    submission_note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    company = relationship("Company", back_populates="tasks")

    assigned_to_user = relationship(
        "User",
        back_populates="assigned_tasks",
        foreign_keys=[assigned_to_user_id],
    )

    assigned_by_user = relationship(
        "User",
        back_populates="created_tasks",
        foreign_keys=[assigned_by_user_id],
    )


class SalesLead(Base):
    __tablename__ = "sales_leads"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    sales_rep_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    client_name = Column(String, nullable=False)
    client_phone = Column(String, nullable=True)
    client_email = Column(String, nullable=True)

    client_company_name = Column(String, nullable=True)
    client_address = Column(Text, nullable=True)

    service_interest = Column(String, nullable=False, default="custom_software")
    service_type = Column(String, nullable=False, default="custom_software")

    lead_source = Column(String, nullable=True)
    status = Column(String, default="new")
    priority = Column(String, default="medium")

    expected_value = Column(Float, nullable=True)
    proposal_amount = Column(Float, nullable=True)
    final_sale_amount = Column(Float, nullable=True)

    recurring_amount = Column(Float, nullable=True)
    recurring_cycle = Column(String, nullable=True)

    follow_up_date = Column(Date, nullable=True)

    proposal_sent_date = Column(Date, nullable=True)
    converted_date = Column(Date, nullable=True)
    delivered_date = Column(Date, nullable=True)
    completed_date = Column(Date, nullable=True)
    lost_date = Column(Date, nullable=True)

    project_required = Column(Boolean, default=False)
    project_created = Column(Boolean, default=False)

    delivery_notes = Column(Text, nullable=True)
    completion_notes = Column(Text, nullable=True)
    lost_reason = Column(Text, nullable=True)

    notes = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    company = relationship("Company", back_populates="sales_leads")

    sales_rep_user = relationship(
        "User",
        back_populates="sales_leads",
        foreign_keys=[sales_rep_user_id],
    )

    created_by_user = relationship(
        "User",
        back_populates="created_sales_leads",
        foreign_keys=[created_by_user_id],
    )

    commission = relationship(
        "SalesCommission",
        back_populates="lead",
        uselist=False,
    )

    received_payments = relationship(
        "ReceivedPayment",
        back_populates="lead",
    )

    crm_projects = relationship(
        "CRMProject",
        back_populates="lead",
    )


class SalesCommission(Base):
    __tablename__ = "sales_commissions"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    sales_rep_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    lead_id = Column(Integer, ForeignKey("sales_leads.id"), nullable=False)

    sale_amount = Column(Float, nullable=False)
    commission_percentage = Column(Float, nullable=False)
    commission_amount = Column(Float, nullable=False)

    status = Column(String, default="pending")

    payment_date = Column(Date, nullable=True)
    payment_method = Column(String, nullable=True)

    remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    company = relationship("Company", back_populates="sales_commissions")

    sales_rep_user = relationship(
        "User",
        back_populates="sales_commissions",
    )

    lead = relationship(
        "SalesLead",
        back_populates="commission",
    )


class ReceivedPayment(Base):
    __tablename__ = "received_payments"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    lead_id = Column(Integer, ForeignKey("sales_leads.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    payment_type = Column(String, nullable=False, default="lead_payment")
    payment_title = Column(String, nullable=True)

    payer_name = Column(String, nullable=True)
    payer_phone = Column(String, nullable=True)
    payer_email = Column(String, nullable=True)

    amount = Column(Float, nullable=False)

    payment_method = Column(String, nullable=False, default="cash")
    payment_date = Column(Date, default=date.today, nullable=False)

    reference_number = Column(String, nullable=True)
    remarks = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    company = relationship("Company", back_populates="received_payments")

    lead = relationship(
        "SalesLead",
        back_populates="received_payments",
    )

    created_by_user = relationship(
        "User",
        back_populates="created_received_payments",
        foreign_keys=[created_by_user_id],
    )


class CRMProject(Base):
    __tablename__ = "crm_projects"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    lead_id = Column(Integer, ForeignKey("sales_leads.id"), nullable=True)

    assigned_to_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    project_type = Column(String, nullable=False, default="internal_project")
    priority = Column(String, default="medium")
    status = Column(String, default="ongoing")

    client_name = Column(String, nullable=True)
    client_company_name = Column(String, nullable=True)

    project_amount = Column(Float, nullable=True, default=0)
    recurring_amount = Column(Float, nullable=True)
    recurring_cycle = Column(String, nullable=True)

    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    delivered_date = Column(Date, nullable=True)
    completed_date = Column(Date, nullable=True)

    submission_note = Column(Text, nullable=True)
    submission_link = Column(Text, nullable=True)

    admin_remarks = Column(Text, nullable=True)

    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    company = relationship("Company", back_populates="crm_projects")

    lead = relationship(
        "SalesLead",
        back_populates="crm_projects",
    )

    assigned_to_user = relationship(
        "User",
        back_populates="assigned_crm_projects",
        foreign_keys=[assigned_to_user_id],
    )

    created_by_user = relationship(
        "User",
        back_populates="created_crm_projects",
        foreign_keys=[created_by_user_id],
    )


class FreelancerProject(Base):
    __tablename__ = "freelancer_projects"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    freelancer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    assigned_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    project_amount = Column(Float, nullable=False, default=0)

    status = Column(String, default="assigned")
    payment_status = Column(String, default="pending")

    start_date = Column(Date, nullable=True)
    due_date = Column(Date, nullable=True)
    completed_date = Column(Date, nullable=True)

    submission_note = Column(Text, nullable=True)
    submission_link = Column(Text, nullable=True)

    admin_remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    company = relationship("Company", back_populates="freelancer_projects")

    freelancer_user = relationship(
        "User",
        back_populates="freelancer_projects",
        foreign_keys=[freelancer_user_id],
    )

    assigned_by_user = relationship(
        "User",
        back_populates="assigned_freelancer_projects",
        foreign_keys=[assigned_by_user_id],
    )

    payment = relationship(
        "FreelancerPayment",
        back_populates="project",
        uselist=False,
    )


class FreelancerPayment(Base):
    __tablename__ = "freelancer_payments"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    freelancer_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("freelancer_projects.id"), nullable=False)

    amount = Column(Float, nullable=False)

    status = Column(String, default="pending")

    payment_date = Column(Date, nullable=True)
    payment_method = Column(String, nullable=True)

    remarks = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    company = relationship("Company", back_populates="freelancer_payments")

    freelancer_user = relationship(
        "User",
        back_populates="freelancer_payments",
    )

    project = relationship(
        "FreelancerProject",
        back_populates="payment",
    )