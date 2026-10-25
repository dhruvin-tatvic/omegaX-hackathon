const SEVERITY_SCORE = { high: 40, medium: 24, low: 12 };
const EFFORT_PENALTY = { low: 0, medium: 6, high: 14 };
const RISK_PENALTY = { low: 0, medium: 5, high: 12 };

const INSUFFICIENT_TITLE = 'Insufficient evidence to recommend a change';

function asList(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function evidenceTexts(items) {
  return asList(items)
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') return { url: null, kind: 'note', text: item };
      const text = item.text || item.detail || item.error || '';
      if (!text) return null;
      return { url: item.url || null, kind: item.kind || item.layer || 'evidence', text };
    })
    .filter(Boolean);
}

function scorePriority({ severity = 'medium', effort = 'medium', risk = 'low', observed = true, synthetic = false }) {
  const base = SEVERITY_SCORE[severity] ?? 20;
  const total =
    base - (EFFORT_PENALTY[effort] ?? 6) - (RISK_PENALTY[risk] ?? 5) + (observed ? 8 : 0) - (synthetic ? 4 : 0);
  return Math.max(1, total);
}

function rankingExplanation({ severity, effort, risk, observed, synthetic, extra }) {
  const parts = [
    `Priority uses ${severity} severity, ${effort} effort, and ${risk} risk.`,
    observed ? 'It is based on observed test evidence, not a measured business outcome.' : 'Part of the ranking is a hypothesis built on observed signals.',
  ];
  if (synthetic) parts.push('Synthetic demo data does not raise priority as if it were production traffic.');
  if (extra) parts.push(extra);
  return parts.join(' ');
}

function fixRec(fields) {
  const synthetic = Boolean(fields.synthetic);
  const observed = fields.layer !== 'hypothesis';
  const priority_score = scorePriority({
    severity: fields.severity,
    effort: fields.effort,
    risk: fields.risk,
    observed,
    synthetic,
  });
  return {
    id: fields.id,
    kind: 'fix',
    status: 'proposed',
    title: fields.title,
    url: fields.url || null,
    related_urls: fields.related_urls || [],
    problem: fields.problem,
    evidence: evidenceTexts(fields.evidence),
    recommended_change: fields.recommended_change,
    expected_benefit: {
      kind: 'estimate',
      text: fields.expected_benefit,
    },
    effort: fields.effort,
    risk: fields.risk,
    priority_score,
    ranking_explanation: rankingExplanation({
      severity: fields.severity,
      effort: fields.effort,
      risk: fields.risk,
      observed,
      synthetic,
      extra: fields.ranking_extra,
    }),
    source_test: fields.source_test,
    evidence_timestamp: fields.evidence_timestamp || null,
    layer: fields.layer || 'observed',
    synthetic,
    synthetic_label: synthetic ? fields.synthetic_label || 'SYNTHETIC DEMO DATA' : null,
    limitations: fields.limitations || [
      'This is a proposed change. It has not been applied or verified.',
      'Expected benefit is an estimate, not a measured impact.',
    ],
  };
}

function insufficientItem(fields) {
  return {
    id: fields.id || 'insufficient',
    kind: 'insufficient',
    status: 'insufficient_evidence',
    title: INSUFFICIENT_TITLE,
    url: fields.url || null,
    related_urls: [],
    problem: fields.problem,
    evidence: evidenceTexts(fields.evidence),
    recommended_change: null,
    expected_benefit: null,
    effort: null,
    risk: null,
    priority_score: 0,
    ranking_explanation: 'No change is ranked because required evidence is missing.',
    source_test: fields.source_test || null,
    evidence_timestamp: fields.evidence_timestamp || null,
    layer: 'observed',
    synthetic: Boolean(fields.synthetic),
    synthetic_label: fields.synthetic ? fields.synthetic_label || 'SYNTHETIC DEMO DATA' : null,
    missing: fields.missing,
    limitations: ['Do not treat a missing recommendation as proof that the site is healthy or broken.'],
  };
}

function noChangeItem(fields) {
  return {
    id: fields.id,
    kind: 'no_change',
    status: 'no_change_needed',
    title: fields.title || 'No change needed',
    url: fields.url || null,
    related_urls: [],
    problem: 'No issue requiring a website change was detected in this test result.',
    evidence: evidenceTexts(fields.evidence),
    recommended_change: null,
    expected_benefit: null,
    effort: null,
    risk: null,
    priority_score: 0,
    ranking_explanation: 'Adequate evidence was present and no defect was found, so an unnecessary change is not recommended.',
    source_test: fields.source_test,
    evidence_timestamp: fields.evidence_timestamp || null,
    layer: 'observed',
    synthetic: Boolean(fields.synthetic),
    synthetic_label: null,
    limitations: ['A later test with more pages, logs, or questions may still find issues.'],
  };
}

