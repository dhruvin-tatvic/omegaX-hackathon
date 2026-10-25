/**
 * Fetch Apex Moto factual data via Firecrawl (same flow as refreshFacts in Apps Script).
 *
 *   set FIRECRAWL_API_KEY=fc-...
 *   node scripts/apex-moto-facts/run.mjs
 *
 * Optional: BASE_URL=https://omegax-hackathon.onrender.com
 * Writes: data/apex_moto_facts.json, data/snapshots/, data/apex_moto_changes.json
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const {
  CONFIG,
  buildFacts_,
  diffFacts_,
  parseLineup_,
  parseModelPage_,
} = require('./apex-moto-facts.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(REPO_ROOT, 'data');

function loadEnvFile() {
  const candidates = [
    path.join(__dirname, '.env'),
    path.join(REPO_ROOT, 'scripts', '.env'),
    path.join(REPO_ROOT, '.env'),
  ];
  const envPath = candidates.find(p => fs.existsSync(p));
  if (!envPath) return;
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

function formatScrapedAt(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const get = type => parts.find(p => p.type === type)?.value ?? '';
  const offset = get('timeZoneName').replace('GMT', '').replace('UTC', '') || '+00:00';
  const off = offset === '' ? '+00:00' : offset;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${off}`;
}

function snapshotDate(runAt, timeZone) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(runAt);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeOne(url, apiKey) {
  const res = await fetch(CONFIG.FIRECRAWL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown'],
      onlyMainContent: true,
      maxAge: 0,
      waitFor: url.endsWith('.pdf') ? 0 : 3000,
      timeout: 55000,
    }),
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* not JSON */
  }
  if (res.ok && body?.success && body?.data?.markdown) {
    return { ok: true, markdown: body.data.markdown };
  }
  return {
    ok: false,
    code: res.status,
    msg: body?.error || body?.message || res.statusText,
  };
}

async function scrapeMany(urls, apiKey, opts = {}) {
  const batchSize = opts.batchSize ?? CONFIG.BATCH_SIZE;
  const maxRetries = opts.maxRetries ?? CONFIG.MAX_RETRIES;
  const batchDelayMs = opts.batchDelayMs ?? 2500;
  const pages = {};
  let pending = urls.slice();
  let failed = [];

  for (let attempt = 1; attempt <= maxRetries && pending.length; attempt++) {
    failed = [];
    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(u => scrapeOne(u, apiKey)));
      results.forEach((r, j) => {
        if (r.ok) pages[batch[j]] = r.markdown;
        else failed.push({ url: batch[j], code: r.code, msg: r.msg });
      });
      if (i + batchSize < pending.length) await sleep(batchDelayMs);
    }
    pending = failed.map(f => f.url);
    if (pending.length && attempt < maxRetries) {
      const rateLimited = failed.some(f => f.code === 429);
      await sleep(rateLimited ? 35000 * attempt : 10000 * attempt);
    }
  }
  return { pages, failed };
}

function failureError(failed) {
  return new Error(
    'Not updated. Failed: ' + failed.map(f => f.url + (f.code ? ` (${f.code})` : '')).join(', '),
  );
}

function saveFactsLocal(facts, runAt, timeZone) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const latestPath = path.join(OUT_DIR, CONFIG.LATEST_FILE);
  let previous = null;
  if (fs.existsSync(latestPath)) {
    try {
      previous = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    } catch {
      previous = null;
    }
  }
  const changes = previous ? diffFacts_(previous, facts) : [];
  facts.meta.changes_since_previous = previous ? changes.length : null;
  const body = JSON.stringify(facts, null, 2);

  fs.writeFileSync(latestPath, body, 'utf8');

  if (CONFIG.KEEP_SNAPSHOTS) {
    const snapsDir = path.join(OUT_DIR, 'snapshots');
    fs.mkdirSync(snapsDir, { recursive: true });
    const snapName = `apex_moto_facts_${snapshotDate(runAt, timeZone)}.json`;
    fs.writeFileSync(path.join(snapsDir, snapName), body, 'utf8');
  }

  const logPath = path.join(OUT_DIR, CONFIG.CHANGES_FILE);
  let entries = [];
  if (fs.existsSync(logPath)) {
    try {
      entries = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    } catch {
      entries = [];
    }
  }
  entries.push({
    run_at: facts.meta.scraped_at,
    baseline: !previous,
    change_count: changes.length,
    changes,
  });
  fs.writeFileSync(logPath, JSON.stringify(entries, null, 2), 'utf8');

  return { changes, latestPath };
}

async function refreshFacts() {
  loadEnvFile();
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('Set FIRECRAWL_API_KEY in the environment or scripts/apex-moto-facts/.env');
  }

  const baseUrl = (process.env.BASE_URL || CONFIG.BASE_URL).replace(/\/$/, '');
  CONFIG.BASE_URL = baseUrl;
  CONFIG.BATCH_SIZE = Number(process.env.FIRECRAWL_BATCH_SIZE) || 2;
  CONFIG.MAX_RETRIES = Number(process.env.FIRECRAWL_MAX_RETRIES) || 6;
  const modelBatch = { batchSize: 1, batchDelayMs: 4000, maxRetries: CONFIG.MAX_RETRIES };

  const started = new Date();
  const timeZone = CONFIG.TIMEZONE;

  console.log(`Scraping ${baseUrl} via Firecrawl…`);

  await scrapeMany([`${baseUrl}/`], apiKey);

  const res = await scrapeMany(CONFIG.PAGES.map(p => baseUrl + p), apiKey);
  if (res.failed.length) throw failureError(res.failed);

  const lineup = parseLineup_(res.pages[`${baseUrl}/motorcycles`]);
  if (!lineup.models.length) throw new Error('Not updated: no models parsed from /motorcycles.');

  const modelUrls = lineup.models.map(m => `${baseUrl}/motorcycles/${m.slug}`);
  const modelRes = await scrapeMany(modelUrls, apiKey, modelBatch);
  if (modelRes.failed.length) throw failureError(modelRes.failed);

  const brochureUrls = [];
  for (const card of lineup.models) {
    const md = modelRes.pages[`${baseUrl}/motorcycles/${card.slug}`] || '';
    const p = parseModelPage_(md, card.slug);
    if ((!p.specs.length || !Object.keys(p.onroad).length || !p.variants.length) && p.brochure) {
      brochureUrls.push(p.brochure);
    }
  }
  const brochurePages = {};
  if (brochureUrls.length) {
    const broRes = await scrapeMany([...new Set(brochureUrls)], apiKey);
    if (broRes.failed.length) throw failureError(broRes.failed);
    Object.assign(brochurePages, broRes.pages);
  }

  const scrapedAt = formatScrapedAt(started, timeZone);
  const facts = buildFacts_(
    res.pages,
    modelRes.pages,
    lineup,
    url => brochurePages[url] || null,
    scrapedAt,
  );

  const result = saveFactsLocal(facts, started, timeZone);
  console.log(`Saved ${result.latestPath} (${result.changes.length} change(s) vs previous).`);
}

refreshFacts().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
