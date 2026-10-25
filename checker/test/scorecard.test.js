import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { loadConfig, loadReference, rootDir } from '../src/config.js';
import { assignCategory, buildScorecard, NOT_OBSERVED } from '../src/scorecard/build.js';
import { scorecardToCsv } from '../src/scorecard/export.js';
import { createMemoryStore } from '../src/store.js';

const questionsPack = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/questions/apex.json'), 'utf8'));
const referencePack = JSON.parse(fs.readFileSync(path.join(rootDir, 'data/reference/apex.json'), 'utf8'));

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('assignCategory', () => {
  it('uses mutually exclusive labels', () => {
    expect(assignCategory({ referenceOk: false, website: { status: 'match' }, ai: { status: 'not_observed' } })).toBe(
      'inconclusive'
    );
    expect(assignCategory({ referenceOk: true, website: { status: 'match' }, ai: { status: 'mismatch' } })).toBe(
      'incorrect'
    );
    expect(assignCategory({ referenceOk: true, website: { status: 'mismatch' }, ai: { status: 'not_observed' } })).toBe(
      'outdated'
    );
    expect(assignCategory({ referenceOk: true, website: { status: 'absent' }, ai: { status: 'not_observed' } })).toBe(
      'missing'
    );
    expect(assignCategory({ referenceOk: true, website: { status: 'match' }, ai: { status: 'not_observed' } })).toBe(
      'correct'
    );
  });
});

describe('buildScorecard', () => {
  it('scores the Apex set once each and does not invent AI answers when evidence is empty', () => {
    const card = buildScorecard({ questionsPack, referencePack, session: null, runs: [] });
    const ids = card.rows.map((row) => row.question_id);
    expect(ids).not.toContain('custom');
    expect(new Set(ids).size).toBe(ids.length);
    expect(card.totals.questions).toBe(card.rows.length);
    expect(card.totals.missing).toBe(card.rows.length);
    expect(card.totals.correct + card.totals.incorrect + card.totals.missing + card.totals.outdated + card.totals.inconclusive).toBe(
      card.rows.length
    );
    expect(card.ai_observations.not_observed).toBe(card.rows.length);
    expect(card.rows.every((row) => row.ai_answer.label === NOT_OBSERVED)).toBe(true);
    expect(card.rows.every((row) => row.ai_answer.text == null)).toBe(true);
    expect(card.rows[0].expected_fact).toMatch(/Thunderstrike 650/);
    expect(card.percentages.missing).toBe(100);
  });

  it('marks matching crawl evidence correct and a divergent published value outdated', () => {
    const session = {
      facts: [
        {
          url: 'https://apex-moto-one.vercel.app/motorcycles/thunderstrike-650',
          kind: 'price',
          text: 'Thunderstrike 650 ex-showroom price ₹4,20,000',
          numbers: [420000],
        },
        {
          url: 'https://apex-moto-one.vercel.app/motorcycles/phantom-350',
          kind: 'price',
          text: 'Phantom 350 ex-showroom price ₹1,00,000',
          numbers: [100000],
        },
      ],
    };
    const card = buildScorecard({ questionsPack, referencePack, session, runs: [] });
    const thunder = card.rows.find((row) => row.question_id === 'price-product:thunderstrike-650');
    const phantom = card.rows.find((row) => row.question_id === 'price-product:phantom-350');
    expect(thunder.status).toBe('correct');
    expect(thunder.website_evidence.status).toBe('match');
    expect(thunder.ai_answer.label).toBe(NOT_OBSERVED);
    expect(phantom.status).toBe('outdated');
    expect(phantom.affected_url).toMatch(/phantom-350/);
    expect(card.totals.correct + card.totals.outdated + card.totals.missing).toBe(card.totals.questions);
  });

  it('counts an observed contradicting AI answer as incorrect without treating the expected fact as the answer', () => {
    const session = {
      facts: [
        {
          url: 'https://apex-moto-one.vercel.app/motorcycles/thunderstrike-650',
          kind: 'price',
          text: 'Thunderstrike 650 ex-showroom price ₹4,20,000',
          numbers: [420000],
        },
      ],
    };
    const runs = [
      {
        id: 'run-1',
        started_at: '2026-10-24T12:00:00.000Z',
        question: { id: 'price-product:thunderstrike-650', text: 'What is the ex-showroom price of the Thunderstrike 650?' },
        answer: { raw_text: 'The Thunderstrike 650 costs ₹999.' },
      },
    ];
    const card = buildScorecard({ questionsPack, referencePack, session, runs });
    const thunder = card.rows.find((row) => row.question_id === 'price-product:thunderstrike-650');
    expect(thunder.status).toBe('incorrect');
    expect(thunder.ai_answer.text).toMatch(/999/);
    expect(thunder.ai_answer.text).not.toMatch(/420000/);
    expect(card.totals.incorrect).toBe(1);
  });

  it('exports CSV with one row per question', () => {
    const card = buildScorecard({ questionsPack, referencePack });
    const csv = scorecardToCsv(card);
    expect(csv.split('\n')[0]).toMatch(/question_id,status,expected_fact/);
    expect(csv).toMatch(/Not observed/);
    expect(csv).toMatch(/totals_missing/);
    expect(csv.split('\n').filter((line) => line.startsWith('price-product:thunderstrike-650,'))).toHaveLength(1);
  });
});

describe('scorecard API', () => {
  it('returns the Apex scorecard as JSON and CSV', async () => {
    const config = loadConfig();
    config.referencePack = loadReference(config);
    const app = createApp({ config, store: createMemoryStore(), applyDemo: { list: () => ({ changelog: [] }), changelog: () => [] } });
    const { server, url } = await listen(app);
    try {
      const json = await fetch(`${url}/api/scorecard`).then((res) => res.json());
      expect(json.totals.questions).toBeGreaterThan(10);
      expect(json.rows.every((row) => row.ai_answer.label === NOT_OBSERVED)).toBe(true);
      const csv = await fetch(`${url}/api/scorecard.csv`).then((res) => res.text());
      expect(csv).toMatch(/question_id/);
    } finally {
      server.close();
    }
  });
});
