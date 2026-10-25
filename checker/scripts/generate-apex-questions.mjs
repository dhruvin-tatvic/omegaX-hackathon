import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { questionsPackFromReference } from '../src/reference/fromCatalogue.js';

const checkerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referencePath = path.join(checkerRoot, 'data/reference/apex.json');
const outPath = path.join(checkerRoot, 'data/questions/apex.json');

const referencePack = JSON.parse(readFileSync(referencePath, 'utf8'));
if (!referencePack?.entities?.length) {
  throw new Error(`Reference pack at ${referencePath} has no entities`);
}

const pack = questionsPackFromReference(referencePack);
const kinds = new Set(pack.questions.map((question) => question.kind));
const requiredKinds = ['price', 'spec', 'variant', 'colour', 'availability', 'dealer', 'finance'];
const missing = requiredKinds.filter((kind) => !kinds.has(kind));
if (missing.length) {
  throw new Error(`Starter questions missing kinds: ${missing.join(', ')}`);
}

for (const question of pack.questions) {
  if (question.id !== 'custom' && !question.text) {
    throw new Error(`Question ${question.id} is missing text`);
  }
  if (question.id !== 'custom' && !(question.fact_keys || []).length) {
    throw new Error(`Question ${question.id} has no fact_keys`);
  }
}

const serialized = `${JSON.stringify(pack, null, 2)}\n`;
JSON.parse(serialized);
writeFileSync(outPath, serialized);
console.log(`Wrote ${outPath}`);
console.log(`Validated ${pack.questions.length} questions; kinds=${[...kinds].join(', ')}`);
