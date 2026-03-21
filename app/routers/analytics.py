from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.database import get_db
from app.limiter import limiter
from app import models
import pandas as pd
import io
import re
import anthropic
import os

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"]
)

_SAFE_FILENAME_RE = re.compile(r'[^a-zA-Z0-9_\-]')

_anthropic_api_key = os.getenv("ANTHROPIC_API_KEY")
if not _anthropic_api_key:
    raise RuntimeError(
        "ANTHROPIC_API_KEY environment variable is not set. "
        "Required for the /analytics/projects/{id}/insights endpoint. "
        "Add it to your .env file."
    )
client = anthropic.Anthropic(api_key=_anthropic_api_key)


def get_project_or_404(db: Session, project_id: int):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )
    return project


@router.get("/projects/{project_id}/summary")
@limiter.limit("30/minute")
def get_project_summary(request: Request, project_id: int, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)

    total_spent = db.query(func.sum(models.Expense.amount)).filter(
        models.Expense.project_id == project_id
    ).scalar() or 0

    remaining = project.budget - total_spent
    overrun = bool(total_spent > project.budget)
    percent_used = round((total_spent / project.budget) * 100, 2) if project.budget > 0 else 0

    return {
        "project_id": project.id,
        "project_name": project.name,
        "budget": project.budget,
        "total_spent": round(total_spent, 2),
        "remaining": round(remaining, 2),
        "percent_used": percent_used,
        "overrun": overrun,
        "status": project.status
    }


@router.get("/overruns")
@limiter.limit("30/minute")
def get_overruns(request: Request, db: Session = Depends(get_db)):
    total_projects = db.query(models.Project).count()

    rows = (
        db.query(
            models.Project.id,
            models.Project.name,
            models.Project.budget,
            func.coalesce(func.sum(models.Expense.amount), 0).label("total_spent"),
        )
        .outerjoin(models.Expense, models.Expense.project_id == models.Project.id)
        .group_by(models.Project.id, models.Project.name, models.Project.budget)
        .having(func.coalesce(func.sum(models.Expense.amount), 0) > models.Project.budget)
        .all()
    )

    overruns = [
        {
            "project_id": row.id,
            "project_name": row.name,
            "budget": row.budget,
            "total_spent": round(row.total_spent, 2),
            "overrun_amount": round(row.total_spent - row.budget, 2),
            "overrun_percent": round(((row.total_spent - row.budget) / row.budget) * 100, 2),
        }
        for row in rows
    ]

    return {
        "total_projects": total_projects,
        "projects_in_overrun": len(overruns),
        "overruns": overruns,
    }


@router.get("/projects/{project_id}/breakdown")
@limiter.limit("30/minute")
def get_expense_breakdown(request: Request, project_id: int, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)

    expenses = db.query(models.Expense).options(
        joinedload(models.Expense.category)
    ).filter(
        models.Expense.project_id == project_id
    ).all()

    if not expenses:
        return {
            "project_id": project_id,
            "project_name": project.name,
            "breakdown": []
        }

    df = pd.DataFrame([{
        "amount": e.amount,
        "category": e.category.name
    } for e in expenses])

    total = df["amount"].sum()
    breakdown = df.groupby("category")["amount"].sum().reset_index()
    breakdown["percent"] = (breakdown["amount"] / total * 100).round(2)
    breakdown = breakdown.sort_values("amount", ascending=False)

    return {
        "project_id": project_id,
        "project_name": project.name,
        "total_spent": round(total, 2),
        "breakdown": breakdown.to_dict(orient="records")
    }


@router.get("/projects/{project_id}/export")
@limiter.limit("10/minute")
def export_project_expenses(request: Request, project_id: int, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)

    expenses = db.query(models.Expense).options(
        joinedload(models.Expense.category)
    ).filter(
        models.Expense.project_id == project_id
    ).all()

    data = [{
        "Date": e.date,
        "Description": e.description,
        "Category": e.category.name,
        "Amount": e.amount,
        "Notes": e.notes or ""
    } for e in expenses]

    df = pd.DataFrame(data)
    total_amount = df["Amount"].sum() if not df.empty else 0

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Expenses")

        summary_data = {
            "Metric": ["Project", "Budget", "Total Spent", "Remaining", "Overrun"],
            "Value": [
                project.name,
                project.budget,
                total_amount,
                project.budget - total_amount,
                "YES" if total_amount > project.budget else "NO"
            ]
        }
        pd.DataFrame(summary_data).to_excel(writer, index=False, sheet_name="Summary")

    output.seek(0)
    safe_name = _SAFE_FILENAME_RE.sub('_', project.name)
    filename = f"project_{project_id}_{safe_name}_expenses.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/projects/{project_id}/insights")
@limiter.limit("5/minute")
def get_project_insights(request: Request, project_id: int, db: Session = Depends(get_db)):
    project = get_project_or_404(db, project_id)

    rows = (
        db.query(models.Category.name, func.sum(models.Expense.amount))
        .join(models.Expense, models.Expense.category_id == models.Category.id)
        .filter(models.Expense.project_id == project_id)
        .group_by(models.Category.name)
        .all()
    )
    breakdown_dict = {name: round(float(amt), 2) for name, amt in rows}
    total_spent = float(sum(breakdown_dict.values()))

    percent_used = round((total_spent / project.budget) * 100, 2) if project.budget > 0 else 0
    remaining = project.budget - total_spent
    overrun = total_spent > project.budget

    prompt = f"""You are a construction project financial analyst. Analyze this project and provide a concise, actionable insight in 3-4 sentences.

Project: {project.name}
Location: {project.location or 'Not specified'}
Budget: ${project.budget:,.2f} CAD
Total Spent (Actuals): ${total_spent:,.2f} CAD
Remaining: ${remaining:,.2f} CAD
Percent Used: {percent_used}%
Overrun: {"YES - OVER BUDGET" if overrun else "No"}
Status: {project.status.value}

Cost breakdown by category:
{chr(10).join([f"- {cat}: ${amt:,.2f} CAD" for cat, amt in breakdown_dict.items()])}

Provide a professional financial analysis with specific recommendations based on the numbers."""

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}]
        )
    except Exception:
        raise HTTPException(status_code=503, detail="AI insights temporarily unavailable")

    return {
        "project_id": project_id,
        "project_name": project.name,
        "summary": {
            "budget": project.budget,
            "total_spent": round(total_spent, 2),
            "remaining": round(remaining, 2),
            "percent_used": percent_used,
            "overrun": overrun
        },
        "ai_insight": message.content[0].text
    }
