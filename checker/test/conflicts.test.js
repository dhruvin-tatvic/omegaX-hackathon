import { describe, expect, it } from 'vitest';
import { detectConflicts, extractTypedFacts } from '../src/crawl/facts.js';

const SHARED_COPY = 'The Helios Lamp is a brass desk lamp with a listed specification sheet and a detailed product overview for buyers.';

function ev(url, text, kind = 'text') {
  return { url, kind, text };
}

describe('extractTypedFacts', () => {
  it('labels rider counts, phones, EMI, and ex-showroom prices separately', () => {
    const stats = extractTypedFacts('Join 50,000 riders on the Apex Moto homepage.');
    expect(stats.some((fact) => fact.type === 'statistic' && fact.value === 50000)).toBe(true);
    expect(stats.every((fact) => fact.type !== 'price')).toBe(true);

    const phones = extractTypedFacts('Visit Helios Lamp dealers. Call +91 98765 43210 for a test ride.');
    expect(phones.some((fact) => fact.type === 'phone')).toBe(true);
    expect(phones.every((fact) => fact.type !== 'price')).toBe(true);

    const emi = extractTypedFacts('Helios Lamp monthly EMI ₹4,999 per month with bank finance.');
    expect(emi.some((fact) => fact.type === 'emi' && fact.value === 4999)).toBe(true);

    const price = extractTypedFacts('Helios Lamp ex-showroom price ₹12,500.');
    expect(price.some((fact) => fact.type === 'price' && fact.kind === 'ex_showroom' && fact.value === 12500)).toBe(
      true
    );
  });
});

describe('detectConflicts', () => {
  it('does not flag different product prices against homepage rider counts', () => {
    const conflicts = detectConflicts([
      ev(
        'https://lamps.example/',
        `${SHARED_COPY} Join 50,000 riders on the Apex Moto community homepage this season.`
      ),
      ev(
        'https://lamps.example/products/helios',
        `${SHARED_COPY} Ex-showroom price ₹12,500.`
      ),
    ]);
    expect(conflicts).toEqual([]);
  });

  it('does not treat dealer phone numbers as prices', () => {
    const conflicts = detectConflicts([
      ev(
        'https://lamps.example/dealers',
        `${SHARED_COPY} Visit Helios Lamp dealers. Call +91 98765 43210 for a test ride.`
      ),
      ev('https://lamps.example/products/helios', `${SHARED_COPY} Ex-showroom price ₹12,500.`),
    ]);
    expect(conflicts).toEqual([]);
  });

  it('does not treat monthly EMI as an ex-showroom price', () => {
    const conflicts = detectConflicts([
      ev(
        'https://lamps.example/finance',
        `${SHARED_COPY} Helios Lamp monthly EMI ₹4,999 per month with bank finance.`
      ),
      ev('https://lamps.example/products/helios', `${SHARED_COPY} Ex-showroom price ₹12,500.`),
    ]);
    expect(conflicts).toEqual([]);
  });

  it('still detects a genuine conflicting price for the same product', () => {
    const conflicts = detectConflicts([
      ev('https://lamps.example/', `${SHARED_COPY} Ex-showroom price ₹12,500.`),
      ev('https://lamps.example/offers', `${SHARED_COPY} Ex-showroom price ₹9,999.`),
    ]);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].values).toEqual(expect.arrayContaining([12500, 9999]));
    expect(conflicts[0].urls).toEqual(
      expect.arrayContaining(['https://lamps.example/', 'https://lamps.example/offers'])
    );
    expect(conflicts[0].snippets.join(' ')).toMatch(/12,500/);
    expect(conflicts[0].snippets.join(' ')).toMatch(/9,999/);
    expect(conflicts[0].severity).toBe('high');
    expect(conflicts[0].subject).toMatch(/helios/i);
  });

  it('uses page headings when the price node itself has no product name', () => {
    const conflicts = detectConflicts([
      ev('https://lamps.example/', 'Helios Lamp', 'heading'),
      ev('https://lamps.example/', '₹12,500', 'price'),
      ev('https://lamps.example/offers', 'Helios Lamp', 'heading'),
      ev('https://lamps.example/offers', '₹9,999', 'price'),
    ]);
    expect(conflicts.some((row) => row.values.includes(12500) && row.values.includes(9999))).toBe(true);
  });
});
