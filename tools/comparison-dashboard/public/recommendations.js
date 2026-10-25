const API_BASE = window.TATVIC_COMPARE_API || '';
const $ = id => document.getElementById(id);

function apiUrl(path) {
  return `${API_BASE}${path}`;
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sevBadgeClass(sev) {
  if (sev === 'high') return 'sev-badge--high';
  if (sev === 'medium') return 'sev-badge--medium';
  return 'sev-badge--low';
}

function renderToolScores(scores) {
  const wrap = $('toolScores');
  wrap.innerHTML = '';
  const entries = Object.entries(scores || {});
  if (!entries.length) {
    wrap.innerHTML = '<p class="gap-empty" style="grid-column:1/-1">No tool scores for this run.</p>';
    return;
  }
  entries.sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
  for (const [tool, score] of entries) {
    const displayScore = Number.isFinite(Number(score)) ? Math.round(Number(score)) : 'n/a';
    const card = document.createElement('article');
    card.className = 'tool-score-card';
    card.innerHTML = `
      <p class="tool-score-card__name">${escapeHtml(tool)}</p>
      <p class="tool-score-card__value">${escapeHtml(displayScore)}<span style="font-size:0.9rem;font-weight:600;color:var(--text-muted)">/100</span></p>
    `;
    wrap.appendChild(card);
  }
}

async function loadRuns() {
  const res = await fetch(apiUrl('/api/runs'));
  const { runs } = await res.json();
  const sel = $('runSelect');
  sel.innerHTML = '';
  if (!runs.length) {
    sel.innerHTML = '<option value="">No runs yet</option>';
    return null;
  }
  for (const run of [...runs].reverse()) {
    const opt = document.createElement('option');
    opt.value = run.id;
    opt.textContent = `${formatTime(run.generated_at)} · avg ${run.stats?.average_score ?? 'n/a'}`;
    sel.appendChild(opt);
  }
  return runs[runs.length - 1].id;
}

async function loadRun(id) {
  if (!id) return;
  const res = await fetch(apiUrl(`/api/runs/${id}`));
  if (!res.ok) return;
  const run = await res.json();
  const gap = run.gap_analysis || {};

  $('runLabel').textContent = `Run ${formatTime(run.generated_at)} · Groq ${run.meta?.groq_model || 'n/a'} · facts ${formatTime(run.meta?.facts_scraped_at)}`;
  $('executiveSummary').textContent = gap.executive_summary || 'No summary for this run.';
  $('heroMeta').textContent = run.meta?.site_url
    ? `Target site: ${run.meta.site_url}`
    : '';

  renderToolScores(gap.overall_scores_by_tool);

  const themes = $('themes');
  themes.innerHTML = '';
  const themeList = (gap.themes || []).filter(
    t => t && typeof t === 'object' && String(t.theme || '').trim(),
  );
  if (!themeList.length) {
    themes.innerHTML = '<p class="gap-empty">No themes recorded.</p>';
  } else {
    for (const t of themeList) {
      const card = document.createElement('article');
      card.className = 'theme-card-v2';
      const tools = (t.affected_tools || [])
        .map(tool => `<span class="tool-chip">${escapeHtml(tool)}</span>`)
        .join('');
      card.innerHTML = `
        <div class="theme-card-v2__head">
          <h3 class="theme-card-v2__title">${escapeHtml(t.theme)}</h3>
          <span class="sev-badge ${sevBadgeClass(t.severity)}">${escapeHtml(t.severity || 'low')}</span>
        </div>
        <p class="theme-card-v2__body">${escapeHtml(t.description)}</p>
        <div class="theme-card-v2__tools">${tools}</div>
      `;
      themes.appendChild(card);
    }
  }

  const gaps = $('gaps');
  gaps.innerHTML = '';
  const gapList = gap.top_factual_gaps || [];
  if (!gapList.length) {
    gaps.innerHTML = '<p class="gap-empty">No factual gaps listed.</p>';
  } else {
    for (const g of gapList) {
      const card = document.createElement('article');
      card.className = 'gap-card';
      const blob = `${g.gap || ''} ${g.evidence || ''} ${g.recommendation || ''}`;
      const names = [
        'Storm 125',
        'Storm 200',
        'Thunderstrike 650 Rally',
        'Thunderstrike 650',
        'Thunderstrike 450',
        'Phantom 350',
        'Zenith 450 Scrambler',
      ].filter((name) => blob.includes(name));
      const links = window.BTA_APP && names.length
        ? `<p class="bta-related">${names
            .map((name) => {
              const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              return `<a href="/human-view?path=/motorcycles/${slug}">${escapeHtml(name)}</a> <a href="/readability?slug=${slug}">Readability</a>`;
            })
            .join(' ')}</p>`
        : '';
      card.innerHTML = `
        <h3 class="gap-card__title">${escapeHtml(g.gap)}</h3>
        <div class="gap-card__grid">
          <div class="gap-card__cell">
            <span class="gap-card__cell-label">Evidence</span>
            ${escapeHtml(g.evidence)}
            ${links}
          </div>
          <div class="gap-card__cell gap-card__cell--rec">
            <span class="gap-card__cell-label">Recommendation</span>
            ${escapeHtml(g.recommendation)}
          </div>
        </div>
      `;
      gaps.appendChild(card);
    }
  }

  const recs = $('recommendations');
  recs.innerHTML = '';
  const recList = gap.site_recommendations || [];
  if (!recList.length) {
    recs.innerHTML = '<p class="gap-empty">No recommendations for this run.</p>';
  } else {
    const sorted = [...recList].sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    for (const r of sorted) {
      const card = document.createElement('article');
      card.className = 'rec-card';
      card.innerHTML = `
        <div class="rec-card__priority" aria-hidden="true">${escapeHtml(r.priority)}</div>
        <div class="rec-card__body">
          <p class="rec-card__action">${escapeHtml(r.action)}</p>
          <p class="rec-card__rationale">${escapeHtml(r.rationale)}</p>
          <span class="impact-pill">Impact: ${escapeHtml(r.likely_impact)}</span>
        </div>
      `;
      recs.appendChild(card);
    }
  }

  $('crawlerNote').textContent = gap.crawler_and_llm_access || 'No crawler notes for this run.';
}

async function init() {
  const latestId = await loadRuns();
  const sel = $('runSelect');
  if (latestId) {
    sel.value = latestId;
    await loadRun(latestId);
  }
  sel.addEventListener('change', () => loadRun(sel.value));
}

init();
