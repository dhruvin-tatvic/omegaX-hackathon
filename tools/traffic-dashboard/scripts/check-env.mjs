import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadDashboardEnv, paths } from '../lib/load-env.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

loadDashboardEnv();

const key = (process.env.RENDER_API_KEY || '').trim();
const svc = (process.env.RENDER_SERVICE_ID || '').trim();

if (key && svc) {
  if (!svc.startsWith('srv-')) {
    console.error('\nRENDER_SERVICE_ID must start with srv- (web service id).\n');
    process.exit(1);
  }
  console.log(`[check-env] OK — Render service ${svc}`);
  process.exit(0);
}

const evidencePath = process.env.EVIDENCE_LOGS_PATH || path.join(paths.repoRoot, 'docs', 'evidence', 'render-llm-access-logs-2026-10-25.txt');
if (fs.existsSync(evidencePath)) {
  console.warn('[check-env] Render keys missing — starting in evidence demo mode (sample logs).');
  console.warn(`[check-env] Save RENDER_API_KEY + RENDER_SERVICE_ID in ${path.join(root, '.env')} for live data.\n`);
  process.exit(0);
}

console.error('\nMissing Render configuration.');
console.error(`Create or save: ${path.join(root, '.env')}`);
console.error('  RENDER_API_KEY=rnd_...');
console.error('  RENDER_SERVICE_ID=srv-...  (not usr-...)\n');
process.exit(1);
