import { SCORECARD_CATEGORIES } from '../scorecard/build.js';

export function clampWeeks(value) {
  const weeks = Number(value);
  if (!Number.isFinite(weeks)) return 6;
  return Math.min(8, Math.max(4, Math.round(weeks)));
}

function ga4Block(ga4) {
  const status = ga4?.status || 'not_connected';
  const synthetic = Boolean(ga4?.synthetic);
  return {
    name: 'GA4 referrals / sessions / conversions',
    status,
    connected: Boolean(ga4?.connected),
    synthetic,
    label: synthetic ? ga4?.label || 'SYNTHETIC DEMO DATA' : status === 'not_connected' ? 'GA4 not connected' : ga4?.label,
    note:
      status === 'not_connected'
        ? 'No credentials or export have been supplied. Do not invent referrals, sessions, or conversions.'
        : synthetic
          ? 'SYNTHETIC DEMO DATA. These analytics rows are not production GA4 results and are not joined to access-log counts.'
          : 'Imported export only. Not a live Google Analytics API connection until credentials are supplied.',
  };
}

function trafficBlock(traffic) {
  if (!traffic) {
    return {
      name: 'AI crawler access logs',
      status: 'not_imported',
      synthetic: false,
      label: null,
      note: 'Import server/CDN logs (or the labelled synthetic demo) before treating crawler counts as observed.',
    };
  }
  const synthetic = Boolean(traffic.source?.synthetic);
  return {
    name: 'AI crawler access logs',
    status: synthetic ? 'synthetic_demo' : 'imported',
    synthetic,
    label: synthetic ? traffic.source?.label || 'SYNTHETIC DEMO DATA' : traffic.source?.label || 'Imported access logs',
    note: synthetic
      ? 'SYNTHETIC DEMO DATA. Use the fixture to rehearse the workflow; do not report it as live crawler traffic.'
      : 'Observed log rows only. A crawler request is not proof of AI citation.',
  };
}

function role(name, duty) {
  return { role: name, duty };
}

function weekTemplate(week, weeks, ctx) {
  const last = week === weeks;
  const first = week === 1;
  const mid = week === Math.ceil(weeks / 2);
  const activities = [];
  const measures = [];
  const deliverables = [];

  if (first) {
    activities.push(
      'Freeze a baseline: Apex question-set scorecard, readability findings, Traffic Lens import status, and GA4 connection status.',
      'Record current apply-demo changelog state. Do not treat local fixture verification as live AI visibility.'
    );
    measures.push('Scorecard category counts', 'Readability finding counts', 'Crawler request totals if logs exist');
    deliverables.push('Baseline scorecard JSON/CSV', 'Baseline readability report id/timestamp', 'Written GA4 status (usually not_connected)');
  } else {
    activities.push(
      'Re-run the Apex question-set scorecard against the latest crawl evidence and any newly pasted AI answers.',
      'Review AI crawler access logs for new families, lookalikes, 403/404/500 paths, and robots.txt probes.'
    );
    measures.push('Week-over-week scorecard category counts (same question set, no double-counting)', 'Crawler classifications and error paths');
    deliverables.push('Updated scorecard export', 'Log-review notes with source labelled observed or SYNTHETIC DEMO DATA');
  }

  if (week % 2 === 0 || first) {
    activities.push('Run the Readability Test on priority product URLs, including Product/Offer JSON-LD and raw-vs-rendered gaps.');
    measures.push('Structured-data warnings', 'JS-dependent content findings (only when a render comparison exists)');
    deliverables.push('Readability regression checklist');
  }

  activities.push(
    ctx.ga4.status === 'not_connected'
      ? 'Check GA4 seam: still not_connected until a real export or credentials are supplied. Record that fact; do not fill zeros as if they were measured.'
      : 'Review imported GA4 referral/session/conversion rows separately from access-log counts. Keep synthetic analytics labelled.'
  );
  measures.push('GA4 connection status (not a live count until connected)');

  if (mid) {
    activities.push(
      'Mid-plan review: compare scorecard missing/outdated/incorrect rows to ranked recommendations. Expected benefits stay estimates unless a measured before/after exists.'
    );
    deliverables.push('Prioritized change list for human approval');
  }

  if (last) {
    activities.push(
      'Close-out: export the final scorecard, changelog, traffic report, and a written decision on what still needs production-safe staging.',
      'Do not claim AI answer visibility improved unless comparable live assistant observations exist for the same questions.'
    );
    deliverables.push('End-of-plan pack: scorecard, monitoring notes, apply/retest/rollback log');
  }

  activities.push(
    'Any website change requires human approval. Apply only on an approved isolated copy, then retest, then roll back if verification is not improved or the file drifted.'
  );

  return {
    week,
    cadence: first ? 'kickoff (week 1)' : last ? 'close-out' : 'weekly',
    activities,
    measures,
    data_sources: [ctx.traffic, ctx.ga4, ctx.scorecard, ctx.readability, ctx.changelog],
    owners: ctx.owners,
    evidence_deliverables: deliverables,
    change_control: {
      human_approval_required: true,
      apply: 'Only after an Approver signs off, and only on an isolated copy — never auto-deploy to production.',
      retest: 'Re-run the relevant scorecard rows and readability checks. Compare to the recorded baseline.',
      rollback: 'Restore the exact prior file bytes if verification is not improved, inconclusive, or the working copy drifted.',
    },
  };
}

