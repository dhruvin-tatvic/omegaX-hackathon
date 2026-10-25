import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const dashboardRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(dashboardRoot, '../..');

/** Load first-seen values from dashboard .env, repo root .env, then process env. */
export function loadDashboardEnv() {
  const paths = [
    path.join(dashboardRoot, '.env'),
    path.join(repoRoot, '.env'),
    path.join(repoRoot, 'scripts', '.env'),
  ];
  for (const envPath of paths) {
    if (!fs.existsSync(envPath)) continue;
    dotenv.config({ path: envPath, override: false });
  }
}

export const paths = { dashboardRoot, repoRoot };