function fromReadability(report) {
  const items = [];
  if (!report) return items;
  const timestamp = report.finished_at || report.started_at || null;
  const findings = report.findings || [];
  const skipFix = new Set(['js_heuristic', 'render_unavailable', 'render_failed', 'linked_pdf', 'linked_image']);

  for (const finding of findings) {
    if (finding.category === 'render_unavailable' || finding.category === 'render_failed') {
      items.push(
        insufficientItem({
          id: `insufficient-${finding.id || finding.category}`,
          url: finding.url,
          source_test: 'readability',
          evidence_timestamp: timestamp,
          evidence: finding.evidence,
          problem: finding.explanation,
          missing:
            'A successful browser render comparison is missing, so a JavaScript-only content change is not recommended.',
        })
      );
      continue;
    }
    if (finding.category === 'js_heuristic') {
      items.push(
        insufficientItem({
          id: `insufficient-${finding.id || 'js-heuristic'}`,
          url: finding.url,
          source_test: 'readability',
          evidence_timestamp: timestamp,
          evidence: finding.evidence,
          problem: finding.explanation,
          missing:
            'The JavaScript-shell detector is a heuristic only. It is not enough evidence to recommend rewriting the page.',
        })
      );
      continue;
    }
    if (skipFix.has(finding.category)) continue;

    if (finding.category === 'conflicting_facts') {
      const values = (finding.values || []).join(' vs ');
      const urls = [finding.url, ...(finding.related_urls || [])].filter(Boolean);
      items.push(
        fixRec({
          id: `readability-${finding.id}`,
          title: 'Publish one canonical price for the conflicting product',
          url: finding.url,
          related_urls: finding.related_urls || [],
          problem: finding.explanation,
          evidence: finding.evidence,
          recommended_change: `On ${urls.join(' and ')}, keep a single canonical listed price in the HTML${values ? ` (currently ${values})` : ''} and remove or clearly label the outdated figure.`,
          expected_benefit:
            'Estimate only: answer engines would be less likely to cite two different prices for the same product. This is not a measured traffic or conversion effect.',
          effort: 'medium',
          risk: 'low',
          severity: finding.severity || 'high',
          source_test: 'readability',
          evidence_timestamp: timestamp,
          limitations: finding.limitations,
        })
      );
      continue;
    }

    if (finding.category === 'http_error') {
      items.push(
        fixRec({
          id: `readability-${finding.id}`,
          title: 'Investigate the HTTP error blocking this public URL',
          url: finding.url,
          problem: finding.explanation,
          evidence: finding.evidence,
          recommended_change: `Ask the site owner to confirm whether ${finding.url} should be publicly fetchable. If yes, fix the ${finding.evidence?.[0]?.text || 'HTTP error'} so HTML evidence is available. If the path is intentionally private, leave it blocked and do not treat this as a content bug.`,
          expected_benefit:
            'Estimate only: crawlers and the checker could then read the page HTML. No citation or conversion lift is measured.',
          effort: 'medium',
          risk: 'medium',
          severity: finding.severity || 'medium',
          source_test: 'readability',
          evidence_timestamp: timestamp,
          limitations: finding.limitations,
        })
      );
      continue;
    }

    if (finding.category === 'robots_restriction') {
      items.push(
        fixRec({
          id: `readability-${finding.id}`,
          title: 'Review the robots.txt disallow for this path',
          url: finding.url,
          problem: finding.explanation,
          evidence: finding.evidence,
          recommended_change: `Review robots.txt for ${finding.url}. If the path should be readable by AI crawlers, allow the intended user-agents; if it must stay private, keep the disallow and do not change it.`,
          expected_benefit:
            'Estimate only: allowed crawlers could fetch the path. This does not prove an AI system would use or cite it.',
          effort: 'low',
          risk: 'medium',
          severity: finding.severity || 'medium',
          source_test: 'readability',
          evidence_timestamp: timestamp,
          limitations: finding.limitations,
        })
      );
      continue;
    }

    if (finding.category === 'js_dependent_content') {
      items.push(
        fixRec({
          id: `readability-${finding.id}`,
          title: 'Put key facts in raw HTML as well as the rendered page',
          url: finding.url,
          problem: finding.explanation,
          evidence: finding.evidence,
          recommended_change: `Add the facts that currently appear only after rendering (see evidence) to the server-rendered HTML of ${finding.url}, not only after client-side scripts run.`,
          expected_benefit:
            'Estimate only: HTTP-only crawlers could see the same facts as a browser snapshot. Extra rendered text is a difference, not exclusive proof of JavaScript generation.',
          effort: 'high',
          risk: 'medium',
          severity: finding.severity || 'medium',
          source_test: 'readability',
          evidence_timestamp: timestamp,
          layer: 'hypothesis_from_observed',
          limitations: finding.limitations,
        })
      );
      continue;
    }

    if (finding.category === 'missing_structured_data') {
      items.push(
        fixRec({
          id: `readability-${finding.id}`,
          title: 'Add Product JSON-LD on this product-like page',
          url: finding.url,
          problem: finding.explanation,
          evidence: finding.evidence,
          recommended_change: `Add a Product/Offer JSON-LD script to the raw HTML of ${finding.url} with the same name and price already shown on the page. Do not invent values that are not in the HTML.`,
          expected_benefit:
            'Estimate only: machine-readable offers may be easier for some crawlers to parse. Missing JSON-LD is not unreadability.',
          effort: 'low',
          risk: 'low',
          severity: finding.severity || 'low',
          source_test: 'readability',
          evidence_timestamp: timestamp,
          limitations: finding.limitations,
        })
      );
    }
  }

  const findingUrls = new Set(findings.filter((f) => !skipFix.has(f.category) && f.category !== 'js_heuristic').map((f) => f.url));
  const visited = report.session?.pages_visited || [];
  for (const page of visited) {
    const hasIssue = findingUrls.has(page.url);
    const evidenceCount = (report.session?.facts || []).filter((fact) => fact.url === page.url).length;
    if (!hasIssue && (evidenceCount > 0 || page.title)) {
      items.push(
        noChangeItem({
          id: `no-change-readability-${page.url}`,
          title: 'No readability change needed for this page',
          url: page.url,
          source_test: 'readability',
          evidence_timestamp: timestamp,
          evidence: [
            {
              url: page.url,
              kind: 'page',
              text: `Crawled HTML for ${page.url}${page.title ? ` (title: ${page.title})` : ''} without a readability finding that requires a site change.`,
            },
          ],
        })
      );
    }
  }

  return items;
}

