import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluateAnswer, rollupCategory } from '../src/evaluation/evaluate.js';
import { parseNumber } from '../src/evaluation/numbers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const demoReference = JSON.parse(readFileSync(path.join(root, 'data/reference/demo.json'), 'utf8'));
const conflictReference = JSON.parse(
  readFileSync(path.join(root, 'fixtures/reference-conflict.json'), 'utf8')
);

const priceQuestion = {
  id: 'q-price-pump',
  text: 'What is the ex-showroom price of the Acme Pump 200 in INR?',
  entity_ids: ['product:acme-pump-200'],
  fact_keys: ['ex_showroom_price_inr'],
};

describe('number parsing', () => {
  it('reads Indian grouped rupee amounts', () => {
    expect(parseNumber('₹4,20,000')).toBe(420000);
  });
});

describe('evaluateAnswer', () => {
  it('marks an exact price as correct', () => {
    const result = evaluateAnswer({
      question: priceQuestion,
      answerText: 'The ex-showroom price is ₹4,20,000.',
      referencePack: demoReference,
    });
    expect(result.overall_category).toBe('correct');
    expect(result.claim_results[0].status).toBe('match');
  });

  it('marks a wrong price as incorrect', () => {
    const result = evaluateAnswer({
      question: priceQuestion,
      answerText: 'The pump costs ₹3,25,000 ex-showroom.',
      referencePack: demoReference,
    });
    expect(result.overall_category).toBe('incorrect');
    expect(result.claim_results[0].status).toBe('mismatch');
    expect(result.explanation).toContain('325000');
    expect(result.explanation).toContain('420000');
  });

  it('treats a correct but incomplete spec answer as partially correct', () => {
    const result = evaluateAnswer({
      question: {
        id: 'both',
        entity_ids: ['product:acme-pump-200'],
        fact_keys: ['ex_showroom_price_inr', 'peak_flow_lpm'],
      },
      answerText: 'It is priced at 420000 INR.',
      referencePack: demoReference,
    });
    expect(result.overall_category).toBe('partially_correct');
  });

  it('is inconclusive when reference facts conflict', () => {
    const result = evaluateAnswer({
      question: priceQuestion,
      answerText: 'The price is 420000.',
      referencePack: conflictReference,
    });
    expect(result.overall_category).toBe('inconclusive');
    expect(result.claim_results[0].status).toBe('conflict_in_reference');
  });

  it('is inconclusive when collection failed', () => {
    const result = evaluateAnswer({
      question: priceQuestion,
      answerText: '',
      referencePack: demoReference,
      collectionError: 'Provider HTTP 500',
    });
    expect(result.overall_category).toBe('inconclusive');
    expect(result.complete).toBe(false);
  });

  it('is inconclusive when the answer is empty', () => {
    const result = evaluateAnswer({
      question: priceQuestion,
      answerText: '   ',
      referencePack: demoReference,
    });
    expect(result.overall_category).toBe('inconclusive');
  });
});

describe('rollupCategory', () => {
  it('does not call a missing required fact correct', () => {
    expect(
      rollupCategory([{ status: 'missing', required: true }], { hasAnswer: true })
    ).toBe('incorrect');
  });
});
