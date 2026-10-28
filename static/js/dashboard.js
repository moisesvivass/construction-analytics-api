const API = '';
// "Over budget" matches the backend rule in app/routers/analytics.py (spent > budget).
// "At risk" is a dashboard-only band just below it.
const AT_RISK_PCT = 90;

let projects = [];
let statusFilter = 'all';
let sortKey = 'used';
let currentProject = null;
let visibleProjects = [];
let budgetChart = null;
let breakdownChart = null;

const CAD_FORMATTER = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0
});
const CAD_COMPACT = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    notation: 'compact',
    maximumFractionDigits: 2
});
const DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });

const formatCurrency = amount => CAD_FORMATTER.format(amount);
const formatCompact = amount => CAD_COMPACT.format(amount);
const formatDate = iso => DATE_FORMATTER.format(new Date(`${iso}T00:00:00`));
const $ = id => document.getElementById(id);

// Budget state drives the reserved status colors; each state also carries a text label.
function budgetState(spent, budget, pct) {
    if (spent > budget) return { key: 'critical', label: '▲ Over budget' };
    if (pct >= AT_RISK_PCT) return { key: 'warning', label: '● At risk' };
    return { key: 'good', label: 'On track' };
}

function withTotals(project) {
    const spent = project.expenses.reduce((sum, e) => sum + e.amount, 0);
    const pct = project.budget > 0 ? (spent / project.budget) * 100 : 0;
    return { ...project, spent, pct, state: budgetState(spent, project.budget, pct) };
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

async function loadProjects() {
    const grid = $('projects-grid');
    try {
        const res = await fetch(`${API}/projects/`);
        if (!res.ok) {
            grid.textContent = 'Failed to load projects. Please try again.';
            return;
        }
        projects = (await res.json()).map(withTotals);
    } catch {
        grid.textContent = 'Error connecting to server.';
        return;
    }
    renderPortfolio();
    renderProjects();
    openFromHash();
}

function renderPortfolio() {
    let budget = 0, spent = 0, over = 0, overAmount = 0, atRisk = 0;
    for (const p of projects) {
        budget += p.budget;
        spent += p.spent;
        if (p.state.key === 'critical') { over += 1; overAmount += p.spent - p.budget; }
        if (p.state.key === 'warning') atRisk += 1;
    }

    $('kpi-budget').textContent = formatCompact(budget);
    $('kpi-count').textContent = `${projects.length} projects`;
    $('kpi-spent').textContent = formatCompact(spent);
    $('kpi-used').textContent = budget > 0 ? `${Math.round((spent / budget) * 100)}% of total budget` : '';
    $('kpi-over').textContent = `${over}`;
    $('kpi-over-amount').textContent = over ? `${formatCompact(overAmount)} over in total` : 'none';
    $('kpi-risk').textContent = `${atRisk}`;
    $('kpi-risk-sub').textContent = `${AT_RISK_PCT}–100% of budget used`;
}

const SORTERS = {
    used: (a, b) => b.pct - a.pct,
    budget: (a, b) => b.budget - a.budget,
    name: (a, b) => a.name.localeCompare(b.name)
};

function renderProjects() {
    const grid = $('projects-grid');
    visibleProjects = projects
        .filter(p => statusFilter === 'all' || p.status === statusFilter)
        .sort(SORTERS[sortKey]);

    grid.replaceChildren();
    if (visibleProjects.length === 0) {
        grid.appendChild(el('p', 'muted empty', 'No projects match this filter.'));
        return;
    }
    visibleProjects.forEach(p => grid.appendChild(projectCard(p)));
}

function projectCard(p) {
    const card = el('button', 'project-card');
    card.type = 'button';
    card.addEventListener('click', () => openProject(p));

    const top = el('span', 'card-top');
    const titles = el('span');
    titles.append(el('span', 'card-title', p.name), el('span', 'card-location', p.location || 'No location set'));
    top.append(titles, el('span', `status-badge status-${p.status}`, p.status.replace('_', ' ')));

    const bar = el('span', 'progress');
    bar.setAttribute('role', 'img');
    bar.setAttribute('aria-label', `${Math.round(p.pct)}% of budget used`);
    const fill = el('span', `progress-fill state-${p.state.key}`);
    fill.style.width = `${Math.min(p.pct, 100)}%`;
    bar.appendChild(fill);

    const figures = el('span', 'card-figures');
    const amounts = el('span');
    amounts.append(el('strong', '', formatCompact(p.spent)), document.createTextNode(` of ${formatCompact(p.budget)}`));
    figures.append(amounts, el('span', `state-label state-${p.state.key}`, `${Math.round(p.pct)}% · ${p.state.label}`));

    card.append(top, bar, figures);
    return card;
}

// Project detail drawer: a native <dialog>, so focus trap, Escape and focus
// restore come from the browser. Each open project gets a #project-<id> URL,
// so it can be shared, survives a reload, and the Back button closes it.

const dialog = $('project-detail');
let pushedHistory = false;
let closingFromHistory = false;

const hashFor = p => `#project-${p.id}`;

function projectFromHash() {
    const match = location.hash.match(/^#project-(\d+)$/);
    return match ? projects.find(x => x.id === Number(match[1])) : undefined;
}

// Opens the project named in the URL, if any; returns whether it did.
function openFromHash() {
    const p = projectFromHash();
    if (p) openProject(p, { push: false });
    return Boolean(p);
}

// The browse order follows the list as filtered and sorted; a deep-linked
// project outside the current filter falls back to the full list.
function browseList() {
    return visibleProjects.includes(currentProject) ? visibleProjects : projects;
}

function stepProject(delta) {
    const list = browseList();
    const next = list[list.indexOf(currentProject) + delta];
    if (next) openProject(next, { push: false });
}

function openProject(p, { push = true } = {}) {
    currentProject = p;
    const wasOpen = dialog.open;

    if (push && !wasOpen) {
        history.pushState(null, '', hashFor(p));
        pushedHistory = true;
    } else {
        history.replaceState(null, '', hashFor(p));
    }

    const list = browseList();
    const index = list.indexOf(p);
    $('project-position').textContent = `${index + 1} of ${list.length}`;
    $('prev-project').disabled = index <= 0;
    $('next-project').disabled = index >= list.length - 1;

    const badge = $('detail-status');
    badge.className = `status-badge status-${p.status}`;
    badge.textContent = p.status.replace('_', ' ');
    $('detail-title').textContent = p.name;
    $('detail-location').textContent = p.location || 'No location set';

    $('card-budget').textContent = formatCurrency(p.budget);
    $('card-spent').textContent = formatCurrency(p.spent);
    $('card-remaining').textContent = formatCurrency(p.budget - p.spent);
    $('card-percent').textContent = `${p.pct.toFixed(1)}%`;

    const alert = $('overrun-alert');
    alert.hidden = p.state.key !== 'critical';
    alert.textContent = `▲ Over budget by ${formatCurrency(p.spent - p.budget)} (${(p.pct - 100).toFixed(1)}% overrun)`;

    $('insights-box').hidden = true;
    $('insights-text').replaceChildren();

    const hasExpenses = p.expenses.length > 0;
    $('no-expenses').hidden = hasExpenses;
    $('detail-charts').hidden = !hasExpenses;
    $('expenses-panel').hidden = !hasExpenses;

    if (!wasOpen) dialog.showModal();
    dialog.querySelector('.drawer-body').scrollTop = 0;

    if (hasExpenses) {
        // Animate only on first open; stepping between projects redraws instantly.
        renderCharts(p, { animate: !wasOpen });
        renderExpenses(p);
    }
}

// Full-screen choice is remembered per viewer; storage can be unavailable.
const FULL_KEY = 'drawerFullScreen';

function prefersFullScreen() {
    try { return localStorage.getItem(FULL_KEY) === '1'; } catch { return false; }
}

function setFullScreen(full) {
    dialog.classList.toggle('is-full', full);
    const button = $('drawer-expand');
    button.setAttribute('aria-pressed', String(full));
    button.textContent = full ? '⤡ Exit full screen' : '⤢ Full screen';
}

// Chart colors come from the CSS tokens, applied as Chart.js defaults.
// Read once, and again only when the color scheme changes.
let chartTheme = null;

function applyChartTheme() {
    const styles = getComputedStyle(document.documentElement);
    const token = name => styles.getPropertyValue(name).trim();
    Chart.defaults.color = token('--text-secondary');
    Chart.defaults.borderColor = token('--grid');
    Chart.defaults.maintainAspectRatio = false;
    return {
        series: token('--series-1'),
        seriesSoft: token('--series-1-soft'),
        reference: token('--reference')
    };
}

const valueAxis = () => ({
    beginAtZero: true,
    border: { display: false },
    ticks: { callback: v => formatCompact(v) }
});

function renderCharts(p, { animate = true } = {}) {
    chartTheme ||= applyChartTheme();
    const motion = animate ? {} : { animation: false };
    renderBudgetChart(p, chartTheme, motion);
    renderBreakdownChart(p, chartTheme, motion);
}

function renderBudgetChart(p, theme, motion) {
    const sorted = [...p.expenses].sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const cumulative = sorted.map(e => (running += e.amount));

    if (budgetChart) budgetChart.destroy();
    budgetChart = new Chart($('budget-chart'), {
        type: 'line',
        data: {
            labels: sorted.map(e => formatDate(e.date)),
            datasets: [
                {
                    label: 'Cumulative spend',
                    data: cumulative,
                    borderColor: theme.series,
                    backgroundColor: theme.seriesSoft,
                    borderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    fill: true
                },
                {
                    label: 'Budget',
                    data: sorted.map(() => p.budget),
                    borderColor: theme.reference,
                    borderWidth: 1.5,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    pointHoverRadius: 0
                }
            ]
        },
        options: {
            ...motion,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', align: 'end', labels: { boxWidth: 12, boxHeight: 2 } },
                tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}` } }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 16 } },
                y: valueAxis()
            }
        }
    });
}

function renderBreakdownChart(p, theme, motion) {
    const totals = new Map();
    p.expenses.forEach(e => totals.set(e.category.name, (totals.get(e.category.name) || 0) + e.amount));
    const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);

    if (breakdownChart) breakdownChart.destroy();
    breakdownChart = new Chart($('breakdown-chart'), {
        type: 'bar',
        data: {
            labels: rows.map(r => r[0]),
            datasets: [{
                label: 'Spend',
                data: rows.map(r => r[1]),
                backgroundColor: theme.series,
                borderRadius: 4,
                borderSkipped: 'start',
                barPercentage: 0.7,
                categoryPercentage: 0.9
            }]
        },
        options: {
            ...motion,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `${formatCurrency(ctx.raw)} (${((ctx.raw / p.spent) * 100).toFixed(1)}% of spend)`
                    }
                }
            },
            scales: {
                x: valueAxis(),
                y: { grid: { display: false } }
            }
        }
    });
}

function renderExpenses(p) {
    const tbody = $('expenses-body');
    tbody.replaceChildren();
    [...p.expenses]
        .sort((a, b) => b.date.localeCompare(a.date))
        .forEach(e => {
            const row = document.createElement('tr');
            row.append(
                el('td', '', formatDate(e.date)),
                el('td', '', e.description),
                el('td', '', e.category.name),
                el('td', 'num', formatCurrency(e.amount))
            );
            tbody.appendChild(row);
        });
}

// Controls

$('status-filter').addEventListener('click', event => {
    const button = event.target.closest('button[data-status]');
    if (!button) return;
    statusFilter = button.dataset.status;
    $('status-filter').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    renderProjects();
});

$('sort-select').addEventListener('change', event => {
    sortKey = event.target.value;
    renderProjects();
});

$('drawer-close').addEventListener('click', () => dialog.close());
$('prev-project').addEventListener('click', () => stepProject(-1));
$('next-project').addEventListener('click', () => stepProject(1));
setFullScreen(prefersFullScreen());
$('drawer-expand').addEventListener('click', () => {
    const full = !dialog.classList.contains('is-full');
    setFullScreen(full);
    try { localStorage.setItem(FULL_KEY, full ? '1' : '0'); } catch { /* preference is optional */ }
});

const ARROW_STEPS = { ArrowLeft: -1, ArrowRight: 1 };
dialog.addEventListener('keydown', event => {
    // Ignore key auto-repeat so a held arrow doesn't flood history.replaceState.
    if (event.repeat || event.target.closest('select, input, textarea')) return;
    const step = ARROW_STEPS[event.key];
    if (step) stepProject(step);
});

window.addEventListener('popstate', () => {
    if (!openFromHash() && dialog.open) {
        closingFromHistory = true;
        dialog.close();
    }
});
// A click on the dialog element itself (not its panel) is a click on the backdrop.
dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
});
dialog.addEventListener('close', () => {
    currentProject = null;
    if (closingFromHistory) {
        closingFromHistory = false;
    } else if (pushedHistory) {
        history.back();
    } else {
        history.replaceState(null, '', location.pathname + location.search);
    }
    pushedHistory = false;
});

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    chartTheme = applyChartTheme();
    if (currentProject) renderCharts(currentProject, { animate: false });
});

$('export-btn').addEventListener('click', () => {
    if (currentProject) {
        window.location.href = `${API}/analytics/projects/${currentProject.id}/export`;
    }
});

$('insights-btn').addEventListener('click', async () => {
    if (!currentProject) return;

    const button = $('insights-btn');
    const insightsText = $('insights-text');

    $('insights-box').hidden = false;
    insightsText.replaceChildren(el('p', 'muted', 'Analyzing project with AI…'));
    button.disabled = true;

    try {
        const res = await fetch(`${API}/analytics/projects/${currentProject.id}/insights`);
        if (!res.ok) {
            insightsText.textContent = res.status === 429
                ? 'AI insights limit reached for now. Please try again later.'
                : 'AI insights are temporarily unavailable. Please try again later.';
            return;
        }
        const data = await res.json();

        const rendered = data.ai_insight
            .replace(/^### (.+)$/gm, '<h4>$1</h4>')
            .replace(/^#{1,2} (.+)$/gm, '<h3>$1</h3>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/^\d+\.\s(.+)$/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');

        insightsText.innerHTML = DOMPurify.sanitize(`<p>${rendered}</p>`);
    } catch {
        insightsText.textContent = 'Error connecting to server.';
    } finally {
        button.disabled = false;
    }
});

loadProjects();