function fromAccuracy(runs) {
  const items = [];
  for (const run of asList(runs)) {
    const evaluation = run.evaluation || run;
    const timestamp = run.finished_at || run.started_at || null;
    const url = run.target_url || evaluation.evidence_coverage?.origin || null;
    const category = evaluation.overall_category;
    if (!category) continue;

    if (category === 'insufficient_evidence') {
      items.push(
        insufficientItem({
          id: `insufficient-accuracy-${run.id || timestamp || 'run'}`,
          url,
          source_test: 'accuracy',
          evidence_timestamp: timestamp,
          evidence: [{ text: evaluation.explanation || 'The crawl did not find relevant website text.' }],
          problem: evaluation.explanation,
          missing:
            'There is not enough on-page HTML matching this question to recommend a specific website change.',
        })
      );
      continue;
    }

    const conflictClaims = (evaluation.claim_results || []).filter((c) => c.status === 'conflict_in_reference');
    if (conflictClaims.length) {
      for (const claim of conflictClaims) {
        items.push(
          fixRec({
            id: `accuracy-conflict-${run.id || ''}-${claim.fact_id || claim.claim}`,
            title: 'Resolve conflicting website values used in this answer test',
            url: claim.sources?.[0]?.url || url,
            related_urls: (claim.sources || []).map((s) => s.url).filter(Boolean),
            problem: claim.detail || evaluation.explanation,
            evidence: claim.sources,
            recommended_change:
              'Make the listed values consistent across the cited pages, or mark non-canonical pages as outdated, then re-run the accuracy test.',
            expected_benefit:
              'Estimate only: a later answer test would be less likely to be marked inconclusive because pages disagree. No conversion impact is measured.',
            effort: 'medium',
            risk: 'low',
            severity: 'high',
            source_test: 'accuracy',
            evidence_timestamp: timestamp,
          })
        );
      }
      continue;
    }

    if (category === 'correct') {
      const sources = (evaluation.claim_results || []).flatMap((c) => c.sources || []);
      items.push(
        noChangeItem({
          id: `no-change-accuracy-${run.id || timestamp || 'run'}`,
          title: 'No website change needed for this accuracy result',
          url,
          source_test: 'accuracy',
          evidence_timestamp: timestamp,
          evidence: sources.length
            ? sources
            : [{ url, kind: 'evaluation', text: evaluation.explanation || 'Answer matched website-sourced evidence.' }],
        })
      );
      continue;
    }

    if (category === 'incorrect') {
      const mismatching = (evaluation.claim_results || []).filter((c) => c.status === 'mismatch');
      items.push(
        noChangeItem({
          id: `no-change-accuracy-site-${run.id || timestamp || 'run'}`,
          title: 'No website change recommended; the crawled pages already state a value',
          url,
          source_test: 'accuracy',
          evidence_timestamp: timestamp,
          evidence: mismatching.flatMap((c) => c.sources || [{ text: c.detail || evaluation.explanation }]),
        })
      );
      continue;
    }

    if (category === 'partially_correct' || category === 'unsupported' || category === 'inconclusive') {
      items.push(
        insufficientItem({
          id: `insufficient-accuracy-partial-${run.id || timestamp || 'run'}`,
          url,
          source_test: 'accuracy',
          evidence_timestamp: timestamp,
          evidence: [{ text: evaluation.explanation }],
          problem: evaluation.explanation,
          missing: 'The accuracy result does not identify a specific missing HTML sentence to add.',
        })
      );
    }
  }
  return items;
}

