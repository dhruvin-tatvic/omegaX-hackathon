import { parseAccessLogLine } from './parse-access-log.js';
import { classifyTraffic, describeAiCrawler } from './classify-traffic.js';

const MAX_ENTRIES = 8000;
let windowHours = 2;

export function setLogWindowHours(hours) {
  windowHours = Math.max(1, Number(hours) || 24);
}

export function getLogWindowHours() {
  return windowHours;
}

function windowCutoff() {
  return new Date(Date.now() - windowHours * 60 * 60 * 1000);
}

function inWindow(row) {
  if (!row?.timestamp) return false;
  return new Date(row.timestamp) >= windowCutoff();
}

function pruneOutsideWindow() {
  const cutoff = windowCutoff();
  for (const [id, row] of byId.entries()) {
    if (new Date(row.timestamp) < cutoff) {
      byId.delete(id);
    }
  }
}

/** @type {Map<string, object>} */
const byId = new Map();

export function ingestRenderLogs(renderLogEntries) {
  const added = [];
  for (const entry of renderLogEntries) {
    const id = entry.id;
    if (!id || byId.has(id)) continue;

    const access = parseAccessLogLine(entry.message);
    if (!access) continue;

    const { kind, botLabel } = classifyTraffic(access.userAgent);
    const row = {
      id,
      timestamp: entry.timestamp,
      ...access,
      kind,
      botLabel,
      raw: entry.message,
    };
    if (!inWindow(row)) continue;

    byId.set(id, row);
    added.push(row);
  }

  pruneOutsideWindow();

  if (byId.size > MAX_ENTRIES) {
    const sorted = [...byId.entries()].sort((a, b) =>
      String(a[1].timestamp).localeCompare(String(b[1].timestamp))
    );
    const drop = sorted.length - MAX_ENTRIES;
    for (let i = 0; i < drop; i++) {
      byId.delete(sorted[i][0]);
    }
  }

  return added;
}

function rowsInWindow() {
  return [...byId.values()].filter(inWindow);
}

export function getStats() {
  let human = 0;
  let bot = 0;
  let unknown = 0;
  const botBreakdown = {};
  const rows = rowsInWindow();

  for (const row of rows) {
    if (row.kind === 'human') human += 1;
    else if (row.kind === 'bot') {
      bot += 1;
      const key = row.botLabel || 'Other';
      botBreakdown[key] = (botBreakdown[key] || 0) + 1;
    } else unknown += 1;
  }

  const cutoff = windowCutoff();
  return {
    total: rows.length,
    human,
    bot,
    unknown,
    botBreakdown,
    windowHours,
    windowFrom: cutoff.toISOString(),
    windowTo: new Date().toISOString(),
  };
}

export function listAllBotEntriesInWindow() {
  return rowsInWindow()
    .filter(r => r.kind === 'bot')
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

export function listEntries({ filter = 'all', limit = 150 } = {}) {
  let rows = rowsInWindow();
  if (filter === 'human') rows = rows.filter(r => r.kind === 'human');
  if (filter === 'bot') rows = rows.filter(r => r.kind === 'bot');
  if (filter === 'unknown') rows = rows.filter(r => r.kind === 'unknown');

  rows.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
  return rows.slice(0, limit);
}

export function clearStore() {
  byId.clear();
}

/**
 * AI / crawler activity aggregated from bot-classified access lines.
 * Note: HTTP logs never include the user's chat prompt — only User-Agent + URL.
 */
export function getAiCrawlerReport() {
  const botRows = rowsInWindow().filter(r => r.kind === 'bot');
  /** @type {Map<string, { provider: string, crawler: string, fetchType: string, count: number, paths: Map<string, number>, firstSeen: string, lastSeen: string, sampleUserAgent: string, ips: Set<string> }>} */
  const byCrawler = new Map();

  for (const row of botRows) {
    const desc = describeAiCrawler(row.userAgent);
    const provider = desc?.provider ?? row.botLabel ?? 'Other';
    const crawler = desc?.crawler ?? row.botLabel ?? 'Unknown';
    const fetchType = desc?.fetchType ?? 'Classified as bot';
    const key = `${provider}::${crawler}`;

    let rec = byCrawler.get(key);
    if (!rec) {
      rec = {
        provider,
        crawler,
        fetchType,
        count: 0,
        paths: new Map(),
        firstSeen: row.timestamp,
        lastSeen: row.timestamp,
        sampleUserAgent: row.userAgent,
        ips: new Set(),
      };
      byCrawler.set(key, rec);
    }
    rec.count += 1;
    rec.paths.set(row.path, (rec.paths.get(row.path) || 0) + 1);
    rec.ips.add(row.ip);
    if (String(row.timestamp) < String(rec.firstSeen)) rec.firstSeen = row.timestamp;
    if (String(row.timestamp) > String(rec.lastSeen)) rec.lastSeen = row.timestamp;
  }

  const providersMap = new Map();
  for (const rec of byCrawler.values()) {
    if (!providersMap.has(rec.provider)) {
      providersMap.set(rec.provider, { provider: rec.provider, totalRequests: 0, crawlers: [] });
    }
    const p = providersMap.get(rec.provider);
    p.totalRequests += rec.count;
    const paths = [...rec.paths.entries()]
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count);
    p.crawlers.push({
      crawler: rec.crawler,
      fetchType: rec.fetchType,
      requestCount: rec.count,
      uniquePaths: paths.length,
      topPaths: paths.slice(0, 15),
      firstSeen: rec.firstSeen,
      lastSeen: rec.lastSeen,
      uniqueIps: rec.ips.size,
      sampleUserAgent: rec.sampleUserAgent,
    });
  }

  const providers = [...providersMap.values()]
    .map(p => ({
      ...p,
      crawlers: p.crawlers.sort((a, b) => b.requestCount - a.requestCount),
    }))
    .sort((a, b) => b.totalRequests - a.totalRequests);

  const recent = botRows
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 200)
    .map(r => {
      const desc = describeAiCrawler(r.userAgent);
      return {
        timestamp: r.timestamp,
        provider: desc?.provider ?? r.botLabel,
        crawler: desc?.crawler ?? '—',
        fetchType: desc?.fetchType ?? '—',
        method: r.method,
        path: r.path,
        status: r.status,
        ip: r.ip,
        userAgent: r.userAgent,
      };
    });

  const stats = getStats();
  return {
    disclaimer:
      'Render access logs do not include chat prompts. When someone asks an LLM about your site, these rows show which AI-related crawler User-Agent fetched which URL and when.',
    windowHours: stats.windowHours,
    windowFrom: stats.windowFrom,
    windowTo: stats.windowTo,
    totalBotRequests: botRows.length,
    providerCount: providers.length,
    providers,
    recentFetches: recent,
  };
}
