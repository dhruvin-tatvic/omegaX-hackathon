import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { loadConfig, loadQuestions, loadReference } from '../src/config.js';
import { evaluateAnswer } from '../src/evaluation/evaluate.js';
import { questionsPackFromReference, suggestQuestions } from '../src/reference/fromCatalogue.js';
import { createMemoryStore } from '../src/store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apexReference = JSON.parse(readFileSync(path.join(root, 'data/reference/apex.json'), 'utf8'));
const demoQuestions = JSON.parse(readFileSync(path.join(root, 'data/questions/demo.json'), 'utf8'));
const demoReference = JSON.parse(readFileSync(path.join(root, 'data/reference/demo.json'), 'utf8'));

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({
        server,
        url: `http://127.0.0.1:${port}`,
      });
    });
  });
}

function questionByKind(questions, kind) {
  return questions.find((question) => question.kind === kind && question.id !== 'custom');
}

describe('pack selection', () => {
  it('defaults to the Acme Pump demo pack', () => {
    const config = loadConfig({ CHECKER_PACK: '', QUESTIONS_PATH: '', REFERENCE_PATH: '' });
    expect(config.packId).toBe('demo');
    expect(config.paths.reference).toBe(path.join(root, 'data/reference/demo.json'));
    expect(config.paths.questions).toBe(path.join(root, 'data/questions/demo.json'));
    expect(loadReference(config).source_id).toBe('verified-pack-demo');
    expect(loadQuestions(config).id).toBe('demo-set');
  });

  it('loads the Apex Moto pair when CHECKER_PACK=apex', () => {
    const config = loadConfig({
      CHECKER_PACK: 'apex',
      QUESTIONS_PATH: 'data/questions/demo.json',
      REFERENCE_PATH: 'data/reference/demo.json',
    });
    expect(config.packId).toBe('apex');
    expect(config.paths.reference).toBe(path.join(root, 'data/reference/apex.json'));
    expect(config.paths.questions).toBe(path.join(root, 'data/questions/apex.json'));
    const reference = loadReference(config);
    const questions = loadQuestions(config);
    expect(reference.source_id).toBe('catalogue:Apex Moto');
    expect(questions.id).toBe('apex-set');
    expect(questions.questions.some((q) => q.entity_ids?.includes('product:acme-pump-200'))).toBe(false);
  });

  it('rejects an unknown pack name', () => {
    expect(() => loadConfig({ CHECKER_PACK: 'not-a-pack' })).toThrow(/Unknown CHECKER_PACK/);
  });
});

describe('Apex starter questions', () => {
  const suggested = suggestQuestions(apexReference);
  const kinds = new Set(suggested.map((question) => question.kind));

  it('covers price, specs, variants, colours, availability, dealers, and finance', () => {
    for (const kind of ['price', 'spec', 'variant', 'colour', 'availability', 'dealer', 'finance']) {
      expect(kinds.has(kind)).toBe(true);
    }
    expect(suggested.some((q) => q.id.startsWith('price-product:'))).toBe(true);
    expect(questionByKind(suggested, 'variant').fact_keys[0]).toMatch(/variant_.*ex_showroom_price_inr/);
    expect(questionByKind(suggested, 'dealer').entity_ids[0]).toMatch(/^dealer:/);
  });

  it('keeps generated apex.json questions in sync and leaves Acme questions unchanged', () => {
    const generated = questionsPackFromReference(apexReference);
    const onDisk = JSON.parse(readFileSync(path.join(root, 'data/questions/apex.json'), 'utf8'));
    expect(onDisk).toEqual(generated);
    expect(demoQuestions.id).toBe('demo-set');
    expect(demoQuestions.questions[0].id).toBe('q-price-pump');
    expect(demoQuestions.questions[0].entity_ids).toEqual(['product:acme-pump-200']);
    expect(demoReference.entities[0].id).toBe('product:acme-pump-200');
  });
});

describe('Apex pack scoring', () => {
  const questions = questionsPackFromReference(apexReference).questions;

  it('scores a matching Apex price as correct and a wrong price as incorrect', () => {
    const question = questions.find((item) => item.id === 'price-product:thunderstrike-650');
    const correct = evaluateAnswer({
      question,
      answerText: 'The Thunderstrike 650 is listed at ₹4,20,000 ex-showroom.',
      referencePack: apexReference,
    });
    expect(correct.overall_category).toBe('correct');

    const incorrect = evaluateAnswer({
      question,
      answerText: 'The Thunderstrike 650 is listed at ₹99,999 ex-showroom.',
      referencePack: apexReference,
    });
    expect(incorrect.overall_category).toBe('incorrect');
  });

  it('scores colour, availability, dealer, and finance facts from the Apex pack', () => {
    const colour = evaluateAnswer({
      question: questionByKind(questions, 'colour'),
      answerText: 'It is offered in Blazing Orange, Glacier White.',
      referencePack: apexReference,
    });
    expect(colour.overall_category).toBe('correct');

    const availability = evaluateAnswer({
      question: questionByKind(questions, 'availability'),
      answerText: 'Availability is In stock.',
      referencePack: apexReference,
    });
    expect(availability.overall_category).toBe('correct');

    const dealer = evaluateAnswer({
      question: questionByKind(questions, 'dealer'),
      answerText: 'The dealership is in Delhi. Phone +91-11-4123-5678.',
      referencePack: apexReference,
    });
    expect(dealer.overall_category).toBe('correct');

    const finance = evaluateAnswer({
      question: questions.find((item) => item.id.startsWith('finance-product:')),
      answerText: 'Listed EMI is ₹9,585 per month.',
      referencePack: apexReference,
    });
    expect(finance.overall_category).toBe('correct');
  });
});

describe('POST /api/runs pack flow', () => {
  it('scores Acme Pump through the default demo pack', async () => {
    const config = loadConfig({ CHECKER_PACK: 'demo' });
    config.referencePack = loadReference(config);
    const app = createApp({ config, store: createMemoryStore() });
    const { server, url } = await listen(app);
    try {
      const cfg = await fetch(`${url}/api/config`).then((res) => res.json());
      expect(cfg.pack.id).toBe('demo');
      expect(cfg.reference.source_id).toBe('verified-pack-demo');

      const run = await fetch(`${url}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: 'q-price-pump',
          answerText: 'The ex-showroom price is ₹4,20,000.',
        }),
      }).then((res) => res.json());
      expect(run.evaluation.overall_category).toBe('correct');
      expect(run.reference_source_id).toBe('verified-pack-demo');
    } finally {
      server.close();
    }
  });

  it('scores Apex Moto through /api/runs when CHECKER_PACK=apex', async () => {
    const config = loadConfig({ CHECKER_PACK: 'apex' });
    config.referencePack = loadReference(config);
    const app = createApp({ config, store: createMemoryStore() });
    const { server, url } = await listen(app);
    try {
      const cfg = await fetch(`${url}/api/config`).then((res) => res.json());
      expect(cfg.pack.id).toBe('apex');
      expect(cfg.reference.source_id).toBe('catalogue:Apex Moto');

      const run = await fetch(`${url}/api/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: 'price-product:thunderstrike-650',
          answerText: 'Ex-showroom is 420000 INR.',
        }),
      }).then((res) => res.json());
      expect(run.evaluation.overall_category).toBe('correct');
      expect(run.reference_source_id).toBe('catalogue:Apex Moto');
      expect(run.config_snapshot.pack).toBe('apex');
    } finally {
      server.close();
    }
  });
});
