const $ = id => document.getElementById(id);

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function renderReport(data) {
  $('disclaimer').textContent = data.disclaimer || '';
  $('statBotTotal').textContent = data.totalBotRequests ?? 0;
  $('statProviders').textContent = data.providerCount ?? 0;

  if (data.windowHours) {
    $('windowLabel').textContent = `Last ${data.windowHours} hour${data.windowHours === 1 ? '' : 's'} · AI / crawler fetches`;
  }
  if (data.windowFrom) {
    $('windowRange').textContent = `${formatTime(data.windowFrom)} → ${formatTime(data.windowTo)}`;
  }

  const list = $('providerList');
  list.innerHTML = '';
  const providers = data.providers || [];

  if (!providers.length) {
    list.innerHTML =
      '<p class="table-meta">No AI/bot traffic in this window yet. Ask ChatGPT or Perplexity about your Render URL, then click Refresh now.</p>';
  }

  for (const p of providers) {
    const card = document.createElement('div');
    card.className = 'provider-card';
    card.innerHTML = `<h3>${p.provider}</h3><p class="provider-meta">${p.totalRequests} request(s) in window</p>`;

    for (const c of p.crawlers || []) {
      const block = document.createElement('div');
      block.style.marginBottom = '0.85rem';
      const paths = (c.topPaths || [])
        .map(t => `<li><code>${t.path}</code> — ${t.count}×</li>`)
        .join('');
      block.innerHTML = `
        <p><span class="badge badge-bot">${c.crawler}</span></p>
        <p class="provider-meta">${c.fetchType}</p>
        <p class="provider-meta">${c.requestCount} hits · ${c.uniquePaths} path(s) · ${c.uniqueIps} IP(s) · ${formatTime(c.firstSeen)} → ${formatTime(c.lastSeen)}</p>
        <ul class="path-list">${paths || '<li>No paths</li>'}</ul>
        <p class="provider-meta ua" style="margin-top:0.5rem">UA: ${c.sampleUserAgent}</p>
      `;
      card.appendChild(block);
    }
    list.appendChild(card);
  }

  const body = $('recentBody');
  body.innerHTML = '';
  for (const row of data.recentFetches || []) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatTime(row.timestamp)}</td>
      <td>${row.provider || '—'}</td>
      <td>${row.crawler || '—'}</td>
      <td class="ua">${row.fetchType || '—'}</td>
      <td><strong>${row.method}</strong> ${row.path}</td>
      <td>${row.status}</td>
    `;
    body.appendChild(tr);
  }
}

async function loadReport() {
  const res = await fetch('/api/ai-crawlers');
  const data = await res.json();
  renderReport(data);
  const pill = $('pollStatus');
  pill.textContent = `Updated ${formatTime(new Date().toISOString())}`;
  pill.className = 'pill pill-live';
}

$('btnRefresh').addEventListener('click', async () => {
  $('btnRefresh').disabled = true;
  await fetch('/api/refresh', { method: 'POST' });
  await loadReport();
  $('btnRefresh').disabled = false;
});

loadReport();
setInterval(loadReport, 15000);

const es = new EventSource('/api/events');
es.addEventListener('update', () => loadReport());
