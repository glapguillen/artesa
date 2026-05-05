import { dataRepository } from './services/dataRepository.js';
import { analyzeOpportunities, buildProjectionSeries, detectRankingMomentum, getCompanyTrend } from './services/analyticsService.js';
import { answerQuestion } from './services/aiService.js';
import { exportCsv, exportJson, printToPdf } from './services/exportService.js';

const state = {
  activeTab: 'rankings',
  filters: { startYear: dataRepository.getYearRange()[0], endYear: dataRepository.getYearRange()[1], sector: 'Todos', size: 'Todas', search: '' },
  sortKey: 'rank',
  selectedCompany: dataRepository.getCompanies()[0],
  capital: 600000,
  businessSize: 'Todas',
  question: '¿Cuáles son las oportunidades emergentes con mejor proyección?'
};

const sizes = ['Todas', 'Pequeña', 'Mediana', 'Grande'];
const analyses = analyzeOpportunities(dataRepository.getOpportunities());
const root = document.getElementById('root');

function render() {
  const rankingRows = dataRepository.getRankingHistory(state.filters).sort((a, b) => compareValues(a[state.sortKey], b[state.sortKey]));
  const filteredOpportunities = analyses.filter((item) => {
    const capitalMatch = state.capital >= item.minCapital && state.capital <= item.maxCapital;
    const sizeMatch = state.businessSize === 'Todas' || item.businessSize === state.businessSize;
    return capitalMatch && sizeMatch;
  });
  const answer = answerQuestion(state.question, rankingRows, analyses);
  const latestYear = dataRepository.getYearRange()[1];
  const leaders = rankingRows.filter((row) => row.year === latestYear).sort((a, b) => a.rank - b.rank).slice(0, 3);
  const momentum = detectRankingMomentum(rankingRows);
  const companyTrend = getCompanyTrend(dataRepository.getRankingHistory(), state.selectedCompany);

  root.innerHTML = `
    <main class="app-shell">
      ${heroTemplate()}
      ${kpiTemplate()}
      <nav class="tabs" aria-label="Dashboard tabs">
        <button data-tab="rankings" class="${state.activeTab === 'rankings' ? 'active' : ''}">📊 Ranking histórico</button>
        <button data-tab="opportunities" class="${state.activeTab === 'opportunities' ? 'active' : ''}">📈 Oportunidades e IA</button>
      </nav>
      ${state.activeTab === 'rankings' ? rankingTemplate(rankingRows, leaders, momentum, companyTrend) : opportunitiesTemplate(filteredOpportunities, answer)}
    </main>`;
  bindEvents(rankingRows, filteredOpportunities);
}

function heroTemplate() {
  return `<section class="hero panel">
    <div>
      <p class="eyebrow">✨ Artesa AI Intelligence</p>
      <h1>Dashboard profesional de rankings, inversiones y proyecciones IA</h1>
      <p class="hero-copy">Explore historial completo, segmente oportunidades por capital y tamaño empresarial, detecte negocios emergentes y consulte los datos con respuestas explicables.</p>
    </div>
    <div class="hero-actions">
      <button id="export-pdf">📄 Exportar PDF</button>
      <button id="export-json">⬇️ Exportar JSON</button>
    </div>
  </section>`;
}

function kpiTemplate() {
  const emerging = analyses.filter((item) => item.isEmerging).length;
  return `<section class="kpi-grid">
    ${kpi('Empresas rastreadas', dataRepository.getCompanies().length, 'histórico completo')}
    ${kpi('Sectores', dataRepository.getSectors().length, 'comparables')}
    ${kpi('Oportunidades IA', analyses.length, `${emerging} emergentes`)}
    ${kpi('Horizontes', '3/5/7', 'años proyectados')}
  </section>`;
}

