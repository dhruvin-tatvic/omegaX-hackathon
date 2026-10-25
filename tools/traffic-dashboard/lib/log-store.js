import { parseAccessLogLine } from './parse-access-log.js';
import { classifyTraffic } from './classify-traffic.js';

const MAX_ENTRIES = 8000;
let windowHours = 24;

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
