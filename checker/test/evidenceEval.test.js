import { describe, expect, it } from 'vitest';
import { evaluateAgainstEvidence } from '../src/evaluation/evidence.js';
import { crawlSite } from '../src/crawl/crawler.js';
import { mockFetch, pagesA, pagesB, publicLookup, SITE_A, SITE_B } from './helpers/mockFetch.js';

async function sessionFor(url, pages) {
  return crawlSite(url, {
    fetchImpl: mockFetch(pages),
    lookupImpl: publicLookup(),
    limits: { delayMs: 0 },
  });
}

describe('evaluateAgainstEvidence', () => {
  it('marks a matching price as correct and keeps the source URL', async () => {
    const session = await sessionFor(`${SITE_A}/`, pagesA);
    const result = evaluateAgainstEvidence({
      question: 'What is the ex-showroom price of the Helios Lamp?',
      answerText: 'The Helios Lamp ex-showroom price is ₹12,500.',
      session,
    });
    expect(result.overall_category).toBe('correct');
    expect(result.claim_results[0].status).toBe('match');
    expect(result.claim_results[0].sources[0].url).toContain('lamps.example');
    expect(result.claim_results[0].sources[0].text).toMatch(/12,500|12500/);
  });

  it('flags a false price when evidence contradicts it', async () => {
    const session = await sessionFor(`${SITE_A}/`, pagesA);
    const result = evaluateAgainstEvidence({
      question: 'What is the price of the Helios Lamp?',
      answerText: 'The Helios Lamp costs ₹99,999.',
      session,
    });
    expect(result.overall_category).toBe('incorrect');
    expect(result.claim_results[0].status).toBe('mismatch');
  });

  it('does not mark an unsupported claim false just because evidence is absent', async () => {
    const session = await sessionFor(`${SITE_A}/`, pagesA);
    const result = evaluateAgainstEvidence({
      question: 'What is the Helios Lamp made of?',
      answerText: 'The Helios Lamp is carved from meteorite iron.',
      session,
    });
    expect(result.overall_category).toBe('unsupported');
    expect(result.claim_results.every((c) => c.status !== 'mismatch')).toBe(true);
  });

  it('returns insufficient evidence when the crawl has nothing relevant', async () => {
    const session = await sessionFor(`${SITE_B}/`, pagesB);
    const result = evaluateAgainstEvidence({
      question: 'What is the firmware signing key for Helios Lamp?',
      answerText: 'The key is ABCD.',
      session,
    });
    expect(result.overall_category).toBe('insufficient_evidence');
  });

  it('does not reuse site A facts when scoring site B', async () => {
    const session = await sessionFor(`${SITE_B}/`, pagesB);
    const result = evaluateAgainstEvidence({
      question: 'What is the price of the Helios Lamp?',
      answerText: 'The Helios Lamp costs ₹12,500.',
      session,
    });
    expect(result.overall_category).not.toBe('correct');
    expect(session.evidence.some((e) => e.numbers.includes(12500))).toBe(false);
  });
});
