from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CompanyBase(BaseModel):
    name: str = Field(
        ...,
        min_length=2,
        max_length=150,
    )

    email: Optional[EmailStr] = None

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    address: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    is_active: bool = True


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    email: Optional[EmailStr] = None

    phone: Optional[str] = Field(
        default=None,
        max_length=30,
    )

    address: Optional[str] = Field(
        default=None,
        max_length=500,
    )

    is_active: Optional[bool] = None


class CompanyResponse(BaseModel):
    id: int

    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None

    is_active: bool = True

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)