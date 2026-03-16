from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
from app.database import engine
from app import models
from app.routers import projects, expenses, categories, analytics
import os

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=os.getenv("APP_NAME", "Construction Analytics API"),
    description="API for analyzing construction project costs, budgets, and overruns",
    version="1.0.0"
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

app.include_router(projects.router)
app.include_router(expenses.router)
app.include_router(categories.router)
app.include_router(analytics.router)


@app.get("/dashboard")
def dashboard(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
def health_check():
    return {"status": "healthy"}