const $ = id => document.getElementById(id);

let currentFilter = 'all';

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

function renderWindow(stats, meta) {
  const hours = stats.windowHours ?? 24;
  const label = $('windowLabel');
  if (label) label.textContent = `Last ${hours} hour${hours === 1 ? '' : 's'}`;

  const range = $('windowRange');
  if (range && stats.windowFrom) {
    range.textContent = `${formatTime(stats.windowFrom)} → ${formatTime(stats.windowTo || new Date().toISOString())}`;
  }

  const tableMeta = $('tableMeta');
  if (tableMeta) {
    const pages = meta?.pagesFetched ? ` · ${meta.pagesFetched} Render API page(s)` : '';
    const raw = meta?.rawLines != null ? ` · ${meta.rawLines} log lines scanned` : '';
    tableMeta.textContent = `Counts and table use HTTP access lines in the rolling window above.${pages}${raw}`;
  }
}

function renderStats(stats) {
  const total = stats.total || 0;
  $('statTotal').textContent = total;
  $('statHuman').textContent = stats.human ?? 0;
  $('statBot').textContent = stats.bot ?? 0;
  $('statUnknown').textContent = stats.unknown ?? 0;
  $('pctHuman').textContent = pct(stats.human, total);
  $('pctBot').textContent = pct(stats.bot, total);
  $('pctUnknown').textContent = pct(stats.unknown, total);

  const ul = $('botBreakdown');
  ul.innerHTML = '';
  const breakdown = stats.botBreakdown || {};
  const keys = Object.keys(breakdown).sort((a, b) => breakdown[b] - breakdown[a]);
  if (!keys.length) {
    ul.innerHTML = '<li>No bot traffic yet</li>';
    return;
  }
  for (const key of keys) {
    const li = document.createElement('li');
    li.textContent = `${key}: ${breakdown[key]}`;
    ul.appendChild(li);
  }
}

function badgeClass(kind) {
  if (kind === 'human') return 'badge-human';
  if (kind === 'bot') return 'badge-bot';
  return 'badge-unknown';
}

function badgeLabel(row) {
  if (row.kind === 'bot' && row.botLabel) return `bot · ${row.botLabel}`;
  return row.kind;
}

function renderTable(entries) {
  const body = $('logBody');
  body.innerHTML = '';
  for (const row of entries) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatTime(row.timestamp)}</td>
      <td><span class="badge ${badgeClass(row.kind)}">${badgeLabel(row)}</span></td>
      <td>${row.ip}</td>
      <td><strong>${row.method}</strong> ${row.path}</td>
      <td>${row.status}</td>
      <td class="ua">${row.userAgent}</td>
    `;
    body.appendChild(tr);
  }
}

async function loadLogs() {
  const res = await fetch(`/api/logs?filter=${currentFilter}&limit=500`);
  const data = await res.json();
  renderStats(data.stats);
  renderWindow(data.stats);
  renderTable(data.entries);
}

async function loadStatus() {
  const res = await fetch('/api/status');
  const data = await res.json();
  const pill = $('pollStatus');
  const banner = $('configBanner');

  if (!data.configured) {
    pill.textContent = 'Not configured';
    pill.className = 'status-chip status-chip-error';
    banner.classList.remove('hidden');
    banner.textContent =
      'Add RENDER_API_KEY and RENDER_SERVICE_ID to tools/traffic-dashboard/.env (see .env.example), then restart the dashboard.';
    return;
  }

  banner.classList.add('hidden');
  if (data.lastPollError) {
    pill.textContent = `Error: ${data.lastPollError}`;
    pill.className = 'status-chip status-chip-error';
  } else {
    pill.textContent = data.lastPollAt
      ? `Live · updated ${formatTime(data.lastPollAt)}`
      : 'Polling Render…';
    pill.className = 'status-chip status-chip-ok';
  }
  renderStats(data.stats);
  renderWindow(data.stats, data.lastFetch);
}

function connectSSE() {
  const es = new EventSource('/api/events');
  es.addEventListener('hello', e => {
    const data = JSON.parse(e.data);
    renderStats(data.stats);
    renderWindow(data.stats);
    loadLogs();
  });
  es.addEventListener('update', () => {
    loadStatus();
    loadLogs();
  });
  es.addEventListener('error', e => {
    try {
      const data = JSON.parse(e.data);
      $('pollStatus').textContent = data.message;
      $('pollStatus').className = 'status-chip status-chip-error';
    } catch {
      /* heartbeat */
    }
  });
  es.onerror = () => {
    $('pollStatus').textContent = 'Reconnecting…';
    $('pollStatus').className = 'status-chip';
  };
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    loadLogs();
  });
});

$('btnRefresh').addEventListener('click', async () => {
  $('btnRefresh').disabled = true;
  $('btnRefresh').textContent = 'Loading 24h…';
  await fetch('/api/refresh', { method: 'POST' });
  await loadStatus();
  await loadLogs();
  $('btnRefresh').disabled = false;
  $('btnRefresh').textContent = 'Refresh now';
});

loadStatus();
loadLogs();
connectSSE();
setInterval(loadStatus, 15000);
