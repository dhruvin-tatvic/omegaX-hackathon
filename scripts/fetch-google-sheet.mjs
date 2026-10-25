/**
 * Fetch a Google Sheet and save as JSON under data/.
 *
 *   node scripts/fetch-google-sheet.mjs "https://docs.google.com/spreadsheets/d/.../edit#gid=0"
 *   node scripts/fetch-google-sheet.mjs --csv path/to/export.csv
 *
 * Env (optional, for API when CSV export is blocked):
 *   GOOGLE_SHEETS_API_KEY — Google Cloud API key with Sheets API enabled
 *
 * The sheet must be shared: Anyone with the link → Viewer (or use --csv after manual download).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_OUT = path.join(REPO_ROOT, 'data', 'apex_moto_sheet.json');

function loadEnvFile() {
  for (const envPath of [
    path.join(REPO_ROOT, 'scripts', 'apex-moto-facts', '.env'),
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

function parseSheetUrl(input) {
  const idMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) throw new Error('Could not parse spreadsheet ID from URL.');
  const gidMatch = input.match(/[#&?]gid=(\d+)/);
  return { spreadsheetId: idMatch[1], gid: gidMatch ? gidMatch[1] : '0' };
}

/** RFC-style CSV parse (quoted fields, commas). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

function rowsToRecords(table) {
  if (!table.length) return { headers: [], records: [] };
  const headers = table[0].map((h, idx) => {
    const name = String(h ?? '').trim();
    return name || `column_${idx + 1}`;
  });
  const records = table.slice(1).map(cells => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] != null ? String(cells[idx]).trim() : '';
    });
    return obj;
  });
  return { headers, records };
}

async function fetchCsvExport(spreadsheetId, gid) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
  const res = await fetch(url, { redirect: 'follow' });
  const text = await res.text();
  if (!res.ok || text.trimStart().startsWith('<!DOCTYPE')) {
    return { ok: false, status: res.status, url };
  }
  return { ok: true, text, url };
}

async function fetchViaApi(spreadsheetId, gid, apiKey) {
  const metaUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}` +
    `?fields=sheets(properties(sheetId,title))&key=${encodeURIComponent(apiKey)}`;
  const metaRes = await fetch(metaUrl);
  const meta = await metaRes.json();
  if (!metaRes.ok) {
    throw new Error(`Sheets API metadata failed (${metaRes.status}): ${meta.error?.message || metaRes.statusText}`);
  }
  const sheet = (meta.sheets || []).map(s => s.properties).find(p => String(p.sheetId) === String(gid))
    || meta.sheets?.[0]?.properties;
  if (!sheet?.title) throw new Error('Could not resolve sheet tab from spreadsheet metadata.');
  const range = encodeURIComponent(`${sheet.title}!A1:ZZ2000`);
  const valuesUrl =
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${encodeURIComponent(apiKey)}`;
  const valuesRes = await fetch(valuesUrl);
  const values = await valuesRes.json();
  if (!valuesRes.ok) {
    throw new Error(`Sheets API values failed (${valuesRes.status}): ${values.error?.message || valuesRes.statusText}`);
  }
  return { table: values.values || [], sheetTitle: sheet.title };
}

function buildPayload({ spreadsheetId, gid, sourceUrl, headers, records, sheetTitle }) {
  return {
    meta: {
      spreadsheet_id: spreadsheetId,
      gid,
      sheet_title: sheetTitle || null,
      source_url: sourceUrl,
      fetched_at: new Date().toISOString(),
      row_count: records.length,
      column_count: headers.length,
    },
    headers,
    rows: records,
  };
}

async function main() {
  loadEnvFile();
  const args = process.argv.slice(2);
  let outPath = DEFAULT_OUT;
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0) {
    outPath = path.resolve(args[outIdx + 1] || DEFAULT_OUT);
    args.splice(outIdx, 2);
  }

  const csvIdx = args.indexOf('--csv');
  if (csvIdx >= 0) {
    const csvPath = path.resolve(args[csvIdx + 1]);
    const text = fs.readFileSync(csvPath, 'utf8');
    const { headers, records } = rowsToRecords(parseCsv(text));
    const payload = buildPayload({
      spreadsheetId: null,
      gid: null,
      sourceUrl: csvPath,
      headers,
      records,
    });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Saved ${outPath} (${records.length} rows).`);
    return;
  }

  const sheetUrl = args[0] || 'https://docs.google.com/spreadsheets/d/1a6LsVbPdgr06nceg8KPVIqJdChlFXwRnS8uxshJLCH0/edit?gid=0#gid=0';
  const { spreadsheetId, gid } = parseSheetUrl(sheetUrl);
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  const csvAttempt = await fetchCsvExport(spreadsheetId, gid);
  if (csvAttempt.ok) {
    const { headers, records } = rowsToRecords(parseCsv(csvAttempt.text));
    const payload = buildPayload({
      spreadsheetId,
      gid,
      sourceUrl: csvAttempt.url,
      headers,
      records,
    });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Saved ${outPath} (${records.length} rows) via CSV export.`);
    return;
  }

  if (apiKey) {
    const { table, sheetTitle } = await fetchViaApi(spreadsheetId, gid, apiKey);
    const { headers, records } = rowsToRecords(table);
    const payload = buildPayload({
      spreadsheetId,
      gid,
      sourceUrl: sheetUrl,
      headers,
      records,
      sheetTitle,
    });
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`Saved ${outPath} (${records.length} rows) via Sheets API.`);
    return;
  }

  throw new Error(
    `Could not download sheet (HTTP ${csvAttempt.status}). Share the sheet as "Anyone with the link" → Viewer, ` +
      'or set GOOGLE_SHEETS_API_KEY, or export CSV and run: node scripts/fetch-google-sheet.mjs --csv your.csv',
  );
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
