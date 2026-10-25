import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadHumanReport } from './readability.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const LATEST_REPORT = path.join(repoRoot, 'data/llm_comparison_report.json');

function toIst(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date) + ' IST';
}

async function loadTraffic(origin) {
  try {
    const res = await fetch(`${origin}/api/status`, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return { available: false };
    const data = await res.json();
    return {
      available: true,
      window_hours: data.logWindowHours,
      last_poll_at: data.lastPollAt,
      last_poll_at_ist: toIst(data.lastPollAt),
      data_source: data.dataSource,
      stats: data.stats || {},
      period_note: `Traffic counts cover the last ${data.logWindowHours || 2} hour(s) from Render access logs.`,
    };
  } catch {
    return { available: false, period_note: 'Traffic API is not reachable on this machine.' };
  }
}

function loadCrawl() {
  const { manifest, report } = loadHumanReport();
  if (!report) return { available: false };
  return {
    available: true,
    base_url: report.base_url,
    generated_at: report.generated_at || manifest.generated_at,
    generated_at_ist: toIst(report.generated_at || manifest.generated_at),
    started_at: report.started_at,
    started_at_ist: toIst(report.started_at),
    finished_at: report.finished_at,
    finished_at_ist: toIst(report.finished_at),
    discovered: report.total_pages_discovered,
    captured: report.total_pages_captured,
    failed: report.total_pages_failed,
    product_pages: report.page_type_counts?.product_detail || 0,
    period_note: 'Crawl figures are from the latest Playwright Human View report, not the traffic window.',
  };
}

function loadEvaluation() {
  if (!fs.existsSync(LATEST_REPORT)) return { available: false };
  const report = JSON.parse(fs.readFileSync(LATEST_REPORT, 'utf8'));
  const rows = report.row_comparisons || [];
  const scores = rows.map((row) => Number(row.evaluation?.score) || 0);
  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const byVerdict = {};
  for (const row of rows) {
    const verdict = row.evaluation?.verdict || 'unknown';
    byVerdict[verdict] = (byVerdict[verdict] || 0) + 1;
  }
  const findings = (report.gap_analysis?.top_factual_gaps || []).slice(0, 4).map((item) => ({
    gap: item.gap,
    evidence: item.evidence,
    recommendation: item.recommendation,
  }));
  return {
    available: true,
    generated_at: report.meta?.generated_at,
    generated_at_ist: toIst(report.meta?.generated_at),
    facts_scraped_at: report.meta?.facts_scraped_at,
    facts_scraped_at_ist: toIst(report.meta?.facts_scraped_at),
    site_url: report.meta?.site_url,
    evaluation_count: rows.length,
    average_score: avg,
    by_verdict: byVerdict,
    findings,
    period_note: 'Evaluation scores are from the latest LLM comparison report, not the live traffic window.',
  };
}

export async function buildHomeSummary(trafficOrigin) {
  const [traffic, crawl, evaluation] = await Promise.all([
    loadTraffic(trafficOrigin),
    Promise.resolve(loadCrawl()),
    Promise.resolve(loadEvaluation()),
  ]);
  return {
    product: {
      name: 'Be The Answer',
      subtitle: 'AI Visibility & Answer Intelligence',
      audience: 'Tatvic internal team',
      site_name: 'Apex Moto',
      site_url: 'https://omegax-hackathon.onrender.com/',
    },
    traffic,
    crawl,
    evaluation,
  };
}