function fromTraffic(report) {
  const items = [];
  if (!report) return items;
  const timestamp =
    report.observed?.time_range?.end || report.analyzed_at || report.observed?.time_range?.start || null;
  const synthetic = Boolean(report.source?.synthetic);
  const syntheticLabel = report.source?.label || 'SYNTHETIC DEMO DATA';
  const ga4Status = report.ga4?.status || 'not_connected';

  const errors = report.observed?.blocked_or_error_pages || [];
  if (!report.observed || report.observed.request_count === 0) {
    items.push(
      insufficientItem({
        id: 'insufficient-traffic-empty',
        source_test: 'traffic',
        evidence_timestamp: timestamp,
        synthetic,
        synthetic_label: syntheticLabel,
        problem: 'The traffic report has no observed log rows.',
        missing: 'Import access logs (or the labelled synthetic demo) before recommending crawl-access changes.',
      })
    );
    return items;
  }

  for (const page of errors) {
    const worst = [...(page.errors || [])].sort((a, b) => b.status - a.status)[0];
    const status = worst?.status;
    const severity = status >= 500 ? 'high' : status === 403 ? 'high' : 'medium';
    const statusText = (page.errors || []).map((row) => `${row.status}×${row.count}`).join(', ');
    items.push(
      fixRec({
        id: `traffic-error-${page.path}`,
        title: 'Review the blocked or error path seen in access logs',
        url: page.path,
        problem: `Observed log rows show ${page.path} returning ${statusText}.`,
        evidence: [
          {
            url: page.path,
            kind: 'log',
            text: `${statusText}${page.last_ts ? ` · last seen ${page.last_ts}` : ''}. Request count for this path: ${page.count}.`,
          },
        ],
        recommended_change: `Confirm whether ${page.path} should return a successful HTML response to public crawlers. If yes, fix the ${status} response. If the path is intentionally blocked, keep it blocked.`,
        expected_benefit: `Estimate only: successful fetches could give crawlers HTML for this path. GA4 is ${ga4Status}, so no referral or conversion effect is measured.`,
        effort: 'medium',
        risk: 'medium',
        severity,
        source_test: 'traffic',
        evidence_timestamp: page.last_ts || timestamp,
        synthetic,
        synthetic_label: syntheticLabel,
        ranking_extra: synthetic ? 'Log rows are labelled synthetic demo data.' : null,
      })
    );
  }

  return items;
}

export function recommendFromResults({ readability = null, traffic = null, accuracyRuns = [] } = {}) {
  const generated_at = new Date().toISOString();
  const sources = {
    readability: Boolean(readability),
    accuracy: asList(accuracyRuns).length > 0,
    traffic: Boolean(traffic),
    traffic_synthetic: Boolean(traffic?.source?.synthetic),
  };

  if (!sources.readability && !sources.accuracy && !sources.traffic) {
    return {
      generated_at,
      sources,
      items: [
        insufficientItem({
          problem: 'No readability, accuracy, or traffic-analysis results were provided.',
          missing: 'Run the Readability Test, evaluate an answer, or import access logs first.',
        }),
      ],
      limitations: [
        'Recommendations are generated only from tests that already ran.',
        'Nothing here has been applied to the website.',
      ],
    };
  }

  const items = [...fromReadability(readability), ...fromAccuracy(accuracyRuns), ...fromTraffic(traffic)];
  const fixes = items.filter((row) => row.kind === 'fix').sort((a, b) => b.priority_score - a.priority_score);
  const rest = items.filter((row) => row.kind !== 'fix');

  return {
    generated_at,
    sources,
    items: [...fixes, ...rest],
    limitations: [
      'Deterministic rules only. No LLM is used.',
      'Expected benefits are estimates, not guarantees or measured impact.',
      'Recommendations are proposed only; they are not applied or verified.',
      'Synthetic traffic stays labelled and is not treated as production analytics.',
    ],
  };
}

export { INSUFFICIENT_TITLE };
