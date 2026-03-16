from pydantic import BaseModel, field_validator
from datetime import date, datetime
from typing import Optional
from app.models import ProjectStatus


class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: int

    model_config = {"from_attributes": True}


class ExpenseBase(BaseModel):
    description: str
    amount: float
    date: date
    notes: Optional[str] = None
    project_id: int
    category_id: int

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Amount must be greater than 0")
        return v


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseResponse(ExpenseBase):
    id: int
    created_at: datetime
    category: CategoryResponse

    model_config = {"from_attributes": True}


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    location: Optional[str] = None
    budget: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    status: Optional[ProjectStatus] = ProjectStatus.active

    @field_validator("budget")
    @classmethod
    def budget_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Budget must be greater than 0")
        return v


class ProjectCreate(ProjectBase):
    pass


class ProjectResponse(ProjectBase):
    id: int
    created_at: datetime
    expenses: list[ExpenseResponse] = []

    model_config = {"from_attributes": True}


class ProjectSummary(BaseModel):
    id: int
    name: str
    budget: float
    total_spent: float
    remaining: float
    overrun: bool
    status: ProjectStatus

    model_config = {"from_attributes": True}