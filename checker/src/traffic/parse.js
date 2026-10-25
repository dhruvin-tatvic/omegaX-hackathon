const META_LABEL = 'SYNTHETIC DEMO DATA';

function collapse(value) {
  return String(value ?? '').trim();
}

function parseCsvLine(line) {
  const out = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((cell) => collapse(cell));
}

function detectFormat(text, hinted) {
  const hint = String(hinted || 'auto').toLowerCase();
  if (hint === 'csv' || hint === 'jsonl' || hint === 'json') return hint === 'json' ? 'jsonl' : hint;
  const first = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!first) return 'jsonl';
  if (first.startsWith('{') || first.startsWith('[')) return 'jsonl';
  if (/,/.test(first) && /user[_-]?agent|ua|path|status/i.test(first)) return 'csv';
  return 'jsonl';
}

function toStatus(value) {
  const num = Number(value);
  return Number.isInteger(num) && num >= 100 && num <= 599 ? num : null;
}

function toTimestamp(value) {
  if (value == null || value === '') return null;
  const ms = Date.parse(String(value));
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

function normalizeRow(raw, lineNumber) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Row is not an object', line: lineNumber, raw };
  }
  if (raw.record_type === 'meta' || raw._comment) {
    return {
      ok: true,
      meta: true,
      synthetic: Boolean(raw.synthetic) || String(raw.label || raw._comment || '').includes(META_LABEL),
      label: collapse(raw.label || raw._comment || '') || null,
    };
  }
  const path = collapse(raw.path || raw.url || raw.request);
  const status = toStatus(raw.status ?? raw.status_code ?? raw.code);
  if (!path) {
    return { ok: false, error: 'Missing path', line: lineNumber, raw };
  }
  if (status == null) {
    return { ok: false, error: 'Invalid or missing status code', line: lineNumber, raw };
  }
  return {
    ok: true,
    meta: false,
    row: {
      ts: toTimestamp(raw.ts || raw.time || raw.timestamp),
      ip: collapse(raw.ip || raw.client_ip || raw.remote_addr) || 'unknown',
      method: collapse(raw.method || 'GET').toUpperCase() || 'GET',
      path,
      status,
      bytes: raw.bytes == null || raw.bytes === '' ? null : Number(raw.bytes),
      user_agent: collapse(raw.user_agent || raw.ua || raw.useragent),
      referer: collapse(raw.referer || raw.referrer) || null,
      line: lineNumber,
    },
  };
}

function parseJsonl(text) {
  const rows = [];
  const rejected = [];
  let synthetic = false;
  let label = null;
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      rejected.push({ line: index + 1, error: 'Malformed JSON', raw: trimmed.slice(0, 180) });
      return;
    }
    const result = normalizeRow(parsed, index + 1);
    if (!result.ok) {
      rejected.push(result);
      return;
    }
    if (result.meta) {
      if (result.synthetic) synthetic = true;
      if (result.label) label = result.label;
      return;
    }
    rows.push(result.row);
  });
  return { rows, rejected, synthetic, label, format: 'jsonl' };
}

function parseCsv(text) {
  const rows = [];
  const rejected = [];
  const lines = String(text || '').split(/\r?\n/);
  let header = null;
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const cells = parseCsvLine(trimmed);
    if (!header) {
      header = cells.map((cell) => cell.toLowerCase().replace(/[\s-]+/g, '_'));
      return;
    }
    if (cells.length === 1 && cells[0].includes(META_LABEL)) {
      return;
    }
    const raw = {};
    header.forEach((key, i) => {
      raw[key] = cells[i];
    });
    const result = normalizeRow(raw, index + 1);
    if (!result.ok) rejected.push(result);
    else if (!result.meta) rows.push(result.row);
  });
  return { rows, rejected, synthetic: false, label: null, format: 'csv' };
}

export function parseAccessLog(text, { format = 'auto' } = {}) {
  const chosen = detectFormat(text, format);
  const parsed = chosen === 'csv' ? parseCsv(text) : parseJsonl(text);
  return {
    ...parsed,
    format: chosen,
    row_count: parsed.rows.length,
  };
}

export { META_LABEL };
