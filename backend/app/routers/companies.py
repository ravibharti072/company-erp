from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.core.dependencies import require_roles
from app.schemas_modules.companies import (
    CompanyCreate,
    CompanyResponse,
)


router = APIRouter(
    prefix="/companies",
    tags=["Companies"],
)


@router.post("", response_model=CompanyResponse)
def create_company(
    company: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["super-admin"])),
):
    existing_company = db.query(models.Company).filter(
        models.Company.email == company.email
    ).first()

    if existing_company:
        raise HTTPException(
            status_code=400,
            detail="Company with this email already exists",
        )

    new_company = models.Company(
        name=company.name,
        email=company.email,
        phone=company.phone,
        address=company.address,
    )

    db.add(new_company)
    db.commit()
    db.refresh(new_company)

    return new_company


@router.get("", response_model=list[CompanyResponse])
def get_companies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_roles(["super-admin"])),
):
    companies = db.query(models.Company).order_by(
        models.Company.id.desc()
    ).all()

    return companies


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(
        require_roles(["super-admin", "company-admin"])
    ),
):
    company = db.query(models.Company).filter(
        models.Company.id == company_id
    ).first()

    if not company:
        raise HTTPException(
            status_code=404,
            detail="Company not found",
        )

    if current_user.role != "super-admin" and current_user.company_id != company.id:
        raise HTTPException(
            status_code=403,
            detail="You cannot access another company",
        )

    return company