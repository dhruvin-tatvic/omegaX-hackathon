import { useEffect, useState } from 'react';
import { CLASSIFICATION_COLUMNS, classificationRow } from '../src/traffic/table.js';

const DEFAULT_URL = 'https://omegax-hackathon.onrender.com/';

const CATEGORY_LABEL = {
  correct: 'Correct',
  partially_correct: 'Partially correct',
  incorrect: 'Incorrect',
  unsupported: 'Unsupported / unverified',
  inconclusive: 'Inconclusive',
  insufficient_evidence: 'Insufficient evidence',
};

async function api(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const THEME_KEY = 'tatvic-checker-theme';

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export default function App() {
  const [theme, setTheme] = useState(readTheme);
  const [config, setConfig] = useState(null);
  const [targetUrl, setTargetUrl] = useState(DEFAULT_URL);
  const [session, setSession] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [questionText, setQuestionText] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [run, setRun] = useState(null);
  const [history, setHistory] = useState([]);
  const [readability, setReadability] = useState(null);
  const [trafficText, setTrafficText] = useState('');
  const [traffic, setTraffic] = useState(null);
  const [ga4, setGa4] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [applyDemo, setApplyDemo] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [monitoring, setMonitoring] = useState(null);
  const [planWeeks, setPlanWeeks] = useState(6);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore quota / private mode */
    }
  }, [theme]);

  useEffect(() => {
    Promise.all([api('/api/config'), api('/api/runs'), api('/api/traffic/ga4'), api('/api/apply-demo')])
      .then(([cfg, runs, ga4State, demo]) => {
        setConfig(cfg);
        setTargetUrl(cfg.target?.default_url || DEFAULT_URL);
        setHistory(runs);
        setGa4(ga4State);
        setApplyDemo(demo);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function crawl() {
    setBusy('crawl');
    setError('');
    setRun(null);
    setReadability(null);
    setSession(null);
    try {
      const result = await api('/api/crawl', {
        method: 'POST',
        body: JSON.stringify({ url: targetUrl }),
      });
      setSession(result.session);
      setSuggestions(result.suggestions || []);
      if (result.suggestions?.[0] && !questionText) setQuestionText(result.suggestions[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function submit(method) {
    setBusy('eval');
    setError('');
    try {
      const result = await api('/api/evaluate', {
        method: 'POST',
        body: JSON.stringify({
          url: targetUrl,
          questionText,
          method,
          answerText,
        }),
      });
      setRun(result);
      setHistory((prev) => [result, ...prev.filter((row) => row.id !== result.id)]);
      await refreshRecommendations({
        readability,
        traffic,
        run: result,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function runReadability() {
    setBusy('readability');
    setError('');
    setReadability(null);
    try {
      const result = await api('/api/readability', {
        method: 'POST',
        body: JSON.stringify({ url: targetUrl }),
      });
      setReadability(result);
      if (result.session) {
        setSession(result.session);
        setSuggestions([]);
      }
      await refreshRecommendations({ readability: result, traffic, run });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function loadTrafficDemo() {
    setBusy('traffic');
    setError('');
    try {
      const result = await api('/api/traffic/demo');
      setTraffic(result);
      setGa4(result.ga4 || ga4);
      setTrafficText('SYNTHETIC DEMO DATA loaded from checker/data/traffic/synthetic-demo.jsonl');
      await refreshRecommendations({ readability, traffic: result, run });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function analyzeTrafficLogs() {
    setBusy('traffic');
    setError('');
    try {
      const result = await api('/api/traffic/analyze', {
        method: 'POST',
        body: JSON.stringify({ text: trafficText, format: 'auto' }),
      });
      setTraffic(result);
      setGa4(result.ga4 || ga4);
      await refreshRecommendations({ readability, traffic: result, run });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function demoAction(id, action) {
    setBusy(`demo-${action}`);
    setError('');
    try {
      const result = await api(`/api/apply-demo/${id}/${action}`, { method: 'POST', body: '{}' });
      setApplyDemo(result);
    } catch (err) {
      setError(err.message);
      try {
        setApplyDemo(await api('/api/apply-demo'));
      } catch {
        /* keep previous demo state */
      }
    } finally {
      setBusy('');
    }
  }

  async function buildScorecard() {
    setBusy('scorecard');
    setError('');
    try {
      const result = await api('/api/scorecard', {
        method: 'POST',
        body: JSON.stringify({
          session,
          runs: history,
        }),
      });
      setScorecard(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function buildPlan(weeks = planWeeks) {
    setBusy('plan');
    setError('');
    try {
      const result = await api('/api/monitoring-plan', {
        method: 'POST',
        body: JSON.stringify({ weeks }),
      });
      setMonitoring(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  function downloadScorecardJson() {
    if (!scorecard) return;
    const blob = new Blob([JSON.stringify(scorecard, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = 'apex-question-set-scorecard.json';
    link.click();
    URL.revokeObjectURL(href);
  }

  async function refreshRecommendations({ readability: nextReadability, traffic: nextTraffic, run: nextRun } = {}) {
    const payload = {
      readability: nextReadability !== undefined ? nextReadability : readability,
      traffic: nextTraffic !== undefined ? nextTraffic : traffic,
      accuracy_runs: (nextRun !== undefined ? nextRun : run) ? [nextRun !== undefined ? nextRun : run] : [],
    };
    try {
      const result = await api('/api/recommendations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setRecommendations(result);
    } catch (err) {
      setError(err.message);
    }
  }

  const coverage = run?.evaluation?.evidence_coverage;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <a className="brand" href="#top" aria-label="Tatvic AI Answer Testing">
            <img className="logo logo-dark" src="/assets/tatvic-dark-logo.svg" alt="Tatvic" width="120" height="34" />
            <img className="logo logo-light" src="/assets/tatvic-light-logo.svg" alt="Tatvic" width="120" height="34" />
            <span className="brand-divider" aria-hidden="true" />
            <span className="product-name">Answer Testing</span>
          </a>
          <nav className="header-nav" aria-label="Application sections">
            <a href="#recs-heading">Recommendations</a>
            <a href="#scorecard-heading">Scorecard</a>
            <a href="#plan-heading">Monitoring</a>
            <a href="#apply-demo-heading">Apply demo</a>
          </nav>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </header>
    <div className="page" id="top">
      <p className="kicker">AI Answer Testing</p>
      <h1>Evaluate an answer against a live website</h1>
      <p className="lede">
        Enter any public website, crawl what is in the HTML, ask a question, then paste an AI
        answer. Scoring uses only evidence from that site. Extracted text is labelled as
        website-sourced evidence, not independently verified truth.
      </p>

      {config && (
        <div className="meta-row">
          <div className="meta">
            <span>API provider</span>
            {config.openai.configured ? `Ready · ${config.openai.model}` : 'Not configured · paste answers'}
          </div>
          <div className="meta">
            <span>Crawl cap</span>
            {config.crawl?.maxPages || 24} pages
          </div>
          <div className="meta">
            <span>Current origin</span>
            {session?.origin || 'Not crawled yet'}
          </div>
        </div>
      )}

      <ol className="steps">
        <li>Enter the target URL</li>
        <li>Crawl the website</li>
        <li>Review evidence</li>
        <li>Ask a question and evaluate an answer</li>
        <li>Optionally run the Readability Test</li>
        <li>Optionally inspect AI Traffic Lens from access logs</li>
        <li>Review ranked, evidence-backed recommendations</li>
        <li>Review the Apex question-set scorecard and 4–8 week monitoring plan</li>
        <li>Optionally apply, retest, and roll back isolated demo fixtures</li>
      </ol>

      <div className="layout">
        <section className="panel">
          <label>
            <span className="label">Target website URL</span>
            <input
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder={DEFAULT_URL}
              inputMode="url"
            />
          </label>
          <div className="actions">
            <button type="button" disabled={Boolean(busy)} onClick={crawl}>
              {busy === 'crawl' ? 'Crawling…' : 'Crawl website'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={Boolean(busy)}
              onClick={runReadability}
            >
              {busy === 'readability' ? 'Running readability…' : 'Run Readability Test'}
            </button>
          </div>
          <label>
            <span className="label">Question about this website</span>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Ask anything the public pages might answer."
            />
          </label>
          {suggestions.length > 0 && (
            <div className="suggestions">
              <span className="label">Suggested from this crawl</span>
              {suggestions.map((item) => (
                <button key={item} type="button" className="chip" onClick={() => setQuestionText(item)}>
                  {item}
                </button>
              ))}
            </div>
          )}
          <label>
            <span className="label">Pasted AI answer</span>
            <textarea
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Paste the original answer. It is stored unchanged."
            />
          </label>
          <div className="actions">
            <button type="button" disabled={Boolean(busy) || !session} onClick={() => submit('manual')}>
              {busy === 'eval' ? 'Evaluating…' : 'Evaluate answer'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={Boolean(busy) || !session || !config?.openai.configured}
              onClick={() => submit('api')}
            >
              Ask API model
            </button>
          </div>
          {error && <p className="error">{error}</p>}
          {!session && !error && (
            <p className="note">Crawl the selected URL before evaluating. Facts from other sites are not reused.</p>
          )}
        </section>

        <section className="panel">
          {!session && <p className="note">No crawl yet. Evidence will appear here after a successful fetch.</p>}
          {session && (
            <>
              <p>
                <strong>Website-sourced evidence</strong> · crawled {session.crawled_at}
              </p>
              <p className="note">{session.note}</p>
              <p>
                Pages visited: {session.pages_visited.length}
                {' · '}Failed: {session.pages_failed.length}
                {' · '}Evidence items: {session.evidence_count}
                {session.truncated ? ' · Partial crawl (limit reached)' : ''}
              </p>
              {session.js_likely_urls?.length > 0 && (
                <p className="note">
                  Heuristic: possible JavaScript-rendered pages (not proof of JS-only content):{' '}
                  {session.js_likely_urls.join(', ')}
                </p>
              )}
              {session.robots_blocked?.length > 0 && (
                <p className="note">
                  robots.txt blocked: {session.robots_blocked.join(', ')}
                </p>
              )}
              {session.conflicts?.length > 0 && (
                <>
                  <h2>Conflicting facts</h2>
                  <table>
                    <thead>
                      <tr>
                        <th>Values</th>
                        <th>URLs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.conflicts.map((row) => (
                        <tr key={(row.urls || []).join('|')}>
                          <td>{(row.values || []).join(' vs ')}</td>
                          <td>
                            {(row.urls || []).map((href) => (
                              <div key={href}>
                                <a href={href} target="_blank" rel="noreferrer">
                                  {href}
                                </a>
                              </div>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {session.pages_failed?.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Failed URL</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.pages_failed.map((row) => (
                      <tr key={row.url}>
                        <td>{row.url}</td>
                        <td>{row.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <h2>Extracted facts</h2>
              <table>
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>Text</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {session.facts.slice(0, 25).map((fact) => (
                    <tr key={fact.id}>
                      <td>{fact.kind}</td>
                      <td>{fact.text}</td>
                      <td>
                        <a href={fact.url} target="_blank" rel="noreferrer">
                          {fact.url}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>

      {readability && (
        <section className="panel result" aria-labelledby="readability-heading">
          <p className="kicker">Readability Test</p>
          <h2 id="readability-heading">Website readability findings</h2>
          <p className="note">
            Compared raw HTTP HTML with an optional local Chrome render for {readability.url}. Render:{' '}
            {readability.notes?.render || 'unknown'}. These findings are not a score of AI-answer accuracy.
          </p>
          {readability.comparisons?.length > 0 && (
            <>
              <h2>Raw HTML vs browser-rendered text</h2>
              {readability.comparisons.map((row) => (
                <div key={row.url} className="compare">
                  <p>
                    <a href={row.url} target="_blank" rel="noreferrer">
                      {row.url}
                    </a>
                  </p>
                  <div className="compare-grid">
                    <div>
                      <span className="label">Raw HTTP text</span>
                      <pre className="raw">{row.raw_text || '(empty)'}</pre>
                    </div>
                    <div>
                      <span className="label">Browser-rendered text</span>
                      <pre className="raw">{row.rendered_text || '(empty)'}</pre>
                    </div>
                  </div>
                  {row.rendered_only?.length > 0 && (
                    <p className="note">
                      Text seen after rendering, not in raw HTML:{' '}
                      {row.rendered_only.join(' · ')}
                    </p>
                  )}
                </div>
              ))}
            </>
          )}
          <h2>Findings</h2>
          {readability.findings?.length === 0 && (
            <p className="note">No readability findings were emitted for the checks that ran.</p>
          )}
          {readability.findings?.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>URL</th>
                  <th>Evidence</th>
                  <th>Limitations</th>
                </tr>
              </thead>
              <tbody>
                {readability.findings.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={`badge ${item.severity}`}>{item.category}</span>
                      <div className="note">{item.explanation}</div>
                    </td>
                    <td>{item.severity}</td>
                    <td>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.url}
                      </a>
                      {(item.related_urls || []).map((href) => (
                        <div key={href}>
                          <a href={href} target="_blank" rel="noreferrer">
                            {href}
                          </a>
                        </div>
                      ))}
                      {(item.values || []).length > 0 && (
                        <div className="note">Values: {item.values.join(' vs ')}</div>
                      )}
                    </td>
                    <td>
                      {(item.evidence || []).map((ev) => (
                        <div key={`${ev.url}-${ev.text}`}>
                          <div className="note">{ev.kind}</div>
                          {ev.text}
                        </div>
                      ))}
                    </td>
                    <td>
                      <ul className="limitations">
                        {(item.limitations || []).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h2>Limitations</h2>
          <ul className="limitations">
            {(readability.limitations || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {run && (
        <section className="panel result">
          <p>
            <span className={`badge ${run.evaluation.overall_category}`}>
              {CATEGORY_LABEL[run.evaluation.overall_category] || run.evaluation.overall_category}
            </span>
            {' · '}
            {run.method}
            {run.model ? ` · ${run.model}` : ''}
            {' · '}
            {run.target_url}
          </p>
          {coverage && (
            <p className="note">
              Evidence coverage: {coverage.relevant_items} relevant items from {coverage.pages_visited}{' '}
              pages (failed {coverage.pages_failed}). Crawl {coverage.crawled_at}.
            </p>
          )}
          <h2>Original answer</h2>
          <pre className="raw">{run.answer.raw_text || run.answer.error || '(empty)'}</pre>
          <h2>Evaluation</h2>
          <p>{run.evaluation.explanation}</p>
          <table>
            <thead>
              <tr>
                <th>Claim</th>
                <th>Result</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {(run.evaluation.claim_results || []).map((claim) => (
                <tr key={claim.fact_id}>
                  <td>{claim.claim || claim.key}</td>
                  <td>
                    {claim.status}
                    <div className="note">{claim.detail}</div>
                  </td>
                  <td>
                    {(claim.sources || []).map((src) => (
                      <div key={src.url + src.text}>
                        <a href={src.url} target="_blank" rel="noreferrer">
                          {src.url}
                        </a>
                        <div className="note">{src.text}</div>
                      </div>
                    ))}
                    {!(claim.sources || []).length && '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {run.evaluation.recommendations?.length > 0 && (
            <>
              <h2>Recommendations</h2>
              <ul>
                {run.evaluation.recommendations.map((rec) => (
                  <li key={rec.title}>
                    <strong>{rec.title}</strong> ({rec.basis}) — {rec.suggestion} {rec.caveat}
                  </li>
                ))}
              </ul>
            </>
          )}
          <h2>Limitations</h2>
          <ul className="limitations">
            {(run.evaluation.limitations || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel result" aria-labelledby="traffic-heading">
        <p className="kicker">AI Traffic Lens</p>
        <h2 id="traffic-heading">Access-log crawler report</h2>
        <p className="note">
          Import server/CDN access logs as JSON Lines or CSV (
          <code>ts,ip,method,path,status,bytes,user_agent,referer</code>
          ). Classification uses user-agent families plus request behavior. A crawler hit is not proof
          that an AI system used or cited the page.
        </p>
        <label>
          <span className="label">Access log (JSONL or CSV)</span>
          <textarea
            value={trafficText}
            onChange={(e) => setTrafficText(e.target.value)}
            placeholder='{"ts":"2026-10-24T12:00:00Z","ip":"203.0.113.10","method":"GET","path":"/","status":200,"user_agent":"..."}'
          />
        </label>
        <div className="actions">
          <button type="button" disabled={Boolean(busy)} onClick={loadTrafficDemo}>
            {busy === 'traffic' ? 'Analyzing…' : 'Load synthetic demo'}
          </button>
          <button
            type="button"
            className="secondary"
            disabled={Boolean(busy) || !trafficText.trim()}
            onClick={analyzeTrafficLogs}
          >
            Analyze pasted logs
          </button>
        </div>
        <p className="note">
          GA4: {ga4?.status || 'not_connected'}
          {ga4?.synthetic ? ' · SYNTHETIC DEMO DATA' : ''}
          {' — '}
          {ga4?.message || 'Not connected. Import an export later via POST /api/traffic/ga4.'}
        </p>
        {traffic && (
          <>
            {traffic.source?.synthetic && (
              <p className="banner-synthetic">
                {traffic.source.label || 'SYNTHETIC DEMO DATA'} — these log rows are demo fixtures, not
                observed production traffic.
              </p>
            )}
            <p>
              Observed requests: {traffic.observed?.request_count || 0}
              {' · '}Distinct URLs: {traffic.observed?.distinct_urls || 0}
              {' · '}Rejected rows: {traffic.observed?.rejected_rows?.length || 0}
              {traffic.observed?.time_range?.start
                ? ` · ${traffic.observed.time_range.start} to ${traffic.observed.time_range.end}`
                : ''}
            </p>
            <p className="note">{traffic.inferences?.note}</p>
            <h2>Status codes</h2>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(traffic.observed?.status_codes || {}).map(([code, count]) => (
                  <tr key={code}>
                    <td>{code}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h2>Crawler classifications (inferences)</h2>
            <div className="table-wrap">
              <table className="classifications">
                <thead>
                  <tr>
                    {CLASSIFICATION_COLUMNS.map((heading) => (
                      <th key={heading}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(traffic.inferences?.agents || []).map((agent) => {
                    const row = classificationRow(agent);
                    return (
                      <tr key={`${row.client_ip}-${row.user_agent}`}>
                        <td>
                          <span className={`badge ${row.classification}`}>{row.classification}</span>
                        </td>
                        <td className="cell-ip">{row.client_ip}</td>
                        <td className="cell-wrap">{row.user_agent}</td>
                        <td>{row.confidence}</td>
                        <td className="cell-wrap">
                          {row.evidence.length ? (
                            <ul className="evidence-list">
                              {row.evidence.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>{row.requests}</td>
                        <td>{row.distinct_urls}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <h2>Top requested pages</h2>
            <table>
              <thead>
                <tr>
                  <th>Path</th>
                  <th>Count</th>
                  <th>Statuses</th>
                </tr>
              </thead>
              <tbody>
                {(traffic.observed?.top_pages || []).map((page) => (
                  <tr key={page.path}>
                    <td>{page.path}</td>
                    <td>{page.count}</td>
                    <td>
                      {Object.entries(page.statuses || {})
                        .map(([code, count]) => `${code}:${count}`)
                        .join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {traffic.observed?.blocked_or_error_pages?.length > 0 && (
              <>
                <h2>Blocked and error pages</h2>
                <table>
                  <thead>
                    <tr>
                      <th>Path</th>
                      <th>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traffic.observed.blocked_or_error_pages.map((page) => (
                      <tr key={page.path}>
                        <td>{page.path}</td>
                        <td>
                          {(page.errors || [])
                            .map((row) => `${row.status}×${row.count}`)
                            .join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <h2>Limitations</h2>
            <ul className="limitations">
              {(traffic.limitations || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel result" aria-labelledby="recs-heading">
        <p className="kicker">Ranked recommendations</p>
        <h2 id="recs-heading">Evidence-backed fixes</h2>
        <p className="note">
          These items are generated from tests that already ran. Benefits are estimates. Nothing here
          has been applied to the website.
        </p>
        <div className="actions">
          <button type="button" className="secondary" disabled={Boolean(busy)} onClick={() => refreshRecommendations()}>
            Refresh recommendations
          </button>
        </div>
        {!recommendations && (
          <p className="note">Run a readability, accuracy, or traffic test to generate recommendations.</p>
        )}
        {recommendations && (
          <>
            <p className="note">
              Sources used: readability {recommendations.sources?.readability ? 'yes' : 'no'} · accuracy{' '}
              {recommendations.sources?.accuracy ? 'yes' : 'no'} · traffic{' '}
              {recommendations.sources?.traffic ? 'yes' : 'no'}
              {recommendations.sources?.traffic_synthetic ? ' (SYNTHETIC DEMO DATA)' : ''}
            </p>
            {(recommendations.items || []).map((item) => (
              <article key={item.id} className={`rec-card ${item.kind}`}>
                <p>
                  <span className={`badge ${item.kind}`}>{item.kind}</span>
                  {item.kind === 'fix' && (
                    <>
                      {' '}
                      <span className="badge">{item.priority_score}</span>
                      {' · '}
                      effort {item.effort}
                      {' · '}
                      risk {item.risk}
                    </>
                  )}
                  {item.synthetic && (
                    <span className="banner-synthetic"> {item.synthetic_label || 'SYNTHETIC DEMO DATA'}</span>
                  )}
                </p>
                <h2>{item.title}</h2>
                {item.url && (
                  <p>
                    Affected:{' '}
                    {/^https?:/i.test(item.url) ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.url}
                      </a>
                    ) : (
                      <code>{item.url}</code>
                    )}
                  </p>
                )}
                {item.problem && <p>{item.problem}</p>}
                {item.missing && (
                  <p className="note">Missing data: {item.missing}</p>
                )}
                {item.evidence?.length > 0 && (
                  <ul className="evidence-list">
                    {item.evidence.map((ev) => (
                      <li key={`${ev.url}-${ev.text}`}>
                        {ev.url ? `${ev.url} — ` : ''}
                        {ev.text}
                      </li>
                    ))}
                  </ul>
                )}
                {item.recommended_change && (
                  <p>
                    <strong>Requested change:</strong> {item.recommended_change}
                  </p>
                )}
                {item.expected_benefit && (
                  <p className="note">
                    <span className="badge estimate">{item.expected_benefit.kind}</span> {item.expected_benefit.text}
                  </p>
                )}
                {item.ranking_explanation && <p className="note">{item.ranking_explanation}</p>}
                <p className="note">
                  Source: {item.source_test || 'none'}
                  {item.evidence_timestamp ? ` · evidence ${item.evidence_timestamp}` : ''}
                  {' · '}
                  {item.status}
                </p>
              </article>
            ))}
            <h2>Limitations</h2>
            <ul className="limitations">
              {(recommendations.limitations || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel result" aria-labelledby="scorecard-heading">
        <p className="kicker">Question-set scorecard</p>
        <h2 id="scorecard-heading">Apex Moto starter questions</h2>
        <p className="note">
          Each question is scored once against the trusted Apex reference and any crawled website
          evidence. Pasted or collected AI answers are shown separately. If none exists, the AI
          column is <strong>Not observed</strong> — the expected fact is never treated as an assistant answer.
        </p>
        <div className="actions">
          <button type="button" disabled={Boolean(busy)} onClick={buildScorecard}>
            {busy === 'scorecard' ? 'Scoring…' : 'Build Apex scorecard'}
          </button>
          <button type="button" className="secondary" disabled={!scorecard} onClick={downloadScorecardJson}>
            Export JSON
          </button>
          <a className="button-link" href="/api/scorecard.csv">
            Export CSV
          </a>
        </div>
        {scorecard && (
          <>
            <p className="note">
              Set {scorecard.set?.id} · reference {scorecard.set?.reference_source_id} (as of{' '}
              {scorecard.set?.reference_as_of || 'n/a'}) · {scorecard.totals?.questions} questions
            </p>
            <div className="meta-row">
              {['correct', 'incorrect', 'missing', 'outdated', 'inconclusive'].map((key) => (
                <div className="meta" key={key}>
                  <span>{key}</span>
                  {scorecard.totals?.[key] || 0} ({scorecard.percentages?.[key] || 0}%)
                </div>
              ))}
            </div>
            <p className="note">
              AI answers: {scorecard.ai_observations?.not_observed || 0} Not observed ·{' '}
              {scorecard.ai_observations?.observed || 0} observed
            </p>
            <div className="table-wrap">
              <table className="scorecard">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Question</th>
                    <th>Expected fact</th>
                    <th>Website evidence</th>
                    <th>AI answer</th>
                    <th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {(scorecard.rows || []).map((row) => (
                    <tr key={row.question_id}>
                      <td>
                        <span className={`badge status-${row.status}`}>{row.status}</span>
                      </td>
                      <td>{row.label || row.question}</td>
                      <td>{row.expected_fact || '—'}</td>
                      <td>
                        {row.website_evidence?.status}
                        {row.affected_url ? ` · ${row.affected_url}` : ''}
                        {row.website_evidence?.snippets?.[0]?.text
                          ? ` — ${row.website_evidence.snippets[0].text}`
                          : ''}
                      </td>
                      <td>
                        {row.ai_answer?.label || row.ai_answer?.status}
                        {row.ai_answer?.text ? ` — ${row.ai_answer.text}` : ''}
                      </td>
                      <td>{row.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h2>Category definitions</h2>
            <ul className="limitations">
              {Object.entries(scorecard.definitions || {}).map(([key, text]) => (
                <li key={key}>
                  <strong>{key}:</strong> {text}
                </li>
              ))}
            </ul>
            <h2>Limitations</h2>
            <ul className="limitations">
              {(scorecard.limitations || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel result" aria-labelledby="plan-heading">
        <p className="kicker">Monitoring plan</p>
        <h2 id="plan-heading">4–8 week AI visibility cadence</h2>
        <p className="note">
          Configurable plan built from current checker findings. It does not invent traffic,
          referrals, conversions, or answer-visibility history. GA4 stays unconnected until a real
          export or credentials are supplied.
        </p>
        <div className="actions">
          <label>
            <span className="label">Horizon (weeks)</span>
            <select
              value={planWeeks}
              onChange={(e) => setPlanWeeks(Number(e.target.value))}
            >
              {[4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="button" disabled={Boolean(busy)} onClick={() => buildPlan(planWeeks)}>
            {busy === 'plan' ? 'Building…' : 'Build monitoring plan'}
          </button>
        </div>
        {monitoring && (
          <>
            <p>{monitoring.purpose}</p>
            <p className="note">
              Horizon {monitoring.horizon_weeks} weeks · GA4 {monitoring.current_inputs?.ga4_status}
              {monitoring.current_inputs?.traffic_synthetic ? ' · Traffic: SYNTHETIC DEMO DATA' : ''}
            </p>
            {(monitoring.data_sources || []).some((row) => row.synthetic) && (
              <p className="banner-synthetic">
                One or more data sources are labelled synthetic or fixture-only. They are not production observations.
              </p>
            )}
            <h2>Suggested roles</h2>
            <ul className="evidence-list">
              {(monitoring.owners || []).map((row) => (
                <li key={row.role}>
                  <strong>{row.role}:</strong> {row.duty}
                </li>
              ))}
            </ul>
            <h2>Weekly schedule</h2>
            {(monitoring.schedule || []).map((week) => (
              <article key={week.week} className="rec-card">
                <h2>
                  Week {week.week} · {week.cadence}
                </h2>
                <p>
                  <strong>Activities:</strong> {(week.activities || []).join(' ')}
                </p>
                <p>
                  <strong>Measure:</strong> {(week.measures || []).join('; ')}
                </p>
                <p>
                  <strong>Deliverables:</strong> {(week.evidence_deliverables || []).join('; ')}
                </p>
                <p className="note">
                  Human approval required before website changes. Apply on an isolated copy, retest
                  against baseline, roll back if not improved.
                </p>
              </article>
            ))}
            <h2>Escalation</h2>
            <ul className="limitations">
              {(monitoring.escalation?.criteria || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <h2>Change policy</h2>
            <ul className="limitations">
              <li>{monitoring.change_policy?.production_site}</li>
              <li>{monitoring.change_policy?.isolated_demo}</li>
              <li>{monitoring.change_policy?.benefits}</li>
            </ul>
            <h2>Limitations</h2>
            <ul className="limitations">
              {(monitoring.limitations || []).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel result" aria-labelledby="apply-demo-heading">
        <p className="kicker">Apply → Retest → Rollback</p>
        <h2 id="apply-demo-heading">Isolated Apex Moto demo fixtures</h2>
        <p className="banner-synthetic">LOCAL DEMO FIXTURE — these buttons never modify the live website.</p>
        <p className="note">
          Two reversible patches run against a local test copy under <code>checker/data/apply-demo/working/</code>.
          Facts come from the Apex reference pack. Local test improvement is not a claim that AI answer
          visibility improved in the real world.
        </p>
        <div className="actions">
          <button
            type="button"
            className="secondary"
            disabled={Boolean(busy)}
            onClick={() => api('/api/apply-demo').then(setApplyDemo).catch((err) => setError(err.message))}
          >
            Refresh demo fixtures
          </button>
        </div>
        {(applyDemo?.items || []).map((item) => {
          const canApply = item.status === 'proposed' || item.status === 'rolled_back';
          const canRetest = ['applied', 'verified_improved', 'verified_no_improvement', 'verification_inconclusive'].includes(
            item.status
          );
          const canRollback = canRetest;
          return (
            <article key={item.id} className="rec-card fix">
              <p>
                <span className={`badge status-${item.status}`}>{item.status}</span>
                <span className="banner-synthetic"> {item.synthetic_label || 'LOCAL DEMO FIXTURE'}</span>
              </p>
              <h2>{item.title}</h2>
              <p>
                Isolated file: <code>{item.apply?.file}</code>
              </p>
              <p>{item.problem}</p>
              {item.evidence?.length > 0 && (
                <ul className="evidence-list">
                  {item.evidence.map((ev) => (
                    <li key={`${ev.url}-${ev.text}`}>
                      {ev.text}
                    </li>
                  ))}
                </ul>
              )}
              {item.recommended_change && (
                <p>
                  <strong>Requested change:</strong> {item.recommended_change}
                </p>
              )}
              {item.expected_benefit && (
                <p className="note">
                  <span className="badge estimate">{item.expected_benefit.kind}</span> {item.expected_benefit.text}
                </p>
              )}
              {item.last_comparison && (
                <div className="compare">
                  <p>
                    <strong>Retest:</strong> {item.last_comparison.status} — {item.last_comparison.explanation}
                  </p>
                  {(item.last_comparison.changed || []).length > 0 && (
                    <ul className="evidence-list">
                      {item.last_comparison.changed.map((row) => (
                        <li key={row.metric}>
                          {row.metric}: {String(row.before)} → {String(row.after)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <div className="actions">
                <button
                  type="button"
                  disabled={Boolean(busy) || !canApply}
                  onClick={() => demoAction(item.id, 'apply')}
                >
                  Apply demo fix
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={Boolean(busy) || !canRetest}
                  onClick={() => demoAction(item.id, 'retest')}
                >
                  Retest
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={Boolean(busy) || !canRollback}
                  onClick={() => demoAction(item.id, 'rollback')}
                >
                  Rollback demo fix
                </button>
              </div>
            </article>
          );
        })}
        {applyDemo?.changelog?.length > 0 && (
          <>
            <h2>Versioned change log</h2>
            <p className="note">Prior entries are kept. Newest last.</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Recommendation</th>
                    <th>Action</th>
                    <th>Status</th>
                    <th>File</th>
                    <th>Hashes</th>
                  </tr>
                </thead>
                <tbody>
                  {applyDemo.changelog.map((row) => (
                    <tr key={row.entry_id}>
                      <td>{row.timestamp}</td>
                      <td>
                        <code>{row.recommendation_id}</code>
                      </td>
                      <td>
                        {row.action}
                        {row.refused ? ' (refused)' : ''}
                      </td>
                      <td>{row.status}</td>
                      <td>
                        <code>{row.affected_file}</code>
                      </td>
                      <td>
                        {row.before_hash ? `before ${row.before_hash.slice(0, 8)}` : '—'}
                        {row.after_hash ? ` / after ${row.after_hash.slice(0, 8)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <h2>Limitations</h2>
        <ul className="limitations">
          {(applyDemo?.limitations || [
            'Demo patches stay inside the local fixture directory.',
            'Live Apex Moto files are not modified.',
          ]).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <section className="history">
        <h2>Recent runs</h2>
        {history.length === 0 && <p className="note">No stored runs yet.</p>}
        <ul>
          {history.slice(0, 12).map((row) => (
            <li key={row.id}>
              <button type="button" className="link" onClick={() => setRun(row)}>
                {row.started_at} — {CATEGORY_LABEL[row.evaluation?.overall_category] || row.status} —{' '}
                {row.question?.text}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
    </div>
  );
}
