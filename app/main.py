from fastapi import FastAPI
from dotenv import load_dotenv
from app.database import engine
from app import models
import os

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=os.getenv("APP_NAME", "Construction Analytics API"),
    description="API for analyzing construction project costs, budgets, and overruns",
    version="1.0.0"
)


@app.get("/")
def root():
    return {"status": "ok", "message": "Construction Analytics API is running"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}