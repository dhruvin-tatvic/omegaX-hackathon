import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(rootDir, '.env') });

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function resolveCheckerPath(relativePath) {
  if (path.isAbsolute(relativePath)) return relativePath;
  return path.join(rootDir, relativePath);
}

function defaultPacks(defaults) {
  if (defaults.packs && Object.keys(defaults.packs).length) return defaults.packs;
  return {
    demo: {
      label: 'Acme Pump demo',
      questions: defaults.paths.questions,
      reference: defaults.paths.reference,
    },
  };
}

export function resolvePackId(rawPackId, packs) {
  const packId = String(rawPackId || 'demo').trim().toLowerCase() || 'demo';
  if (!packs[packId]) {
    const allowed = Object.keys(packs).join(', ');
    throw new Error(`Unknown CHECKER_PACK "${packId}". Allowed: ${allowed}`);
  }
  return packId;
}

export function loadConfig(envOverrides = {}) {
  const defaults = readJson(path.join(rootDir, 'config/default.json'));
  const env = { ...process.env, ...envOverrides };
  const packs = defaultPacks(defaults);
  const packId = resolvePackId(env.CHECKER_PACK, packs);
  const pack = packs[packId];
  const packSelected = Boolean(String(env.CHECKER_PACK || '').trim());
  const questionsPath = packSelected
    ? pack.questions
    : env.QUESTIONS_PATH || pack.questions || defaults.paths.questions;
  const referencePath = packSelected
    ? pack.reference
    : env.REFERENCE_PATH || pack.reference || defaults.paths.reference;
  const runsPath = defaults.paths.runs;

  const target = {
    ...defaults.target,
    base_url: (env.TARGET_BASE_URL || defaults.target.base_url).replace(/\/$/, ''),
  };

  return {
    rootDir,
    packId,
    packLabel: pack.label || packId,
    target,
    limits: defaults.limits,
    crawl: defaults.crawl || {},
    paths: {
      questions: resolveCheckerPath(questionsPath),
      reference: resolveCheckerPath(referencePath),
      runs: resolveCheckerPath(runsPath),
    },
    openai: {
      apiKey: env.OPENAI_API_KEY || '',
      model: env.OPENAI_MODEL || 'gpt-4o-mini',
      baseUrl: (env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    },
    port: Number(env.PORT || 8787),
  };
}

export function loadQuestions(config = loadConfig()) {
  return readJson(config.paths.questions);
}

export function loadReference(config = loadConfig()) {
  return readJson(config.paths.reference);
}

export { rootDir };
