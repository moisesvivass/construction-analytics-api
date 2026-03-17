# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start development server (with auto-reload)
uvicorn app.main:app --reload

# Activate virtual environment (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

The API is available at `http://127.0.0.1:8000` and the dashboard at `http://127.0.0.1:8000/dashboard`. Interactive API docs are at `http://127.0.0.1:8000/docs`.

There are no tests in this project.

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `DATABASE_URL` — PostgreSQL connection string (e.g., `postgresql://postgres@localhost:5432/construction_analytics`)
- `ANTHROPIC_API_KEY` — Required for the `/analytics/projects/{id}/insights` endpoint
- `APP_NAME`, `DEBUG` — Optional metadata

## Architecture

**Backend**: FastAPI + SQLAlchemy + PostgreSQL. All routers live in `app/routers/`. The app is mounted in `app/main.py` which also serves the Jinja2 dashboard template from `templates/index.html` and static files from `static/`.

**Frontend**: Single-page dashboard rendered server-side via Jinja2, then driven by `static/js/dashboard.js` which calls the REST API. Uses Chart.js (via CDN) for bar and doughnut charts. Currency is formatted as CAD.

**Data model** — three tables:
- `Project` — has budget, status enum (`active/completed/on_hold/cancelled`), dates
- `Expense` — belongs to a Project and a Category, has amount and date
- `Category` — simple lookup table (unique name)

**Analytics router** (`app/routers/analytics.py`) is the most complex — it uses Pandas for budget vs actuals calculations, detects overruns, generates Excel exports (OpenPyXL, multi-sheet), and calls the Claude API (Haiku model) for AI financial insights.

## Key Conventions

- Pydantic schemas in `app/schemas.py` define request/response shapes — keep these in sync with `app/models.py`.
- `numpy.bool` serialization issues have come up before — use `bool()` to cast before returning from analytics endpoints.
- The frontend API base URL is hardcoded as `http://127.0.0.1:8000` in `dashboard.js`.
- CORS is whitelisted to `localhost:3000` and `127.0.0.1:8000` — update `app/main.py` if adding new origins.
- Rate limiting is applied via SlowAPI — limits are set per endpoint in the analytics router.
- No authentication exists — this is intentional (internal/demo use). See `SECURITY.md` for the production roadmap.
