from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from typing import List
import pandas as pd
import io
import anthropic
import os

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"]
)


@router.get("/projects/{project_id}/summary")
def get_project_summary(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(
        models.Project.id == project_id
    ).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )

    expenses = db.query(models.Expense).filter(
        models.Expense.project_id == project_id
    ).all()

    if expenses:
        df = pd.DataFrame([{
            "amount": e.amount,
            "category": e.category.name,
            "date": e.date
        } for e in expenses])
        total_spent = df["amount"].sum()
    else:
        total_spent = 0

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
def get_overruns(db: Session = Depends(get_db)):
    projects = db.query(models.Project).all()
    overruns = []

    for project in projects:
        expenses = db.query(models.Expense).filter(
            models.Expense.project_id == project.id
        ).all()
        total_spent = sum(e.amount for e in expenses)

        if total_spent > project.budget:
            overruns.append({
                "project_id": project.id,
                "project_name": project.name,
                "budget": project.budget,
                "total_spent": round(total_spent, 2),
                "overrun_amount": round(total_spent - project.budget, 2),
                "overrun_percent": round(((total_spent - project.budget) / project.budget) * 100, 2)
            })

    return {
        "total_projects": len(projects),
        "projects_in_overrun": len(overruns),
        "overruns": overruns
    }


@router.get("/projects/{project_id}/breakdown")
def get_expense_breakdown(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(
        models.Project.id == project_id
    ).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )

    expenses = db.query(models.Expense).filter(
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
def export_project_expenses(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(
        models.Project.id == project_id
    ).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )

    expenses = db.query(models.Expense).filter(
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

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Expenses")

        summary_data = {
            "Metric": ["Project", "Budget", "Total Spent", "Remaining", "Overrun"],
            "Value": [
                project.name,
                project.budget,
                df["Amount"].sum() if not df.empty else 0,
                project.budget - (df["Amount"].sum() if not df.empty else 0),
                "YES" if df["Amount"].sum() > project.budget else "NO"
            ]
        }
        summary_df = pd.DataFrame(summary_data)
        summary_df.to_excel(writer, index=False, sheet_name="Summary")

    output.seek(0)
    filename = f"project_{project_id}_{project.name.replace(' ', '_')}_expenses.xlsx"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/projects/{project_id}/insights")
def get_project_insights(project_id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(
        models.Project.id == project_id
    ).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )

    expenses = db.query(models.Expense).filter(
        models.Expense.project_id == project_id
    ).all()

    if expenses:
        df = pd.DataFrame([{
            "amount": e.amount,
            "category": e.category.name
        } for e in expenses])
        total_spent = float(df["amount"].sum())
        breakdown = df.groupby("category")["amount"].sum()
        breakdown_dict = {k: round(float(v), 2) for k, v in breakdown.items()}
    else:
        total_spent = 0
        breakdown_dict = {}

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

    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        messages=[{"role": "user", "content": prompt}]
    )

    insight = message.content[0].text

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
        "ai_insight": insight
    }