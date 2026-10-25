import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from '../config.js';
import { sha256 } from './catalog.js';

const DEFAULT_ORIGINALS = path.join(rootDir, 'data/apply-demo/originals');
const DEFAULT_WORKING = path.join(rootDir, 'data/apply-demo/working');
const DEFAULT_CHANGELOG = path.join(rootDir, 'data/apply-demo/changelog.jsonl');

export function resolveApplyPaths(overrides = {}) {
  return {
    originalsDir: overrides.originalsDir || DEFAULT_ORIGINALS,
    workingDir: overrides.workingDir || DEFAULT_WORKING,
    changelogPath: overrides.changelogPath || DEFAULT_CHANGELOG,
  };
}

export function ensureWorkspace(paths) {
  fs.mkdirSync(paths.workingDir, { recursive: true });
  fs.mkdirSync(path.dirname(paths.changelogPath), { recursive: true });
  if (!fs.existsSync(paths.changelogPath)) {
    fs.writeFileSync(paths.changelogPath, '');
  }
  const originals = fs.readdirSync(paths.originalsDir).filter((name) => name.endsWith('.html'));
  for (const name of originals) {
    if (name.endsWith('.rendered.html')) continue;
    const dest = path.join(paths.workingDir, name);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(paths.originalsDir, name), dest);
    }
  }
  return paths;
}

export function assertAllowedFile(paths, filename) {
  const base = path.basename(String(filename || ''));
  if (!base || base !== filename || base.includes('..') || path.isAbsolute(filename)) {
    throw new Error('Only named files inside the isolated demo working directory can be changed.');
  }
  const originals = path.resolve(paths.originalsDir, base);
  const working = path.resolve(paths.workingDir, base);
  const originalsRoot = path.resolve(paths.originalsDir);
  const workingRoot = path.resolve(paths.workingDir);
  if (!working.startsWith(workingRoot + path.sep) || !originals.startsWith(originalsRoot + path.sep)) {
    throw new Error('Path is outside the isolated demo fixture directory.');
  }
  if (!fs.existsSync(originals)) {
    throw new Error(`Demo original ${base} is not in the allow-list.`);
  }
  return { base, originals, working };
}

export function readWorking(paths, filename) {
  const { working } = assertAllowedFile(paths, filename);
  return fs.readFileSync(working, 'utf8');
}

export function readOriginal(paths, filename) {
  const { originals } = assertAllowedFile(paths, filename);
  return fs.readFileSync(originals, 'utf8');
}

export function readRenderedOriginal(paths, filename) {
  const base = path.basename(String(filename || ''));
  const target = path.resolve(paths.originalsDir, base);
  const root = path.resolve(paths.originalsDir);
  if (!target.startsWith(root + path.sep) || !base.endsWith('.rendered.html')) {
    throw new Error('Rendered snapshots are read-only originals inside the demo fixture.');
  }
  return fs.readFileSync(target, 'utf8');
}

export function writeWorking(paths, filename, contents) {
  const { working } = assertAllowedFile(paths, filename);
  fs.writeFileSync(working, contents);
}

export function fileHash(contents) {
  return sha256(contents);
}

export function appendChangelog(paths, entry) {
  fs.appendFileSync(paths.changelogPath, `${JSON.stringify(entry)}\n`);
  return entry;
}

export function readChangelog(paths) {
  if (!fs.existsSync(paths.changelogPath)) return [];
  const text = fs.readFileSync(paths.changelogPath, 'utf8');
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
