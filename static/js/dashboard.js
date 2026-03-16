const API = 'http://127.0.0.1:8000';
let budgetChart = null;
let breakdownChart = null;
let currentProjectId = null;

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD',
        minimumFractionDigits: 0
    }).format(amount);
}

// Load all projects
async function loadProjects() {
    const res = await fetch(`${API}/projects/`);
    const projects = await res.json();
    const grid = document.getElementById('projects-grid');

    if (projects.length === 0) {
        grid.innerHTML = '<p class="loading">No projects found.</p>';
        return;
    }

    grid.innerHTML = projects.map(p => `
        <div class="project-card" onclick="loadProjectDetail(${p.id})">
            <span class="status-badge status-${p.status}">${p.status.replace('_', ' ')}</span>
            <h3>${p.name}</h3>
            <p class="location">${p.location || 'No location set'}</p>
            <p class="budget">Budget: ${formatCurrency(p.budget)}</p>
        </div>
    `).join('');
}

// Load project detail
async function loadProjectDetail(projectId) {
    currentProjectId = projectId;

    const [summaryRes, breakdownRes, expensesRes] = await Promise.all([
        fetch(`${API}/analytics/projects/${projectId}/summary`),
        fetch(`${API}/analytics/projects/${projectId}/breakdown`),
        fetch(`${API}/expenses/project/${projectId}`)
    ]);

    const summary = await summaryRes.json();
    const breakdown = await breakdownRes.json();
    const expenses = await expensesRes.json();

    // Show detail section
    document.getElementById('project-detail').style.display = 'block';
    document.getElementById('detail-title').textContent = summary.project_name;

    // Summary cards
    document.getElementById('card-budget').textContent = formatCurrency(summary.budget);
    document.getElementById('card-spent').textContent = formatCurrency(summary.total_spent);
    document.getElementById('card-remaining').textContent = formatCurrency(summary.remaining);
    document.getElementById('card-percent').textContent = `${summary.percent_used}%`;

    // Overrun warning
    const existingWarning = document.querySelector('.overrun-warning');
    if (existingWarning) existingWarning.remove();

    if (summary.overrun) {
        const warning = document.createElement('div');
        warning.className = 'overrun-warning';
        warning.textContent = 'WARNING: This project is over budget!';
        document.getElementById('project-detail').insertBefore(
            warning,
            document.querySelector('.cards-grid')
        );
    }

    // Budget vs Spent chart
    if (budgetChart) budgetChart.destroy();
    budgetChart = new Chart(document.getElementById('budget-chart'), {
        type: 'bar',
        data: {
            labels: ['Budget', 'Actuals', 'Remaining'],
            datasets: [{
                data: [summary.budget, summary.total_spent, summary.remaining],
                backgroundColor: ['#4f8ef7', '#f87171', '#34d399'],
                borderRadius: 6
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    ticks: {
                        callback: val => formatCurrency(val)
                    }
                }
            }
        }
    });

    // Breakdown donut chart
    if (breakdownChart) breakdownChart.destroy();
    const colors = ['#4f8ef7', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#fb923c'];

    breakdownChart = new Chart(document.getElementById('breakdown-chart'), {
        type: 'doughnut',
        data: {
            labels: breakdown.breakdown.map(b => b.category),
            datasets: [{
                data: breakdown.breakdown.map(b => b.amount),
                backgroundColor: colors,
                borderWidth: 2
            }]
        },
        options: {
            plugins: {
                legend: { position: 'right' },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.label}: ${formatCurrency(ctx.raw)}`
                    }
                }
            }
        }
    });

    // Expenses table
    const tbody = document.getElementById('expenses-body');
    tbody.innerHTML = expenses.map(e => `
        <tr>
            <td>${e.date}</td>
            <td>${e.description}</td>
            <td>${e.category.name}</td>
            <td>${formatCurrency(e.amount)}</td>
        </tr>
    `).join('');

    // Scroll to detail
    document.getElementById('project-detail').scrollIntoView({ behavior: 'smooth' });
}

// Export Excel
document.getElementById('export-btn').addEventListener('click', () => {
    if (currentProjectId) {
        window.location.href = `${API}/analytics/projects/${currentProjectId}/export`;
    }
});

// AI Insights
document.getElementById('insights-btn').addEventListener('click', async () => {
    if (!currentProjectId) return;
    
    const insightsBox = document.getElementById('insights-box');
    const insightsText = document.getElementById('insights-text');
    
    insightsBox.style.display = 'block';
    insightsText.innerHTML = '<p class="loading">Analyzing project with AI...</p>';

    const res = await fetch(`${API}/analytics/projects/${currentProjectId}/insights`);
    const data = await res.json();

    insightsText.innerHTML = `<p>${data.ai_insight.replace(/\n/g, '<br>')}</p>`;
});
// Init
loadProjects();