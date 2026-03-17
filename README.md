🏗️ Construction Analytics API
Show Image
Show Image
Show Image
Show Image
Show Image
A REST API for analyzing construction project costs, budgets, and overruns — with an AI-powered dashboard built on FastAPI, PostgreSQL, and the Claude API.
Show Image
🚀 Live Demo
🌐 https://web-production-de6e76.up.railway.app

No credentials needed — the API is open for demo use.
Visit /dashboard for the visual interface or /docs for the full Swagger UI.

📸 Screenshots
📊 Dashboard
Show Image
📁 Project Detail
Show Image
🤖 AI Insights
Show Image
📋 Swagger UI
Show Image
✨ Features

Project Management — Full CRUD for construction projects with budget, status, and date tracking
Expense Tracking — Log expenses by category with validation and filtering
Budget Analytics — Real-time summary cards: budget, actuals, remaining, % used
Overrun Detection — Automatic budget overrun alerts with overrun amount and percentage
AI Insights — Claude Haiku generates financial analysis and recommendations per project
Excel Export — Two-sheet export (Expenses + Summary) via Pandas and openpyxl
Interactive Dashboard — Chart.js bar chart (Budget vs Actuals) and donut chart (Cost Breakdown)
Rate Limiting — SlowAPI middleware to protect endpoints
CORS Support — Configurable via environment variable

🛠️ Tech Stack

Python 3.12 + FastAPI 0.135 — backend framework with async support
SQLAlchemy 2.0 + PostgreSQL — ORM and database layer
Pydantic v2 — request/response validation with field validators
Pandas 3.0 + openpyxl — analytics and Excel export
Anthropic Claude Haiku — AI-powered financial insights
Jinja2 + Chart.js — server-rendered dashboard with interactive charts
SlowAPI — rate limiting middleware
Railway — cloud deployment with managed PostgreSQL

📡 API Endpoints
Projects — 6 endpoints
MethodEndpointDescriptionGET/projects/List all projectsPOST/projects/Create a projectGET/projects/activeList active projectsGET/projects/{id}Get project by IDPUT/projects/{id}Update projectDELETE/projects/{id}Delete project
Expenses — 5 endpoints
MethodEndpointDescriptionGET/expenses/List all expensesPOST/expenses/Create an expenseGET/expenses/{id}Get expense by IDGET/expenses/project/{id}Get expenses by projectPUT/expenses/{id}Update expenseDELETE/expenses/{id}Delete expense
Categories — 3 endpoints
MethodEndpointDescriptionGET/categories/List all categoriesPOST/categories/Create a categoryGET/categories/{id}Get category by ID
Analytics — 5 endpoints
MethodEndpointDescriptionGET/analytics/projects/{id}/summaryBudget vs actuals summaryGET/analytics/projects/{id}/breakdownCost breakdown by categoryGET/analytics/projects/{id}/insightsAI-generated financial analysisGET/analytics/projects/{id}/exportExport to Excel (2 sheets)GET/analytics/overrunsAll projects in overrun
⚙️ Setup Instructions
1. Clone the repository
bashgit clone https://github.com/moisesvivass/construction-analytics-api.git
cd construction-analytics-api
2. Create and activate virtual environment
bash# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python -m venv venv
source venv/bin/activate
3. Install dependencies
bashpip install -r requirements.txt
4. Create your .env file
bashDATABASE_URL=postgresql://postgres@localhost:5432/construction_analytics
ANTHROPIC_API_KEY=sk-ant-your-key-here
APP_NAME=Construction Analytics API
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:8000
5. Run the app
bashuvicorn app.main:app --reload
Visit:

http://127.0.0.1:8000/dashboard — Visual dashboard
http://127.0.0.1:8000/docs — Swagger UI
http://127.0.0.1:8000/health — Health check

🗄️ Database Schema
Project
├── id (PK)
├── name
├── description
├── location
├── budget
├── start_date / end_date
├── status (active / completed / on_hold / cancelled)
└── created_at / updated_at
    │
    └── has many Expenses
            ├── id (PK)
            ├── description
            ├── amount
            ├── date
            ├── notes
            ├── project_id (FK → Project)
            └── category_id (FK → Category)

Category
├── id (PK)
├── name (unique)
└── description
Relationships: Project → Expense (1:N, cascade delete) — Category → Expense (1:N)
📁 Project Structure
construction-analytics-api/
├── app/
│   ├── main.py                # App entry point, middleware, routers
│   ├── models.py              # SQLAlchemy models
│   ├── schemas.py             # Pydantic v2 schemas
│   ├── database.py            # DB engine and session
│   └── routers/
│       ├── projects.py        # Project CRUD
│       ├── expenses.py        # Expense CRUD
│       ├── categories.py      # Category CRUD
│       └── analytics.py       # Analytics, AI insights, Excel export
├── static/
│   └── js/dashboard.js        # Frontend logic (Chart.js, fetch API)
├── templates/
│   └── index.html             # Jinja2 dashboard template
├── docs/
│   └── screenshots/
├── .env.example
├── .gitignore
├── CLAUDE.md
├── SECURITY.md
├── Procfile
└── requirements.txt
🔒 Security

CORS middleware with configurable origins via ALLOWED_ORIGINS env variable
SlowAPI rate limiting on API endpoints
Pydantic v2 input validation on all request bodies (positive amounts, positive budgets)
.env excluded from version control via .gitignore
API keys and secrets loaded from environment variables only

✅ Roadmap

 Full CRUD — Projects, Expenses, Categories
 Analytics endpoints with Pandas
 AI Insights via Claude Haiku
 Excel export (2-sheet: Expenses + Summary)
 Interactive dashboard with Chart.js
 Budget overrun detection
 Pydantic v2 validation
 CORS + rate limiting
 Deploy to Railway with PostgreSQL
 Authentication (JWT)
 Pagination on list endpoints
 Unit tests

👨‍💻 Author
Moises Vivas — CS graduate building backend systems in Python · Toronto, Canada

GitHub: github.com/moisesvivass