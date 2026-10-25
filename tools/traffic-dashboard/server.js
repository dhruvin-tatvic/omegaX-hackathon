import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchServiceLogs } from './lib/render-logs.js';
import * as store from './lib/log-store.js';
import { loadDashboardEnv, paths } from './lib/load-env.mjs';
import { seedFromEvidenceFile, DEFAULT_EVIDENCE } from './lib/seed-evidence-logs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadDashboardEnv();

const app = express();

const PORT = Number(process.env.DASHBOARD_PORT) || 3456;
const POLL_MS = Number(process.env.POLL_INTERVAL_MS) || 8000;
const LOG_WINDOW_HOURS = Number(process.env.LOG_WINDOW_HOURS) || 2;
const SERVER_BUILD = '2026-10-25-v15-traffic-overview';
let dataSource = 'none';

const config = {
  apiKey: (process.env.RENDER_API_KEY || '').trim(),
  serviceId: (process.env.RENDER_SERVICE_ID || '').trim(),
  ownerId: (process.env.RENDER_OWNER_ID || '').trim(),
  siteUrl: (process.env.TARGET_SITE_URL || 'https://omegax-hackathon.onrender.com').trim(),
};

let lastPollAt = null;
let lastPollError = null;
let lastFetchMeta = null;
let polling = false;
let pollTick = 0;

store.setLogWindowHours(LOG_WINDOW_HOURS);
/** @type {Set<import('http').ServerResponse>} */
const sseClients = new Set();

function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

async function pollRender({ fullSync = false } = {}) {
  if (!config.apiKey || !config.serviceId) {
    lastPollError = 'Set RENDER_API_KEY and RENDER_SERVICE_ID in tools/traffic-dashboard/.env';
    return;
  }
  if (polling) return;
  polling = true;
  try {
    const result = await fetchServiceLogs({
      apiKey: config.apiKey,
      serviceId: config.serviceId,
      ownerId: config.ownerId || undefined,
      hours: LOG_WINDOW_HOURS,
      limit: 200,
      paginate: fullSync,
    });
    const added = store.ingestRenderLogs(result.logs);
    dataSource = 'render';
    lastPollAt = new Date().toISOString();
    lastPollError = null;
    lastFetchMeta = {
      pagesFetched: result.pagesFetched ?? 1,
      rawLines: result.logs.length,
      windowStart: result.windowStart,
      windowEnd: result.windowEnd,
      fullSync,
    };
    broadcast('update', {
      added: added.length,
      stats: store.getStats(),
      meta: lastFetchMeta,
    });
  } catch (err) {
    lastPollError = err instanceof Error ? err.message : String(err);
    broadcast('error', { message: lastPollError });
  } finally {
    polling = false;
  }
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

app.use(express.json());

app.use('/api', (_req, res, next) => {
  res.setHeader('X-Dashboard-Build', SERVER_BUILD);
  next();
});

app.get('/api/health', (_req, res) => {
  res.type('application/json').send(JSON.stringify({ ok: true, build: SERVER_BUILD }));
});

app.get('/api/version', (_req, res) => {
  res.json({
    build: SERVER_BUILD,
    logWindowHours: LOG_WINDOW_HOURS,
    features: ['traffic-overview'],
    siteUrl: config.siteUrl,
  });
});

app.get('/api/status', (_req, res) => {
  const envPath = path.join(__dirname, '.env');
  const body = {
    configured: Boolean(config.apiKey && config.serviceId),
    envFilePath: envPath,
    envFileExists: fs.existsSync(envPath),
    serviceId: config.serviceId ? `${config.serviceId.slice(0, 12)}...` : null,
    hasOwnerId: Boolean(config.ownerId),
    lastPollAt,
    lastPollError,
    pollIntervalMs: POLL_MS,
    logWindowHours: LOG_WINDOW_HOURS,
    build: SERVER_BUILD,
    lastFetch: lastFetchMeta,
    stats: store.getStats(),
    siteUrl: config.siteUrl,
    dataSource,
  };
  res.type('application/json').send(JSON.stringify(body, null, 2));
});

app.get('/api/stats', (_req, res) => {
  res.type('application/json').send(JSON.stringify(store.getStats(), null, 2));
});

app.get('/api/logs', (req, res) => {
  const filter = req.query.filter || 'all';
  const limit = Math.min(Number(req.query.limit) || 150, 500);
  res.json({
    entries: store.listEntries({ filter, limit }),
    stats: store.getStats(),
  });
});

app.post('/api/refresh', async (_req, res) => {
  if (config.apiKey && config.serviceId) {
    await pollRender({ fullSync: true });
  } else {
    startEvidenceMode();
  }
  res.json({
    stats: store.getStats(),
    lastPollAt,
    lastPollError,
    lastFetch: lastFetchMeta,
  });
});

app.post('/api/clear', (_req, res) => {
  store.clearStore();
  broadcast('update', { added: 0, stats: store.getStats(), entries: [] });
  res.json({ ok: true });
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: hello\ndata: ${JSON.stringify({ stats: store.getStats() })}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.use(express.static(path.join(__dirname, 'public')));

function startEvidenceMode() {
  const evidencePath = process.env.EVIDENCE_LOGS_PATH || DEFAULT_EVIDENCE;
  const result = seedFromEvidenceFile(evidencePath);
  if (result.ok) {
    dataSource = 'evidence';
    lastPollAt = new Date().toISOString();
    lastPollError = null;
    lastFetchMeta = {
      pagesFetched: 1,
      rawLines: result.lines,
      windowStart: store.getStats().windowFrom,
      windowEnd: store.getStats().windowTo,
      fullSync: true,
      evidenceFile: result.path,
    };
    console.log(`[evidence] Loaded ${result.ingested} access lines from team export.`);
    broadcast('update', { added: result.ingested, stats: store.getStats(), meta: lastFetchMeta });
  } else {
    lastPollError = result.reason;
    console.warn(result.reason);
  }
}

app.listen(PORT, () => {
  console.log(`Traffic dashboard: http://localhost:${PORT}`);
  const envPath = path.join(__dirname, '.env');
  if (!config.apiKey || !config.serviceId) {
    console.warn(`Render API not configured (${envPath} empty or missing keys).`);
    console.warn('Using sample evidence logs until RENDER_API_KEY + RENDER_SERVICE_ID are saved.');
    startEvidenceMode();
  } else {
    dataSource = 'render';
    console.log(`Render service: ${config.serviceId}`);
    console.log(`Loaded config from: ${envPath}`);
    pollRender({ fullSync: true });
    setInterval(() => {
      pollTick += 1;
      const fullSync = pollTick % 4 === 0;
      pollRender({ fullSync });
    }, POLL_MS);
  }
});
