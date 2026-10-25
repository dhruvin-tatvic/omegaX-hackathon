import { describe, expect, it } from 'vitest';
import { runTest } from '../src/runTest.js';
import { createMemoryStore } from '../src/store.js';

const referencePack = {
  source_id: 'pack',
  entities: [
    {
      id: 'product:acme-pump-200',
      name: 'Acme Pump 200',
      facts: [
        {
          key: 'ex_showroom_price_inr',
          value: 420000,
          type: 'number',
          unit: 'INR',
          required_in_answer: true,
        },
      ],
    },
  ],
};

const question = {
  id: 'q-price-pump',
  text: 'What is the ex-showroom price of the Acme Pump 200 in INR?',
  entity_ids: ['product:acme-pump-200'],
  fact_keys: ['ex_showroom_price_inr'],
};

function config() {
  return {
    target: { id: 'demo', base_url: 'https://example.com' },
    limits: { max_tokens: 64, timeout_ms: 1000, max_answer_chars: 20000 },
    openai: { apiKey: 'test-key', model: 'gpt-test', baseUrl: 'https://example.invalid/v1' },
    referencePack,
  };
}

describe('runTest', () => {
  it('stores a pasted wrong answer unchanged and scores it incorrect', async () => {
    const original = 'The listed price is 199999 rupees.';
    const run = await runTest({
      config: config(),
      store: createMemoryStore(),
      question,
      method: 'manual',
      answerText: original,
    });
    expect(run.answer.raw_text).toBe(original);
    expect(run.evaluation.overall_category).toBe('incorrect');
    expect(run.method).toBe('manual');
  });

  it('stores a pasted correct answer and scores it correct', async () => {
    const run = await runTest({
      config: config(),
      store: createMemoryStore(),
      question,
      method: 'manual',
      answerText: 'Ex-showroom is 420000 INR.',
    });
    expect(run.evaluation.overall_category).toBe('correct');
  });

  it('does not send reference values to the API and treats HTTP errors as incomplete', async () => {
    let requestBody;
    const fetchImpl = async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'server exploded' } }),
      };
    };
    const run = await runTest({
      config: config(),
      store: createMemoryStore(),
      question,
      method: 'api',
      fetchImpl,
    });
    const blob = JSON.stringify(requestBody);
    expect(blob).not.toContain('420000');
    expect(requestBody.messages[1].content).toContain('https://example.com');
    expect(run.status).toBe('incomplete');
    expect(run.evaluation.overall_category).toBe('inconclusive');
    expect(run.answer.error).toContain('server exploded');
  });

  it('records a missing API key as inconclusive rather than crashing', async () => {
    const cfg = config();
    cfg.openai.apiKey = '';
    const run = await runTest({
      config: cfg,
      store: createMemoryStore(),
      question,
      method: 'api',
    });
    expect(run.evaluation.overall_category).toBe('inconclusive');
    expect(run.answer.error).toMatch(/OPENAI_API_KEY/);
  });
});
