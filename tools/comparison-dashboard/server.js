import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateStats,
  flattenRows,
  getRun,
  importLatestReportIfNew,
  listRuns,
} from './lib/history-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, 'public');
const PORT = Number(process.env.COMPARISON_DASHBOARD_PORT) || 3457;

importLatestReportIfNew();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function serveStatic(req, res) {
  let urlPath = req.url?.split('?')[0] || '/';
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC, urlPath));
  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = req.url?.split('?')[0] || '/';

  if (url === '/api/runs' && req.method === 'GET') {
    return sendJson(res, 200, { runs: listRuns() });
  }

  const runMatch = url.match(/^\/api\/runs\/([^/]+)$/);
  if (runMatch && req.method === 'GET') {
    const run = getRun(runMatch[1]);
    if (!run) return sendJson(res, 404, { error: 'Run not found' });
    return sendJson(res, 200, run);
  }

  if (url === '/api/overview' && req.method === 'GET') {
    const qRunId = new URL(req.url || '/', `http://${req.headers.host}`).searchParams.get('runId') || 'latest';
    return sendJson(res, 200, {
      stats: aggregateStats({ runId: qRunId }),
      rows: flattenRows({ runId: qRunId, limit: 1000 }),
      runs: listRuns(),
    });
  }

  if (url === '/api/import-latest' && req.method === 'POST') {
    const result = importLatestReportIfNew();
    return sendJson(res, 200, {
      ...result,
      stats: aggregateStats({ runId: 'latest' }),
      runs: listRuns(),
    });
  }

  if (req.method === 'GET') return serveStatic(req, res);
  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(PORT, () => {
  console.log(`LLM comparison dashboard: http://localhost:${PORT}`);
});
