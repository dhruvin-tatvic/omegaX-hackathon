function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function displayValue(value) {
  return value == null || value === '' ? 'Not in extract' : value;
}

function renderFields(id, rows, side) {
  const root = document.getElementById(id);
  root.innerHTML = rows
    .map((row) => {
      const value = side === 'ai' ? row.ai_value : row.human_value;
      const note = side === 'ai' ? row.ai_note : null;
      const mark = row.status === 'mismatch' || (side === 'ai' && row.status === 'ai_missing') ? ' is-gap' : '';
      return `<div class="spec-row${mark}">
        <dt>${escapeHtml(row.label)}</dt>
        <dd>${escapeHtml(displayValue(value))}${note ? `<small>${escapeHtml(note)}</small>` : ''}</dd>
      </div>`;
    })
    .join('');
}

async function loadCatalog() {
  const res = await fetch('/api/readability/catalog');
  return res.json();
}

async function loadCompare(slug) {
  const res = await fetch(`/api/readability/compare?slug=${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error('Could not load readability comparison');
  return res.json();
}

function render(data) {
  document.getElementById('productMeta').textContent = `${data.product} · ${data.path}`;
  document.getElementById('linkHuman').href = `/human-view?path=${encodeURIComponent(data.path)}`;
  document.getElementById('linkCompare').href = '/comparison';
  document.getElementById('diffSummary').textContent = data.summary.text;
  document.getElementById('aiNotes').textContent = (data.ai.notes || []).join(' ');
  document.getElementById('aiBadge').textContent = data.ai.available ? 'Fixture' : 'No fixture';
  renderFields('aiFields', data.rows, 'ai');
  renderFields('humanFields', data.rows, 'human');
}

async function boot() {
  const select = document.getElementById('pageSelect');
  const status = document.getElementById('readStatus');
  try {
    const catalog = await loadCatalog();
    const fixtureSlugs = new Set((catalog.fixture_slugs || []).filter(Boolean));
    const options = (catalog.products || []).filter((item) => fixtureSlugs.has(item.slug));
    const fallback = catalog.products || [];
    const list = options.length ? options : fallback;
    const params = new URLSearchParams(location.search);
    const current = params.get('slug') || list[0]?.slug;
    select.innerHTML = list
      .map((item) => `<option value="${escapeHtml(item.slug)}">${escapeHtml(item.name || item.slug)}</option>`)
      .join('');
    if (current) select.value = current;
    const data = await loadCompare(select.value);
    status.textContent = data.fixture_disclaimer;
    render(data);
    select.addEventListener('change', async () => {
      const next = select.value;
      history.replaceState({}, '', `/readability?slug=${encodeURIComponent(next)}`);
      render(await loadCompare(next));
    });
  } catch (error) {
    status.textContent = error.message || String(error);
  }
}

boot();
