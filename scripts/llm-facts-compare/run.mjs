/**
 * Compare LLM responses (apex_moto_sheet.json) against scraped facts (apex_moto_facts.json)
 * using the OmegaX Comparison LLM (Groq).
 *
 *   node scripts/llm-facts-compare/run.mjs
 *
 * Env: GROQ_API_KEY, optional GROQ_MODEL, GROQ_COMPARE_TEMPERATURE
 * Output: data/llm_comparison_report.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGroundTruthPackage, extractInrMentions, classifyIntent } from './ground-truth.js';
import { ROW_SYSTEM, SYNTHESIS_SYSTEM } from './prompts.js';
import { buildDeterministicGapAnalysis, mergeGapAnalysis } from './gap-synthesis.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const FACTS_PATH = path.join(REPO_ROOT, 'data', 'apex_moto_facts.json');
const SHEET_PATH = path.join(REPO_ROOT, 'data', 'apex_moto_sheet.json');
const OUT_PATH = path.join(REPO_ROOT, 'data', 'llm_comparison_report.json');

const { appendRun } = await import('../../tools/comparison-dashboard/lib/history-store.js');
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';
const ROW_TEMP = Number(process.env.GROQ_COMPARE_TEMPERATURE) || 0.08;
const SYNTH_TEMP = Number(process.env.GROQ_SYNTHESIS_TEMPERATURE) || 0.12;
const ROW_DELAY_MS = Number(process.env.GROQ_ROW_DELAY_MS) || 10000;

function loadEnvFile() {
  for (const envPath of [
    path.join(REPO_ROOT, 'scripts', 'apex-moto-facts', '.env'),
    path.join(REPO_ROOT, 'scripts', 'llm-facts-compare', '.env'),
    path.join(REPO_ROOT, 'scripts', '.env'),
    path.join(REPO_ROOT, '.env'),
  ]) {
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null) process.env[key] = val;
    }
  }
}

function parseJsonContent(content) {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(content.slice(start, end + 1));
    throw new Error('Could not parse JSON from model output');
  }
}

async function groqChat(apiKey, messages, { json = true, temperature = 0.1 } = {}) {
  const attempts = [
    { jsonMode: true, temperature },
    { jsonMode: false, temperature: Math.min(temperature, 0.1) },
  ];

  for (let round = 0; round < attempts.length; round++) {
    const { jsonMode, temperature: temp } = attempts[round];
    const body = { model: DEFAULT_MODEL, messages, temperature: temp };
    if (jsonMode && json) body.response_format = { type: 'json_object' };

    for (let attempt = 1; attempt <= 6; attempt++) {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const content = data.choices?.[0]?.message?.content;
        if (!content) throw new Error('Empty Groq response');
        return json ? parseJsonContent(content) : content;
      }
      const retryable = res.status === 429 || res.status === 413 || res.status === 400;
      const waitSec = data.error?.message?.match(/try again in ([\d.]+)s/i)?.[1];
      const waitMs = waitSec ? Math.ceil(parseFloat(waitSec) * 1000) + 500 : 12000 * attempt;
      if (!retryable || attempt === 6) break;
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  throw new Error('Groq request failed after retries');
}

function normalizeEvaluation(raw, groundTruth) {
  const e = { ...raw };
  if (!e.question_intent) e.question_intent = groundTruth.question_intent;
  if (!Array.isArray(e.mapped_comparisons)) e.mapped_comparisons = [];
  if (!Array.isArray(e.claims)) e.claims = [];
  if (!Array.isArray(e.missing_from_answer)) e.missing_from_answer = [];
  if (!Array.isArray(e.factual_errors)) e.factual_errors = [];
  if (!Array.isArray(e.access_or_visibility_issues)) e.access_or_visibility_issues = [];
  if (!e.primary_gap && e.factual_errors[0]) e.primary_gap = e.factual_errors[0];
  if (!e.site_fix_hint) e.site_fix_hint = '';
  const score = Math.max(0, Math.min(100, Math.round(Number(e.score) || 0)));
  e.score = score;
  const v = e.verdict;
  if (!['correct', 'partially_correct', 'incorrect', 'refusal_or_unknown'].includes(v)) {
    if (score >= 90) e.verdict = 'correct';
    else if (score >= 40) e.verdict = 'partially_correct';
    else if (v === 'refusal_or_unknown') e.verdict = 'refusal_or_unknown';
    else e.verdict = 'incorrect';
  }
  return e;
}

async function compareRow(apiKey, facts, row, index) {
  const groundTruth = buildGroundTruthPackage(facts, row.Input || '', row.Output || '');
  const aiInrMentions = extractInrMentions(row.Output || '');

  const user = JSON.stringify({
    row_index: index,
    ai_tool: row['AI Tool'],
    user_question: String(row.Input || '').slice(0, 2000),
    ai_answer: String(row.Output || '').slice(0, 4000),
    deterministic_hints: {
      inr_amounts_in_ai_answer: aiInrMentions,
      intent: groundTruth.question_intent,
      models_in_ground_truth: (groundTruth.models || []).map(m => m.slug || m.name),
    },
    ground_truth: groundTruth,
  });

  const result = normalizeEvaluation(
    await groqChat(apiKey, [
      { role: 'system', content: ROW_SYSTEM },
      { role: 'user', content: user },
    ], { temperature: ROW_TEMP }),
    groundTruth,
  );

  return {
    row_index: index,
    ai_tool: row['AI Tool'],
    input: row.Input,
    output_preview: String(row.Output || '').slice(0, 280) + (row.Output.length > 280 ? '…' : ''),
    ground_truth_scope: {
      question_intent: groundTruth.question_intent,
      cities: groundTruth.cities_mentioned,
      models_included: (groundTruth.models || []).map(m => m.name || m.slug),
      catalogue_lowest: groundTruth.catalogue_summary?.lowest_price_model?.name,
    },
    evaluation: result,
  };
}

async function synthesize(apiKey, factsMeta, comparisons) {
  const deterministic = buildDeterministicGapAnalysis(comparisons, factsMeta);
  const mode = (process.env.GROQ_SYNTHESIS_MODE || 'hybrid').toLowerCase();
  if (mode === 'deterministic') return deterministic;

  const rowAudits = comparisons.map(c => ({
    row_index: c.row_index,
    ai_tool: c.ai_tool,
    question_intent: c.ground_truth_scope?.question_intent,
    verdict: c.evaluation?.verdict,
    score: c.evaluation?.score,
    primary_gap: c.evaluation?.primary_gap,
    factual_errors: (c.evaluation?.factual_errors || []).slice(0, 3),
    access_or_visibility_issues: (c.evaluation?.access_or_visibility_issues || []).slice(0, 2),
  }));

  try {
    const llmRaw = await groqChat(apiKey, [
      { role: 'system', content: SYNTHESIS_SYSTEM },
      {
        role: 'user',
        content: JSON.stringify({ draft: deterministic, row_audits: rowAudits, facts_meta: factsMeta }),
      },
    ], { temperature: SYNTH_TEMP });
    return mergeGapAnalysis(deterministic, llmRaw, comparisons);
  } catch (err) {
    console.warn('Synthesis LLM polish failed, using deterministic gap analysis:', err.message || err);
    return deterministic;
  }
}

async function main() {
  loadEnvFile();
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Set GROQ_API_KEY in scripts/apex-moto-facts/.env or environment.');
  }

  const facts = JSON.parse(fs.readFileSync(FACTS_PATH, 'utf8'));
  const synthesisOnly = process.argv.includes('--synthesis-only');

  if (synthesisOnly) {
    if (!fs.existsSync(OUT_PATH)) throw new Error(`No report at ${OUT_PATH}; run full compare first.`);
    const report = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
    const comparisons = report.row_comparisons || [];
    if (!comparisons.length) throw new Error('Report has no row_comparisons.');
    console.log('Rebuilding gap analysis from existing row audits…');
    const synthesis = await synthesize(apiKey, facts.meta, comparisons);
    report.gap_analysis = synthesis;
    report.meta = {
      ...report.meta,
      generated_at: new Date().toISOString(),
      pipeline: 'omegax-comparison-llm-v2.1',
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf8');
    const hist = appendRun(report);
    console.log(`Saved ${OUT_PATH}`);
    if (hist.added) console.log(`Appended run ${hist.id} to comparison history.`);
    return;
  }

  const sheet = JSON.parse(fs.readFileSync(SHEET_PATH, 'utf8'));
  const rows = sheet.rows || [];
  if (!rows.length) throw new Error('No rows in apex_moto_sheet.json');

  console.log(`OmegaX Comparison LLM: ${rows.length} rows (Groq ${DEFAULT_MODEL}, temp ${ROW_TEMP})…`);

  const comparisons = [];
  for (let i = 0; i < rows.length; i++) {
    console.log(`  [${i + 1}/${rows.length}] ${rows[i]['AI Tool']} (${classifyIntent(rows[i].Input || '')})…`);
    comparisons.push(await compareRow(apiKey, facts, rows[i], i));
    if (i < rows.length - 1) await new Promise(r => setTimeout(r, ROW_DELAY_MS));
  }

  console.log('Synthesizing gap analysis and recommendations…');
  const synthesis = await synthesize(apiKey, facts.meta, comparisons);

  const report = {
    meta: {
      generated_at: new Date().toISOString(),
      facts_source: facts.meta.source,
      facts_scraped_at: facts.meta.scraped_at,
      sheet_source: sheet.meta?.source_url,
      groq_model: DEFAULT_MODEL,
      compare_temperature: ROW_TEMP,
      pipeline: 'omegax-comparison-llm-v2.1',
      site_url: 'https://omegax-hackathon.onrender.com/',
    },
    row_comparisons: comparisons,
    gap_analysis: synthesis,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2), 'utf8');
  const hist = appendRun(report);
  console.log(`Saved ${OUT_PATH}`);
  if (hist.added) console.log(`Appended run ${hist.id} to comparison history.`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
