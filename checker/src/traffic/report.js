import { META_LABEL, parseAccessLog } from './parse.js';
import { classifyClients } from './classify.js';
import { ga4NotConnected } from './ga4.js';

const LIMITATIONS = [
  'Observed counts come only from parsed log rows. Rejected rows are listed separately.',
  'Crawler labels are inferences from user-agent patterns plus request behavior. User-agent substring alone is not treated as proof.',
  'A classified crawler visit does not mean an AI system used, quoted, or cited the page.',
  'GA4 referral/session/conversion joining is a separate seam and is not mixed into log facts.',
];

function countBy(values) {
  const out = {};
  for (const value of values) {
    const key = String(value);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

function pageStats(rows) {
  const byPath = new Map();
  for (const row of rows) {
    if (!byPath.has(row.path)) {
      byPath.set(row.path, { path: row.path, count: 0, statuses: {}, last_ts: null });
    }
    const item = byPath.get(row.path);
    item.count += 1;
    item.statuses[row.status] = (item.statuses[row.status] || 0) + 1;
    if (row.ts && (!item.last_ts || row.ts > item.last_ts)) item.last_ts = row.ts;
  }
  const pages = [...byPath.values()].sort((a, b) => b.count - a.count);
  const blocked_or_error_pages = pages
    .map((page) => {
      const errors = Object.entries(page.statuses)
        .filter(([status]) => Number(status) >= 400)
        .map(([status, count]) => ({ status: Number(status), count }));
      if (!errors.length) return null;
      return { path: page.path, count: page.count, errors, last_ts: page.last_ts };
    })
    .filter(Boolean);
  return { top_pages: pages.slice(0, 20), blocked_or_error_pages };
}

export function buildTrafficReport({ text, format = 'auto', synthetic = false, source_label, ga4 } = {}) {
  const parsed = parseAccessLog(text, { format });
  const isSynthetic = Boolean(synthetic || parsed.synthetic);
  const timestamps = parsed.rows.map((row) => row.ts).filter(Boolean).sort();
  const pages = pageStats(parsed.rows);
  const agents = classifyClients(parsed.rows);
  const ga4State = ga4 || ga4NotConnected();

  return {
    analyzed_at: new Date().toISOString(),
    source: {
      format: parsed.format,
      synthetic: isSynthetic,
      label: isSynthetic ? source_label || parsed.label || META_LABEL : source_label || 'Imported access log',
      row_count: parsed.row_count,
      rejected_count: parsed.rejected.length,
    },
    observed: {
      layer: 'observed_log_facts',
      request_count: parsed.rows.length,
      distinct_urls: new Set(parsed.rows.map((row) => row.path)).size,
      status_codes: countBy(parsed.rows.map((row) => row.status)),
      time_range: {
        start: timestamps[0] || null,
        end: timestamps[timestamps.length - 1] || null,
      },
      top_pages: pages.top_pages,
      blocked_or_error_pages: pages.blocked_or_error_pages,
      rejected_rows: parsed.rejected.map((row) => ({
        line: row.line,
        error: row.error,
        raw: typeof row.raw === 'string' ? row.raw : undefined,
      })),
    },
    inferences: {
      layer: 'heuristic_inferences',
      note: 'These labels are inferences. A crawler request is not evidence that an AI system used or cited the page.',
      agents,
    },
    ga4: ga4State,
    limitations: LIMITATIONS,
    data_classes: {
      logs: isSynthetic ? 'synthetic' : 'observed',
      ga4: ga4State.synthetic ? 'synthetic' : ga4State.status,
    },
  };
}