export function buildMonitoringPlan({
  weeks = 6,
  scorecard = null,
  readability = null,
  traffic = null,
  ga4 = null,
  recommendations = null,
  applyDemo = null,
} = {}) {
  const horizon = clampWeeks(weeks);
  const trafficSource = trafficBlock(traffic);
  const ga4Source = ga4Block(ga4);
  const scorecardSource = {
    name: 'Apex question-set scorecard',
    status: scorecard ? 'available' : 'not_built',
    synthetic: false,
    note: scorecard
      ? `${scorecard.totals?.questions || 0} questions. AI answers not observed: ${scorecard.ai_observations?.not_observed ?? 'n/a'}.`
      : 'Build the scorecard from the Apex pack before using it as a weekly measure.',
  };
  const readabilitySource = {
    name: 'Readability / structured-data checks',
    status: readability ? 'available' : 'not_run',
    synthetic: false,
    note: readability
      ? `${(readability.findings || []).length} findings on ${readability.url || 'last run'}.`
      : 'Run the Readability Test; do not invent JS-only or JSON-LD issues.',
  };
  const changelogSource = {
    name: 'Apply → retest → rollback changelog',
    status: applyDemo?.changelog?.length ? 'available' : 'empty',
    synthetic: true,
    label: 'LOCAL DEMO FIXTURE',
    note: 'Local demo fixture only. verified_improved on a fixture is not live AI visibility.',
  };

  const owners = [
    role('Content owner', 'Confirms which catalogue facts must stay canonical and reviews copy changes.'),
    role('Engineering', 'Imports logs, runs crawls/scorecard, applies approved isolated patches, retests, rolls back.'),
    role('Analytics', 'Owns the GA4 seam. Does not fabricate referrals while status is not_connected.'),
    role('QA reviewer', 'Checks scorecard category rules, synthetic labels, and before/after evidence.'),
    role('Approver', 'Required human sign-off before any website change. No automatic production deploy.'),
  ];

  const ctx = {
    traffic: trafficSource,
    ga4: ga4Source,
    scorecard: scorecardSource,
    readability: readabilitySource,
    changelog: changelogSource,
    owners,
  };

  const schedule = [];
  for (let week = 1; week <= horizon; week += 1) {
    schedule.push(weekTemplate(week, horizon, ctx));
  }

  const problemRows = (scorecard?.rows || []).filter((row) => ['incorrect', 'missing', 'outdated'].includes(row.status));
  const recFixes = (recommendations?.items || []).filter((row) => row.kind === 'fix').slice(0, 8);
  const syntheticTraffic = Boolean(traffic?.source?.synthetic);

  return {
    generated_at: new Date().toISOString(),
    horizon_weeks: horizon,
    configurable: { min: 4, max: 8, default: 6 },
    purpose:
      'A practical 4–8 week cadence to watch AI crawler access, GA4 (when connected), question-set accuracy, readability, and approved change control. It does not invent history or live visibility gains.',
    owners,
    data_sources: [trafficSource, ga4Source, scorecardSource, readabilitySource, changelogSource],
    current_inputs: {
      scorecard_totals: scorecard?.totals || null,
      readability_findings: readability?.findings?.length ?? null,
      traffic_synthetic: syntheticTraffic,
      ga4_status: ga4Source.status,
      open_fix_recommendations: recFixes.map((row) => ({
        id: row.id,
        title: row.title,
        expected_benefit_kind: row.expected_benefit?.kind || 'estimate',
        synthetic: Boolean(row.synthetic),
      })),
      scorecard_attention: problemRows.slice(0, 12).map((row) => ({
        question_id: row.question_id,
        status: row.status,
        affected_url: row.affected_url,
      })),
    },
    weekly_cadence: 'One operating review per week. Mid-horizon prioritization. Final week is close-out, not a claim of improvement.',
    schedule,
    escalation: {
      criteria: [
        'Scorecard incorrect or outdated count rises week over week on the same question set.',
        'Access logs show a new 5xx burst or a previously public product URL returning 403/404 to crawlers.',
        'Readability finds a new typed price conflict or a render comparison that drops a previously visible fact.',
        'A proposed production change lacks Approver sign-off, baseline evidence, or a rollback path.',
        'GA4 remains not_connected: escalate for credentials/export, and do not substitute invented referral numbers.',
      ],
      notify: ['Content owner', 'Engineering', 'Approver'],
    },
    change_policy: {
      human_approval_before_website_changes: true,
      auto_deploy_forbidden: true,
      production_site: 'Do not modify the live Apex Moto site from this checker.',
      isolated_demo: 'Apply → Retest → Rollback stays on LOCAL DEMO FIXTURE copies unless a later production-safe staging path is added.',
      retest_required: true,
      rollback_required_if_not_improved: true,
      benefits: 'Ranked-recommendation benefits remain estimates unless a measured before/after (same test, comparable evidence) exists.',
    },
    limitations: [
      syntheticTraffic
        ? 'Traffic activities that use the current report are SYNTHETIC DEMO DATA until real server/CDN logs are imported.'
        : 'Crawler monitoring uses imported logs only when present; empty logs are not zero traffic.',
      `GA4 status is ${ga4Source.status}. No live referrals, sessions, or conversions are assumed.`,
      'Local fixture verified_improved is not an AI-answer-visibility improvement.',
      'Do not claim an assistant cited a page unless a direct observed answer exists for that question.',
      `Scorecard categories stay mutually exclusive: ${SCORECARD_CATEGORIES.join(', ')}.`,
    ],
  };
}
