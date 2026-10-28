from fastapi import Depends, FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from dotenv import load_dotenv
from app.database import engine
from app import models
from app.routers import projects, expenses, categories, analytics
from app.security import require_admin_for_writes
import os
from pathlib import Path

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=os.getenv("APP_NAME", "Construction Analytics API"),
    description="API for analyzing construction project costs, budgets, and overruns",
    version="1.0.0"
)

_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
# Cache-busting token for /static URLs: changes whenever a static file changes,
# so returning visitors never mix new HTML with cached old CSS/JS.
templates.env.globals["asset_v"] = max(
    int(p.stat().st_mtime) for p in Path("static").rglob("*") if p.is_file()
)

# Public demo is read-only: every non-GET route on these routers needs the admin key.
for router in (projects.router, expenses.router, categories.router, analytics.router):
    app.include_router(router, dependencies=[Depends(require_admin_for_writes)])


@app.get("/")
def root():
    return RedirectResponse(url="/dashboard")


@app.get("/dashboard")
def dashboard(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
def health_check():
    return {"status": "healthy"}