function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function renderSummary(runs) {
  const intro = document.getElementById('runsIntro');
  const summary = document.getElementById('runsSummary');
  if (!runs.length) {
    intro.textContent = 'No comparison runs stored yet. Run the compare script or import a report from the overview page.';
    summary.innerHTML = '';
    return;
  }
  const latest = runs[runs.length - 1];
  const avgScores = runs.map(r => r.stats?.average_score).filter(x => x != null);
  const histAvg = avgScores.length
    ? Math.round(avgScores.reduce((a, b) => a + b, 0) / avgScores.length)
    : 0;
  intro.textContent = `${runs.length} run${runs.length === 1 ? '' : 's'} saved. Latest batch: ${formatTime(latest.generated_at)} with average score ${latest.stats?.average_score ?? 'n/a'}.`;
  summary.innerHTML = `
    <article class="card card-total">
      <h2>Total runs</h2>
      <p class="metric">${runs.length}</p>
    </article>
    <article class="card card-score">
      <h2>Latest avg score</h2>
      <p class="metric">${latest.stats?.average_score ?? 'n/a'}</p>
    </article>
    <article class="card card-correct">
      <h2>History avg score</h2>
      <p class="metric">${histAvg || 'n/a'}</p>
    </article>
    <article class="card card-partial">
      <h2>Latest evaluations</h2>
      <p class="metric">${latest.stats?.row_count ?? 'n/a'}</p>
    </article>
  `;
}

async function load() {
  const res = await fetch('/api/runs');
  const { runs } = await res.json();
  renderSummary(runs);
  const body = document.getElementById('runsBody');
  body.innerHTML = '';
  if (!runs.length) {
    body.innerHTML = '<tr><td colspan="8">No runs yet. Run <code>node scripts/llm-facts-compare/run.mjs</code></td></tr>';
    return;
  }
  for (const run of [...runs].reverse()) {
    const v = run.stats?.by_verdict || {};
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${formatTime(run.generated_at)}</td>
      <td>${run.stats?.row_count ?? 'n/a'}</td>
      <td><span class="score-pill">${run.stats?.average_score ?? 'n/a'}</span></td>
      <td>${v.correct ?? 0}</td>
      <td>${(v.partially_correct ?? 0) + (v.refusal_or_unknown ?? 0)}</td>
      <td>${v.incorrect ?? 0}</td>
      <td class="cell-muted">${run.facts_scraped_at ? formatTime(run.facts_scraped_at) : 'n/a'}</td>
      <td>${run.groq_model || 'n/a'}</td>
    `;
    body.appendChild(tr);
  }
}

load();
