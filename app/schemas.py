from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime
from typing import Optional
from app.models import ProjectStatus


# Max lengths mirror the DB columns; free-text fields get a cap so nobody can
# fill the database with one request.
MAX_TEXT = 2000
MAX_AMOUNT = 1_000_000_000


class CategoryBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT)


class CategoryCreate(CategoryBase):
    pass


class CategoryResponse(CategoryBase):
    id: int

    model_config = {"from_attributes": True}


class ExpenseBase(BaseModel):
    description: str = Field(min_length=1, max_length=300)
    amount: float = Field(le=MAX_AMOUNT)
    date: date
    notes: Optional[str] = Field(default=None, max_length=MAX_TEXT)
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
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=MAX_TEXT)
    location: Optional[str] = Field(default=None, max_length=200)
    budget: float = Field(le=MAX_AMOUNT)
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