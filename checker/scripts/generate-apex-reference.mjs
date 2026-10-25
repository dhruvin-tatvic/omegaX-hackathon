import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogueToReferencePack } from '../src/reference/fromCatalogue.js';

const checkerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cataloguePath = path.resolve(checkerRoot, '../sample-website/src/data/catalogue.json');
const outPath = path.join(checkerRoot, 'data/reference/apex.json');

const catalogue = JSON.parse(readFileSync(cataloguePath, 'utf8'));
const pack = catalogueToReferencePack(catalogue);
const serialized = `${JSON.stringify(pack, null, 2)}\n`;
const parsed = JSON.parse(serialized);

if (!parsed.source_id || !Array.isArray(parsed.entities) || parsed.entities.length === 0) {
  throw new Error('Generated reference pack is missing source_id or entities');
}

const productCount = parsed.entities.filter((entity) => String(entity.id).startsWith('product:')).length;
const bankCount = parsed.entities.filter((entity) => String(entity.id).startsWith('bank:')).length;
const dealerCount = parsed.entities.filter((entity) => String(entity.id).startsWith('dealer:')).length;

if (productCount !== (catalogue.bikes || []).length) {
  throw new Error(`Expected ${catalogue.bikes.length} product entities, got ${productCount}`);
}
if (bankCount !== (catalogue.bank_finance_partners || []).length) {
  throw new Error(`Expected ${catalogue.bank_finance_partners.length} bank entities, got ${bankCount}`);
}
if (dealerCount !== (catalogue.dealers || []).length) {
  throw new Error(`Expected ${catalogue.dealers.length} dealer entities, got ${dealerCount}`);
}

for (const entity of parsed.entities) {
  if (!entity.id || !entity.name || !Array.isArray(entity.facts) || entity.facts.length === 0) {
    throw new Error(`Invalid entity: ${entity.id || entity.name || '(unnamed)'}`);
  }
  for (const fact of entity.facts) {
    if (!fact.key || fact.value == null) {
      throw new Error(`Invalid fact on ${entity.id}: ${JSON.stringify(fact)}`);
    }
  }
}

writeFileSync(outPath, serialized);

const products = parsed.entities.filter((entity) => String(entity.id).startsWith('product:')).length;
console.log(`Wrote ${outPath}`);
console.log(
  `Validated ${parsed.entities.length} entities (${productCount} products, ${bankCount} banks, ${dealerCount} dealers).`
);
console.log(`as_of=${parsed.as_of} source_id=${parsed.source_id} products=${products}`);
