const $ = id => document.getElementById(id);

let allRows = [];
let currentFilter = 'all';
let runId = 'latest';

function pct(part, total) {
  if (!total) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function verdictBadge(verdict) {
  const v = (verdict || '').toLowerCase();
  if (v === 'correct') return ['badge-correct', 'correct'];
  if (v === 'partially_correct') return ['badge-partial', 'partial'];
  if (v === 'incorrect') return ['badge-incorrect', 'incorrect'];
  return ['badge-refusal', v || 'unknown'];
}

function matchesFilter(row) {
  if (currentFilter === 'all') return true;
  if (['correct', 'partially_correct', 'incorrect', 'refusal_or_unknown'].includes(currentFilter)) {
    return row.verdict === currentFilter;
  }
  return row.ai_tool === currentFilter;
}

function renderStats(stats, runs) {
  const total = stats.evaluation_count || 0;
  const byV = stats.by_verdict || {};
  const correct = byV.correct || 0;
  const partial = (byV.partially_correct || 0) + (byV.refusal_or_unknown || 0);
  const wrong = byV.incorrect || 0;

  $('statTotal').textContent = total;
  $('statRuns').textContent = `${runs.length} run${runs.length === 1 ? '' : 's'} in history`;
  $('statAvg').textContent = stats.average_score ?? 0;
  $('statCorrect').textContent = correct;
  $('pctCorrect').textContent = pct(correct, total);
  $('statPartial').textContent = partial;
  $('pctPartial').textContent = pct(partial, total);
  $('statWrong').textContent = wrong;
  $('pctWrong').textContent = pct(wrong, total);

  const ul = $('toolBreakdown');
  ul.innerHTML = '';
  const tools = stats.by_tool || {};
  const keys = Object.keys(tools).sort();
  if (!keys.length) {
    ul.innerHTML = '<li>No evaluations yet. Run <code>node scripts/llm-facts-compare/run.mjs</code></li>';
    return;
  }
  for (const key of keys) {
    const li = document.createElement('li');
    li.textContent = `${key}: avg ${tools[key].avg_score} (${tools[key].count})`;
    ul.appendChild(li);
  }
}

function renderTable(rows) {
  const body = $('logBody');
  body.innerHTML = '';
  const filtered = rows.filter(matchesFilter);
  $('tableMeta').textContent = `Showing ${filtered.length} row(s) · filter: ${currentFilter} · scope: ${runId}`;

  for (const row of filtered) {
    const [cls, label] = verdictBadge(row.verdict);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatTime(row.run_at)}</td>
      <td>${row.ai_tool}</td>
      <td><span class="badge ${cls}">${label}</span></td>
      <td><span class="score-pill">${row.score ?? 'n/a'}</span></td>
      <td class="cell-question">${escapeHtml(short(row.input, 120))}</td>
      <td class="cell-muted">${escapeHtml(short(row.primary_gap || 'n/a', 100))}</td>
      <td class="cell-muted">${escapeHtml(row.summary || '')}</td>
    `;
    body.appendChild(tr);
  }
}

function short(s, n) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function populateRunSelect(runs) {
  const sel = $('runSelect');
  const current = sel.value;
  sel.innerHTML = `
    <option value="latest">Latest run</option>
    <option value="all">All runs (history)</option>
  `;
  for (const run of runs) {
    const opt = document.createElement('option');
    opt.value = run.id;
    opt.textContent = `${formatTime(run.generated_at)} · avg ${run.stats?.average_score ?? 'n/a'}`;
    sel.appendChild(opt);
  }
  if ([...sel.options].some(o => o.value === current)) sel.value = current;
}

async function loadOverview() {
  $('pollStatus').textContent = 'Loading…';
  $('pollStatus').className = 'pill pill-muted';
  const res = await fetch(`/api/overview?runId=${encodeURIComponent(runId)}`);
  const data = await res.json();
  allRows = data.rows || [];
  populateRunSelect(data.runs || []);
  renderStats(data.stats, data.runs || []);

  const range = $('windowRange');
  if (runId === 'all') {
    range.textContent = data.stats.latest_run_at
      ? `Historical view · latest run ${formatTime(data.stats.latest_run_at)}`
      : 'No comparison runs yet';
  } else if (runId === 'latest' && data.stats.latest_run_at) {
    range.textContent = `Latest run · ${formatTime(data.stats.latest_run_at)}`;
  } else {
    const run = (data.runs || []).find(r => r.id === runId);
    range.textContent = run ? `Run · ${formatTime(run.generated_at)}` : '';
  }

  renderTable(allRows);
  $('pollStatus').textContent = `Updated ${formatTime(new Date().toISOString())}`;
  $('pollStatus').className = 'pill pill-live';
}

$('runSelect')?.addEventListener('change', e => {
  runId = e.target.value;
  loadOverview().catch(showError);
});

$('btnRefresh')?.addEventListener('click', async () => {
  $('btnRefresh').disabled = true;
  try {
    await fetch('/api/import-latest', { method: 'POST' });
    await loadOverview();
  } catch (e) {
    showError(e);
  } finally {
    $('btnRefresh').disabled = false;
  }
});

document.querySelectorAll('#filterTabs .tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#filterTabs .tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderTable(allRows);
  });
});

function showError(err) {
  $('pollStatus').textContent = err.message || String(err);
  $('pollStatus').className = 'pill pill-muted';
}

loadOverview().catch(showError);
