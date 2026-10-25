import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAccessLogLine } from './parse-access-log.js';
import * as store from './log-store.js';

const repoRoot = path.resolve(path.dirname(path.dirname(fileURLToPath(import.meta.url))), '../..');

export const DEFAULT_EVIDENCE = path.join(
  repoRoot,
  'docs',
  'evidence',
  'render-llm-access-logs-2026-10-25.txt',
);

/**
 * Load Morgan-style lines from team evidence export (demo when Render API is not configured).
 */
export function seedFromEvidenceFile(filePath = DEFAULT_EVIDENCE) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: `Evidence file not found: ${filePath}` };
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const base = Date.now() - 45 * 60 * 1000;
  const entries = [];
  let i = 0;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('==')) continue;
    if (!parseAccessLogLine(trimmed)) continue;
    entries.push({
      id: `evidence-${i}`,
      timestamp: new Date(base + i * 8000).toISOString(),
      message: trimmed,
    });
    i += 1;
  }
  const added = store.ingestRenderLogs(entries);
  return { ok: true, path: filePath, lines: entries.length, ingested: added.length };
}
