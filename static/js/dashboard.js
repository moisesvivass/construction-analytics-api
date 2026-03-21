const API = '';
let budgetChart = null;
let breakdownChart = null;
let currentProjectId = null;

const CAD_FORMATTER = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0
});

function formatCurrency(amount) {
    return CAD_FORMATTER.format(amount);
}

async function loadProjects() {
    const grid = document.getElementById('projects-grid');
    try {
        const res = await fetch(`${API}/projects/`);
        if (!res.ok) {
            grid.textContent = 'Failed to load projects. Please try again.';
            return;
        }
        const projects = await res.json();

        if (projects.length === 0) {
            grid.textContent = 'No projects found.';
            return;
        }

        grid.innerHTML = '';
        projects.forEach(p => {
            const card = document.createElement('div');
            card.className = 'project-card';
            card.addEventListener('click', () => loadProjectDetail(p.id));

            const badge = document.createElement('span');
            badge.className = `status-badge status-${p.status}`;
            badge.textContent = p.status.replace('_', ' ');

            const title = document.createElement('h3');
            title.textContent = p.name;

            const location = document.createElement('p');
            location.className = 'location';
            location.textContent = p.location || 'No location set';

            const budget = document.createElement('p');
            budget.className = 'budget';
            budget.textContent = `Budget: ${formatCurrency(p.budget)}`;

            card.appendChild(badge);
            card.appendChild(title);
            card.appendChild(location);
            card.appendChild(budget);
            grid.appendChild(card);
        });
    } catch {
        grid.textContent = 'Error connecting to server.';
    }
}

async function loadProjectDetail(projectId) {
    currentProjectId = projectId;

    let summary, breakdown, expenses;
    try {
        const [summaryRes, breakdownRes, expensesRes] = await Promise.all([
            fetch(`${API}/analytics/projects/${projectId}/summary`),
            fetch(`${API}/analytics/projects/${projectId}/breakdown`),
            fetch(`${API}/expenses/project/${projectId}`)
        ]);

        if (!summaryRes.ok || !breakdownRes.ok || !expensesRes.ok) {
            alert('Failed to load project details. Please try again.');
            return;
        }

        summary = await summaryRes.json();
        breakdown = await breakdownRes.json();
        expenses = await expensesRes.json();
    } catch {
        alert('Error connecting to server.');
        return;
    }

    document.getElementById('project-detail').style.display = 'block';
    document.getElementById('detail-title').textContent = summary.project_name;

    document.getElementById('card-budget').textContent = formatCurrency(summary.budget);
    document.getElementById('card-spent').textContent = formatCurrency(summary.total_spent);
    document.getElementById('card-remaining').textContent = formatCurrency(summary.remaining);
    document.getElementById('card-percent').textContent = `${summary.percent_used}%`;

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

    const tbody = document.getElementById('expenses-body');
    tbody.innerHTML = '';
    expenses.forEach(e => {
        const row = document.createElement('tr');
        [e.date, e.description, e.category.name, formatCurrency(e.amount)].forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            row.appendChild(td);
        });
        tbody.appendChild(row);
    });

    document.getElementById('project-detail').scrollIntoView({ behavior: 'smooth' });
}

document.getElementById('export-btn').addEventListener('click', () => {
    if (currentProjectId) {
        window.location.href = `${API}/analytics/projects/${currentProjectId}/export`;
    }
});

document.getElementById('insights-btn').addEventListener('click', async () => {
    if (!currentProjectId) return;

    const insightsBox = document.getElementById('insights-box');
    const insightsText = document.getElementById('insights-text');

    insightsBox.style.display = 'block';
    insightsText.innerHTML = '<p class="loading">Analyzing project with AI...</p>';

    try {
        const res = await fetch(`${API}/analytics/projects/${currentProjectId}/insights`);
        if (!res.ok) {
            insightsText.textContent = 'AI insights are temporarily unavailable. Please try again later.';
            return;
        }
        const data = await res.json();

        const rendered = data.ai_insight
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^## (.+)$/gm, '<h3>$1</h3>')
            .replace(/^# (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        insightsText.innerHTML = DOMPurify.sanitize(rendered);
    } catch {
        insightsText.textContent = 'Error connecting to server.';
    }
});

loadProjects();