function rankingTemplate(rows, leaders, momentum, companyTrend) {
  const sectors = ['Todos', ...dataRepository.getSectors()];
  return `<section class="tab-grid">
    <div class="panel wide">
      <div class="section-title"><span>🔎</span><h2>Exploración interactiva del ranking completo</h2></div>
      <div class="filters">
        ${inputField('Buscar', 'search', state.filters.search, 'Empresa')}
        ${selectField('Sector', 'sector', state.filters.sector, sectors)}
        ${selectField('Tamaño', 'size', state.filters.size, sizes)}
        ${numberField('Desde', 'startYear', state.filters.startYear)}
        ${numberField('Hasta', 'endYear', state.filters.endYear)}
        <button id="export-ranking">⬇️ CSV</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr>${['rank', 'company', 'sector', 'size', 'year', 'revenue', 'growth', 'margin', 'marketShare'].map((key) => `<th data-sort="${key}">${key}${state.sortKey === key ? ' ↓' : ''}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((row) => `<tr><td>#${row.rank}</td><td>${row.company}</td><td>${row.sector}</td><td>${row.size}</td><td>${row.year}</td><td>$${row.revenue}M</td><td>${row.growth}%</td><td>${row.margin}%</td><td>${row.marketShare}%</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <aside class="panel insights">
      <h2>Reasoning antes de conclusiones</h2>
      <ol>
        <li>Se filtra el dataset por periodo, sector, tamaño y búsqueda.</li>
        <li>Se calculan líderes del último año disponible y señales de momentum.</li>
        <li>Se visualiza evolución por empresa para explicar cambios de posición.</li>
      </ol>
      <h3>Conclusiones</h3>
      ${leaders.map((leader) => `<p><strong>#${leader.rank} ${leader.company}</strong> lidera ${leader.sector} con $${leader.revenue}M.</p>`).join('')}
      ${momentum.slice(0, 3).map((item) => `<p class="tagline">${item}</p>`).join('')}
    </aside>
    <div class="panel wide">
      <div class="chart-tools">${selectField('Empresa', 'selectedCompany', state.selectedCompany, dataRepository.getCompanies())}</div>
      ${lineChart(`Ranking de ${state.selectedCompany}`, companyTrend, true)}
    </div>
  </section>`;
}

function opportunitiesTemplate(filteredOpportunities, answer) {
  const focus = filteredOpportunities[0] ?? analyses[0];
  return `<section class="tab-grid">
    <div class="panel wide">
      <div class="section-title"><span>💡</span><h2>Oportunidades por capital y tamaño empresarial</h2></div>
      <div class="filters opportunities-filter">
        <label>Capital disponible<input id="capital" type="range" min="10000" max="9000000" step="10000" value="${state.capital}" /><strong>$${state.capital.toLocaleString()}</strong></label>
        ${selectField('Tamaño', 'businessSize', state.businessSize, sizes)}
        <button id="export-opportunities">⬇️ CSV</button>
      </div>
      <div class="cards-grid">
        ${filteredOpportunities.length ? filteredOpportunities.map(opportunityCard).join('') : '<p class="empty-state">No hay oportunidades para este capital. Ajuste el rango o tamaño empresarial.</p>'}
      </div>
    </div>
    <aside class="panel insights">
      <h2>Reasoning de proyección</h2>
      <ol>
        <li>Se segmenta por capital disponible y tamaño empresarial.</li>
        <li>El score pondera demanda, retorno, automatización, competencia y riesgo.</li>
        <li>Las curvas a 3, 5 y 7 años usan crecimiento compuesto explicable.</li>
      </ol>
      <h3>Conclusión</h3>
      <p><strong>${focus.title}</strong> es el foco principal del segmento visible con score ${focus.score} y retorno proyectado a 5 años de ${focus.projection5Year}%.</p>
    </aside>
    <div class="panel wide">${lineChart(`Proyección: ${focus.title}`, buildProjectionSeries(focus), false)}</div>
    <div class="panel ai-panel">
      <div class="section-title"><span>🤖</span><h2>Preguntas con IA sobre los datos</h2></div>
      <div class="question-box"><span>🔍</span><textarea id="question">${escapeHtml(state.question)}</textarea></div>
      <div class="answer-box">
        <h3>Reasoning</h3><ol>${answer.reasoning.map((step) => `<li>${step}</li>`).join('')}</ol>
        <h3>Conclusión</h3><p>${answer.conclusion}</p>
        <h3>Fuentes</h3><ul>${answer.citations.map((citation) => `<li>${citation}</li>`).join('')}</ul>
      </div>
    </div>
  </section>`;
}

function opportunityCard(item) {
  return `<article class="opportunity-card ${item.isEmerging ? 'emerging' : ''}">
    <div><span>${item.businessSize}</span>${item.isEmerging ? '<b>Emergente IA</b>' : ''}</div>
    <h3>${item.title}</h3><p>${item.summary}</p>
    <dl><dt>Capital</dt><dd>$${item.minCapital.toLocaleString()} - $${item.maxCapital.toLocaleString()}</dd><dt>Score</dt><dd>${item.score}/100</dd><dt>3/5/7 años</dt><dd>${item.projection3Year}% · ${item.projection5Year}% · ${item.projection7Year}%</dd></dl>
    <ul>${item.reasoning.map((reason) => `<li>${reason}</li>`).join('')}</ul>
  </article>`;
}

function lineChart(label, points, invert = false) {
  const width = 520;
  const height = 220;
  const padding = 28;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (width - padding * 2) / Math.max(points.length - 1, 1);
  const coordinates = points.map((point, index) => {
    const normalized = (point.value - min) / range;
    const yRatio = invert ? normalized : 1 - normalized;
    return { x: padding + index * step, y: padding + yRatio * (height - padding * 2), point };
  });
  const path = coordinates.map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`).join(' ');
  const gradientId = `gradient-${label.replace(/[^a-z0-9]/gi, '-')}`;
  return `<div class="chart-card"><div class="chart-header"><strong>${label}</strong><span>${points.length} puntos</span></div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">
      <defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#2563eb" /><stop offset="100%" stop-color="#14b8a6" /></linearGradient></defs>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#dbe3ef" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#dbe3ef" />
      <path d="${path}" fill="none" stroke="url(#${gradientId})" stroke-width="4" stroke-linecap="round" />
      ${coordinates.map((coord) => `<g><circle cx="${coord.x}" cy="${coord.y}" r="5" fill="#0f172a" /><text x="${coord.x}" y="${height - 8}" text-anchor="middle" class="axis-label">${coord.point.year}</text><text x="${coord.x}" y="${coord.y - 10}" text-anchor="middle" class="point-label">${coord.point.value}</text></g>`).join('')}
    </svg></div>`;
}

