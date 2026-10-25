import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
export const HISTORY_PATH = path.join(REPO_ROOT, 'data', 'comparison_history.json');
export const LATEST_REPORT_PATH = path.join(REPO_ROOT, 'data', 'llm_comparison_report.json');

function emptyStore() {
  return { version: 1, runs: [] };
}

export function loadHistory() {
  if (!fs.existsSync(HISTORY_PATH)) return emptyStore();
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    if (!data.runs) return emptyStore();
    return data;
  } catch {
    return emptyStore();
  }
}

function saveHistory(store) {
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(store, null, 2), 'utf8');
}

function runStats(run) {
  const rows = run.row_comparisons || [];
  const byTool = {};
  const byVerdict = {};
  let scoreSum = 0;
  for (const row of rows) {
    const tool = row.ai_tool || 'Unknown';
    const verdict = row.evaluation?.verdict || 'unknown';
    const score = Number(row.evaluation?.score) || 0;
    byTool[tool] = byTool[tool] || { count: 0, scoreSum: 0 };
    byTool[tool].count += 1;
    byTool[tool].scoreSum += score;
    byVerdict[verdict] = (byVerdict[verdict] || 0) + 1;
    scoreSum += score;
  }
  const toolAverages = {};
  for (const [tool, v] of Object.entries(byTool)) {
    toolAverages[tool] = Math.round(v.scoreSum / v.count);
  }
  return {
    row_count: rows.length,
    average_score: rows.length ? Math.round(scoreSum / rows.length) : 0,
    by_verdict: byVerdict,
    average_score_by_tool: toolAverages,
  };
}

/** @param {object} report full llm_comparison_report.json body */
export function appendRun(report) {
  const store = loadHistory();
  const generatedAt = report.meta?.generated_at || new Date().toISOString();
  if (store.runs.some(r => r.generated_at === generatedAt)) {
    return { added: false, id: store.runs.find(r => r.generated_at === generatedAt)?.id };
  }
  const id = crypto.randomUUID();
  const entry = {
    id,
    generated_at: generatedAt,
    meta: report.meta,
    row_comparisons: report.row_comparisons,
    gap_analysis: report.gap_analysis,
    stats: runStats(report),
  };
  store.runs.push(entry);
  store.runs.sort((a, b) => new Date(a.generated_at) - new Date(b.generated_at));
  saveHistory(store);
  return { added: true, id };
}

export function importLatestReportIfNew() {
  if (!fs.existsSync(LATEST_REPORT_PATH)) return { imported: false, reason: 'no_report' };
  const report = JSON.parse(fs.readFileSync(LATEST_REPORT_PATH, 'utf8'));
  const result = appendRun(report);
  return { imported: result.added, id: result.id };
}

export function listRuns() {
  const store = loadHistory();
  return store.runs.map(r => ({
    id: r.id,
    generated_at: r.generated_at,
    groq_model: r.meta?.groq_model,
    facts_scraped_at: r.meta?.facts_scraped_at,
    stats: r.stats,
  }));
}

export function getRun(id) {
  return loadHistory().runs.find(r => r.id === id) || null;
}

export function flattenRows({ runId = 'latest', limit = 500 } = {}) {
  const store = loadHistory();
  let runs = store.runs;
  if (runId === 'latest') {
    runs = runs.length ? [runs[runs.length - 1]] : [];
  } else if (runId !== 'all') {
    runs = runs.filter(r => r.id === runId);
  }

  const out = [];
  for (const run of runs) {
    for (const row of run.row_comparisons || []) {
      out.push({
        entry_id: `${run.id}:${row.row_index}`,
        run_id: run.id,
        run_at: run.generated_at,
        row_index: row.row_index,
        ai_tool: row.ai_tool,
        input: row.input,
        output_preview: row.output_preview,
        verdict: row.evaluation?.verdict,
        score: row.evaluation?.score,
        summary: row.evaluation?.summary,
        primary_gap: row.evaluation?.primary_gap,
        models_included: row.ground_truth_scope?.models_included || [],
        site_fix_hint: row.evaluation?.site_fix_hint,
        factual_errors: row.evaluation?.factual_errors,
        access_issues: row.evaluation?.access_or_visibility_issues,
      });
    }
  }
  out.sort((a, b) => new Date(b.run_at) - new Date(a.run_at));
  return limit ? out.slice(0, limit) : out;
}

export function aggregateStats({ runId = 'latest' } = {}) {
  const store = loadHistory();
  let runs = store.runs;
  if (runId === 'latest') runs = runs.length ? [runs[runs.length - 1]] : [];
  else if (runId !== 'all') runs = runs.filter(r => r.id === runId);

  const byVerdict = {};
  const byTool = {};
  let total = 0;
  let scoreSum = 0;

  for (const run of runs) {
    for (const row of run.row_comparisons || []) {
      total += 1;
      const score = Number(row.evaluation?.score) || 0;
      scoreSum += score;
      const v = row.evaluation?.verdict || 'unknown';
      byVerdict[v] = (byVerdict[v] || 0) + 1;
      const tool = row.ai_tool || 'Unknown';
      byTool[tool] = byTool[tool] || { count: 0, scoreSum: 0 };
      byTool[tool].count += 1;
      byTool[tool].scoreSum += score;
    }
  }

  const toolAvg = {};
  for (const [tool, v] of Object.entries(byTool)) {
    toolAvg[tool] = { count: v.count, avg_score: Math.round(v.scoreSum / v.count) };
  }

  return {
    run_count: runs.length,
    evaluation_count: total,
    average_score: total ? Math.round(scoreSum / total) : 0,
    by_verdict: byVerdict,
    by_tool: toolAvg,
    latest_run_at: store.runs.length ? store.runs[store.runs.length - 1].generated_at : null,
  };
}
