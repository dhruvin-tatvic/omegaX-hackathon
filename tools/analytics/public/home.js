function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function kpi(label, value, note) {
  return `<article class="kpi-card">
    <p class="kpi-label">${escapeHtml(label)}</p>
    <p class="kpi-value">${escapeHtml(value ?? 'n/a')}</p>
    <p class="pct table-meta">${escapeHtml(note || '')}</p>
  </article>`;
}

async function boot() {
  const status = document.getElementById('homeStatus');
  try {
    const res = await fetch('/api/home');
    const data = await res.json();
    const t = data.traffic || {};
    const c = data.crawl || {};
    const e = data.evaluation || {};
    const ts = t.stats || {};

    document.getElementById('homeKpis').innerHTML = [
      kpi(
        'Traffic requests',
        t.available ? ts.total : 'n/a',
        t.available ? `${ts.bot ?? 0} bot / ${ts.human ?? 0} human · ${t.last_poll_at_ist || 'time n/a'}` : t.period_note,
      ),
      kpi(
        'Pages captured',
        c.available ? c.captured : 'n/a',
        c.available ? `${c.product_pages} product pages · finished ${c.finished_at_ist || 'n/a'}` : 'Human View report not found',
      ),
      kpi(
        'Latest LLM score',
        e.available ? e.average_score : 'n/a',
        e.available ? `${e.evaluation_count} evaluations · ${e.generated_at_ist || 'n/a'}` : 'Comparison report not found',
      ),
      kpi(
        'Incorrect answers',
        e.available ? (e.by_verdict?.incorrect ?? 0) : 'n/a',
        e.period_note || '',
      ),
    ].join('');

    document.getElementById('findingsMeta').textContent = e.available
      ? `From the latest comparison generated ${e.generated_at_ist}. Not mixed with the live traffic window.`
      : 'No comparison findings available.';

    const findings = document.getElementById('findings');
    const items = e.findings || [];
    findings.innerHTML = items.length
      ? items
          .map((item) => {
            const slugMatch = `${item.gap || ''} ${item.evidence || ''}`.match(
              /(Storm 125|Storm 200|Thunderstrike 650 Rally|Thunderstrike 650|Thunderstrike 450|Phantom 350|Zenith 450 Scrambler)/i,
            );
            const name = slugMatch ? slugMatch[1] : '';
            const slug = name
              .toLowerCase()
              .replace(/scrambler/g, 'scrambler')
              .replace(/\s+/g, '-')
              .replace(/[^a-z0-9-]/g, '');
            const evidenceLink = slug
              ? `<a href="/human-view?path=/motorcycles/${slug}">Human View</a> · <a href="/readability?slug=${slug}">Readability</a>`
              : `<a href="/comparison/recommendations">Open recommendations</a>`;
            return `<li>
              <strong>${escapeHtml(item.gap)}</strong>
              <span>${escapeHtml(item.evidence || '')}</span>
              <span class="finding-links">${evidenceLink}</span>
            </li>`;
          })
          .join('')
      : '<li>No gap list in the latest report.</li>';

    status.textContent = `${data.product.site_name} · ${data.product.site_url}`;
  } catch (error) {
    status.textContent = error.message || String(error);
  }
}

boot();