function bindEvents(rankingRows, filteredOpportunities) {
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => update({ activeTab: button.dataset.tab })));
  document.getElementById('export-pdf')?.addEventListener('click', printToPdf);
  document.getElementById('export-json')?.addEventListener('click', () => exportJson('artesa-dashboard.json', { filters: state.filters, analyses }));
  document.getElementById('export-ranking')?.addEventListener('click', () => exportCsv('ranking-filtrado.csv', rankingRows));
  document.getElementById('export-opportunities')?.addEventListener('click', () => exportCsv('oportunidades-ia.csv', filteredOpportunities));
  document.querySelectorAll('[data-sort]').forEach((cell) => cell.addEventListener('click', () => update({ sortKey: cell.dataset.sort })));
  for (const id of ['search', 'sector', 'size', 'startYear', 'endYear']) {
    document.getElementById(id)?.addEventListener('input', (event) => {
      const value = event.target.type === 'number' ? Number(event.target.value) : event.target.value;
      update({ filters: { ...state.filters, [id]: value } });
    });
  }
  document.getElementById('selectedCompany')?.addEventListener('input', (event) => update({ selectedCompany: event.target.value }));
  document.getElementById('businessSize')?.addEventListener('input', (event) => update({ businessSize: event.target.value }));
  document.getElementById('capital')?.addEventListener('input', (event) => update({ capital: Number(event.target.value) }));
  document.getElementById('question')?.addEventListener('input', (event) => update({ question: event.target.value }));
}

function inputField(label, id, value, placeholder = '') {
  return `<label>${label}<input id="${id}" value="${escapeHtml(value)}" placeholder="${placeholder}" /></label>`;
}

function numberField(label, id, value) {
  const [min, max] = dataRepository.getYearRange();
  return `<label>${label}<input id="${id}" type="number" min="${min}" max="${max}" value="${value}" /></label>`;
}

function selectField(label, id, selected, options) {
  return `<label>${label}<select id="${id}">${options.map((option) => `<option ${option === selected ? 'selected' : ''}>${option}</option>`).join('')}</select></label>`;
}

function kpi(label, value, detail) {
  return `<article class="kpi panel"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

function update(nextState) {
  Object.assign(state, nextState);
  render();
}

function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

render();
