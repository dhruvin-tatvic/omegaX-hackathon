import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { importGa4Export, ga4NotConnected } from './ga4.js';
import { buildTrafficReport } from './report.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const SYNTHETIC_LOG_PATH = path.join(rootDir, 'data/traffic/synthetic-demo.jsonl');

export function analyzeTraffic(options = {}) {
  return buildTrafficReport(options);
}

export function analyzeSyntheticDemo(ga4) {
  const text = fs.readFileSync(SYNTHETIC_LOG_PATH, 'utf8');
  return buildTrafficReport({
    text,
    format: 'jsonl',
    synthetic: true,
    source_label: 'SYNTHETIC DEMO DATA',
    ga4: ga4 || ga4NotConnected(),
  });
}

export { importGa4Export, ga4NotConnected };
