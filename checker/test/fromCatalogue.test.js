import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { catalogueToReferencePack } from '../src/reference/fromCatalogue.js';

const checkerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cataloguePath = path.resolve(checkerRoot, '../sample-website/src/data/catalogue.json');
const apexPath = path.join(checkerRoot, 'data/reference/apex.json');
const demoPath = path.join(checkerRoot, 'data/reference/demo.json');

describe('catalogueToReferencePack', () => {
  const catalogue = JSON.parse(readFileSync(cataloguePath, 'utf8'));
  const pack = catalogueToReferencePack(catalogue);

  it('maps Apex Moto bikes, banks, and dealers from the catalogue', () => {
    expect(pack.source_id).toBe('catalogue:Apex Moto');
    expect(pack.brand).toBe('Apex Moto');
    expect(pack.entities.filter((e) => e.id.startsWith('product:'))).toHaveLength(catalogue.bikes.length);
    expect(pack.entities.filter((e) => e.id.startsWith('bank:'))).toHaveLength(
      catalogue.bank_finance_partners.length
    );
    expect(pack.entities.filter((e) => e.id.startsWith('dealer:'))).toHaveLength(catalogue.dealers.length);
  });

  it('includes prices, variants, specs, colours, availability, finance, and dealer details', () => {
    const thunder = pack.entities.find((e) => e.id === 'product:thunderstrike-650');
    const keys = Object.fromEntries(thunder.facts.map((fact) => [fact.key, fact.value]));
    expect(keys.ex_showroom_price_inr).toBe(420000);
    expect(keys.on_road_price_delhi_inr).toBe(472500);
    expect(keys.colours).toContain('Blazing Orange');
    expect(keys.availability).toBe('In stock');
    expect(keys.variants).toContain('Adventure+');
    expect(keys.variant_adventure_plus_ex_showroom_price_inr).toBe(475000);
    expect(keys.engine).toContain('Parallel Twin');
    expect(keys.front_brake).toBeTruthy();
    expect(keys.finance_emi_inr).toBe(9585);
    expect(keys.finance_provider).toBe('Apex Moto Finance');

    const spark = pack.entities.find((e) => e.id === 'product:spark-e1');
    const sparkKeys = Object.fromEntries(spark.facts.map((fact) => [fact.key, fact.value]));
    expect(sparkKeys.range_km).toBe(140);
    expect(sparkKeys.max_power_bhp).toBe(12.1);
    expect(sparkKeys.battery_kwh).toBe(4);

    const dealer = pack.entities.find((e) => e.id === 'dealer:delhi-central');
    const dealerKeys = Object.fromEntries(dealer.facts.map((fact) => [fact.key, fact.value]));
    expect(dealerKeys.city).toBe('Delhi');
    expect(dealerKeys.email).toBe('delhi.central@apexmoto.in');
    expect(dealerKeys.services).toContain('Sales');
  });

  it('keeps the generated apex.json in sync and leaves the Acme demo pack unchanged', () => {
    const onDisk = JSON.parse(readFileSync(apexPath, 'utf8'));
    expect(onDisk).toEqual(pack);
    const demo = JSON.parse(readFileSync(demoPath, 'utf8'));
    expect(demo.source_id).toBe('verified-pack-demo');
    expect(demo.entities[0].id).toBe('product:acme-pump-200');
  });
});
