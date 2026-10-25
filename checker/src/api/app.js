import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { loadConfig, loadQuestions, loadReference, rootDir } from '../config.js';
import { createFileStore } from '../store.js';
import { runTest } from '../runTest.js';
import { crawlSite, suggestQuestions } from '../crawl/crawler.js';
import { createCrawlRegistry } from '../crawl/registry.js';
import { evaluateAgainstEvidence } from '../evaluation/evidence.js';
import { analyzeReadability } from '../readability/analyze.js';
import { analyzeSyntheticDemo, analyzeTraffic, ga4NotConnected, importGa4Export } from '../traffic/analyze.js';
import { collectManualAnswer } from '../providers/manual.js';
import { collectOpenAiAnswer } from '../providers/openai.js';
import { assertPromptSafe, buildPrompt } from '../prompt.js';
import { originKey, normalizeHttpUrl } from '../security/urlGuard.js';
import { recommendFromResults } from '../recommendations/engine.js';
import { createApplyDemo } from '../apply/workflow.js';
import { buildScorecard } from '../scorecard/build.js';
import { scorecardToCsv } from '../scorecard/export.js';
import { buildMonitoringPlan, clampWeeks } from '../monitoring/plan.js';

const DEFAULT_TARGET = 'https://omegax-hackathon.onrender.com/';

function loadApexReferencePack() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'data/reference/apex.json'), 'utf8'));
}

function loadApexQuestionsPack() {
  return JSON.parse(fs.readFileSync(path.join(rootDir, 'data/questions/apex.json'), 'utf8'));
}

export function createApp({ config, store, crawlRegistry, crawlFn, analyzeFn, renderImpl, traffic, applyDemo } = {}) {
  const cfg = config || loadConfig();
  cfg.referencePack = cfg.referencePack || loadReference(cfg);
  const questionsPack = loadQuestions(cfg);
  const runStore = store || createFileStore(cfg.paths.runs);
  const crawls = crawlRegistry || createCrawlRegistry();
  const runCrawl = crawlFn || crawlSite;
  const runAnalyze = analyzeFn || analyzeReadability;
  const trafficState = traffic || { report: null, ga4: ga4NotConnected() };
  const last = { readability: null, session: null, scorecard: null, monitoring: null };
  let demoWorkflow = applyDemo || null;
  function demo() {
    if (!demoWorkflow) {
      demoWorkflow = createApplyDemo({ referencePack: loadApexReferencePack() });
    }
    return demoWorkflow;
  }

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.type('text/plain').send('OK');
  });

  app.get('/api/config', (_req, res) => {
    res.json({
      target: { ...cfg.target, default_url: DEFAULT_TARGET },
      openai: {
        configured: Boolean(cfg.openai.apiKey),
        model: cfg.openai.model,
      },
      pack: {
        id: cfg.packId || 'demo',
        label: cfg.packLabel || null,
      },
      reference: {
        source_id: cfg.referencePack.source_id,
        as_of: cfg.referencePack.as_of,
        label: cfg.referencePack.label || null,
      },
      questions: {
        id: questionsPack.id,
        name: questionsPack.name,
      },
      crawl: cfg.crawl || {},
    });
  });

  app.get('/api/questions', (_req, res) => {
    res.json(questionsPack);
  });

  app.get('/api/reference', (_req, res) => {
    res.json(cfg.referencePack);
  });

  app.get('/api/runs', async (_req, res) => {
    res.json(await runStore.list());
  });

  app.get('/api/runs/:id', async (req, res) => {
    const run = await runStore.get(req.params.id);
    if (!run) return res.status(404).json({ error: 'Run not found' });
    res.json(run);
  });

  app.post('/api/runs', async (req, res) => {
    try {
      const { questionId, questionText, method, answerText } = req.body || {};
      const chosenMethod = method === 'api' ? 'api' : 'manual';
      let question = (questionsPack.questions || []).find((q) => q.id === questionId);
      const text = String(questionText || question?.text || '').trim();
      if (!text) {
        return res.status(400).json({ error: 'A question is required' });
      }
      if (!question) {
        question = {
          id: questionId || 'custom',
          text,
          related_urls: [],
          entity_ids: questionsPack.questions?.[0]?.entity_ids || [],
          fact_keys: questionsPack.questions?.[0]?.fact_keys || [],
          kind: 'other',
        };
      } else {
        question = { ...question, text };
      }

      const run = await runTest({
        config: cfg,
        store: runStore,
        question,
        method: chosenMethod,
        answerText,
      });
      res.status(201).json(run);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/session', (req, res) => {
    try {
      const origin = originKey(String(req.query.url || DEFAULT_TARGET));
      const session = crawls.get(origin);
      if (!session) return res.json({ session: null, suggestions: [] });
      res.json({ session: publicSession(session), suggestions: suggestQuestions(session) });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/crawl', async (req, res) => {
    try {
      const url = String(req.body?.url || DEFAULT_TARGET);
      normalizeHttpUrl(url);
      const session = await runCrawl(url, { limits: cfg.crawl });
      crawls.save(session);
      last.session = publicSession(session);
      res.status(201).json({
        session: last.session,
        suggestions: suggestQuestions(session),
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/readability', async (req, res) => {
    try {
      const url = String(req.body?.url || DEFAULT_TARGET);
      normalizeHttpUrl(url);
      const report = await runAnalyze(url, {
        limits: cfg.crawl,
        crawlFn: runCrawl,
        renderImpl,
      });
      if (report.session) crawls.save(report.session);
      last.readability = {
        url: report.url,
        origin: report.origin,
        started_at: report.started_at,
        finished_at: report.finished_at,
        findings: report.findings || [],
        comparisons: report.comparisons || [],
        limitations: report.limitations || [],
        notes: report.notes || {},
        session: report.session ? publicSession(report.session) : null,
      };
      if (last.readability.session) last.session = last.readability.session;
      res.status(201).json({
        url: report.url,
        origin: report.origin,
        started_at: report.started_at,
        finished_at: report.finished_at,
        findings: report.findings || [],
        comparisons: report.comparisons || [],
        limitations: report.limitations || [],
        notes: report.notes || {},
        session: report.session ? publicSession(report.session) : null,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/traffic', (_req, res) => {
    res.json({
      report: trafficState.report,
      ga4: trafficState.ga4 || ga4NotConnected(),
    });
  });

  app.get('/api/traffic/demo', (_req, res) => {
    try {
      const report = analyzeSyntheticDemo(trafficState.ga4);
      trafficState.report = report;
      res.json(report);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/traffic/analyze', (req, res) => {
    try {
      const text = String(req.body?.text || '');
      if (!text.trim()) return res.status(400).json({ error: 'Paste JSON Lines or CSV access-log text.' });
      const report = analyzeTraffic({
        text,
        format: req.body?.format || 'auto',
        synthetic: Boolean(req.body?.synthetic),
        source_label: req.body?.source_label,
        ga4: trafficState.ga4,
      });
      trafficState.report = report;
      res.status(201).json(report);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/traffic/ga4', (_req, res) => {
    res.json(trafficState.ga4 || ga4NotConnected());
  });

  app.post('/api/traffic/ga4', (req, res) => {
    try {
      trafficState.ga4 = importGa4Export(req.body || {});
      if (trafficState.report) {
        trafficState.report = {
          ...trafficState.report,
          ga4: trafficState.ga4,
          data_classes: {
            ...(trafficState.report.data_classes || {}),
            ga4: trafficState.ga4.synthetic ? 'synthetic' : trafficState.ga4.status,
          },
        };
      }
      res.status(201).json({
        ga4: trafficState.ga4,
        report: trafficState.report,
        note: 'GA4 rows stay in report.ga4 and are not added to observed log counts.',
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/recommendations', async (req, res) => {
    try {
      const readability = req.body?.readability === undefined ? last.readability : req.body.readability;
      const traffic = req.body?.traffic === undefined ? trafficState.report : req.body.traffic;
      let accuracyRuns = req.body?.accuracy_runs;
      if (accuracyRuns === undefined) {
        const listed = await runStore.list();
        accuracyRuns = listed.slice(0, 5);
      }
      res.json(
        recommendFromResults({
          readability,
          traffic,
          accuracyRuns,
        })
      );
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/recommendations', async (_req, res) => {
    const listed = await runStore.list();
    res.json(
      recommendFromResults({
        readability: last.readability,
        traffic: trafficState.report,
        accuracyRuns: listed.slice(0, 5),
      })
    );
  });

  function sendDemoError(res, err) {
    const status = err.statusCode || 400;
    if (err.payload) return res.status(status).json({ error: err.message, ...err.payload });
    return res.status(status).json({ error: err.message });
  }

  app.get('/api/apply-demo', (_req, res) => {
    try {
      res.json(demo().list());
    } catch (err) {
      sendDemoError(res, err);
    }
  });

  app.get('/api/apply-demo/changelog', (_req, res) => {
    try {
      res.json({ entries: demo().changelog(), label: 'LOCAL DEMO FIXTURE' });
    } catch (err) {
      sendDemoError(res, err);
    }
  });

  app.post('/api/apply-demo/:id/baseline', (req, res) => {
    try {
      res.status(201).json(demo().baseline(req.params.id));
    } catch (err) {
      sendDemoError(res, err);
    }
  });

  app.post('/api/apply-demo/:id/apply', (req, res) => {
    try {
      res.status(201).json(demo().apply(req.params.id, { record_baseline: req.body?.record_baseline !== false }));
    } catch (err) {
      sendDemoError(res, err);
    }
  });

  app.post('/api/apply-demo/:id/retest', (req, res) => {
    try {
      res.status(201).json(demo().retest(req.params.id));
    } catch (err) {
      sendDemoError(res, err);
    }
  });

  app.post('/api/apply-demo/:id/rollback', (req, res) => {
    try {
      res.status(201).json(demo().rollback(req.params.id));
    } catch (err) {
      sendDemoError(res, err);
    }
  });

  async function currentScorecard(overrides = {}) {
    const listed = overrides.runs !== undefined ? overrides.runs : await runStore.list();
    const session = overrides.session !== undefined ? overrides.session : last.session;
    const card = buildScorecard({
      questionsPack: loadApexQuestionsPack(),
      referencePack: loadApexReferencePack(),
      session,
      runs: listed,
    });
    last.scorecard = card;
    return card;
  }

  async function currentPlan(overrides = {}) {
    const weeks = clampWeeks(overrides.weeks);
    const listed = await runStore.list();
    const scorecard =
      overrides.scorecard !== undefined
        ? overrides.scorecard
        : last.scorecard || (await currentScorecard({ session: last.session, runs: listed }));
    let applyState = null;
    try {
      applyState = demo().list();
    } catch {
      applyState = null;
    }
    const recs = recommendFromResults({
      readability: last.readability,
      traffic: trafficState.report,
      accuracyRuns: listed.slice(0, 5),
    });
    const plan = buildMonitoringPlan({
      weeks,
      scorecard,
      readability: last.readability,
      traffic: trafficState.report,
      ga4: trafficState.ga4 || ga4NotConnected(),
      recommendations: recs,
      applyDemo: applyState,
    });
    last.monitoring = plan;
    return plan;
  }

  app.get('/api/scorecard', async (_req, res) => {
    try {
      res.json(await currentScorecard());
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/scorecard', async (req, res) => {
    try {
      const card = await currentScorecard({
        session: req.body?.session === undefined ? last.session : req.body.session,
        runs: req.body?.runs === undefined ? undefined : req.body.runs,
      });
      res.json(card);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/scorecard.csv', async (_req, res) => {
    try {
      const card = last.scorecard || (await currentScorecard());
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="apex-question-set-scorecard.csv"');
      res.send(scorecardToCsv(card));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/monitoring-plan', async (req, res) => {
    try {
      res.json(await currentPlan({ weeks: req.query.weeks }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/monitoring-plan', async (req, res) => {
    try {
      res.json(await currentPlan({ weeks: req.body?.weeks }));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/evaluate', async (req, res) => {
    try {
      const { url, questionText, method, answerText } = req.body || {};
      const targetUrl = String(url || DEFAULT_TARGET);
      const origin = originKey(targetUrl);
      const session = crawls.get(origin);
      if (!session) {
        return res.status(400).json({
          error: 'Crawl this website first. Evaluation uses only evidence from the selected URL.',
        });
      }
      const question = String(questionText || '').trim();
      if (!question) return res.status(400).json({ error: 'A question is required' });

      const chosenMethod = method === 'api' ? 'api' : 'manual';
      let collected;
      if (chosenMethod === 'api') {
        const prompt = buildPrompt({ question, targetUrl: session.start_url });
        const forbidden = (session.evidence || [])
          .flatMap((e) => e.numbers || [])
          .map((n) => String(n))
          .filter((n) => n.length >= 4);
        assertPromptSafe(prompt, forbidden);
        collected = await collectOpenAiAnswer({
          question,
          targetUrl: session.start_url,
          openai: cfg.openai,
          limits: cfg.limits,
        });
      } else {
        collected = await collectManualAnswer({
          answerText,
          limits: cfg.limits,
        });
      }

      const evaluation = evaluateAgainstEvidence({
        question,
        answerText: collected.raw_text,
        session,
        collectionError: collected.ok ? null : collected.error,
      });

      const run = await runStore.save({
        website_id: origin,
        target_url: session.start_url,
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        provider: collected.provider,
        model: collected.model,
        method: collected.method,
        status: collected.ok && evaluation.complete ? 'completed' : 'incomplete',
        question: { id: 'freeform', text: question, related_urls: [] },
        answer: {
          raw_text: collected.raw_text,
          citations: collected.citations,
          error: collected.error,
          latency_ms: collected.latency_ms,
          prompt: collected.prompt || null,
        },
        evaluation,
        evidence_origin: origin,
        reference_source_id: session.label,
      });
      res.status(201).json(run);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  const webDist = path.join(rootDir, 'dist');
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get(/.*/, (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(webDist, 'index.html'));
    });
  }

  return app;
}

function publicSession(session) {
  const facts = (session.evidence || []).slice(0, 80).map((item) => ({
    id: item.id,
    url: item.url,
    kind: item.kind,
    text: item.text,
    numbers: item.numbers,
  }));
  return {
    origin: session.origin,
    start_url: session.start_url,
    crawled_at: session.crawled_at,
    finished_at: session.finished_at,
    sitemap_found: session.sitemap_found,
    robots_found: session.robots_found,
    pages_visited: session.pages_visited,
    pages_failed: session.pages_failed,
    robots_blocked: session.robots_blocked,
    js_likely_urls: session.js_likely_urls,
    conflicts: session.conflicts,
    linked_resources: session.linked_resources || [],
    truncated: session.truncated,
    label: session.label,
    note: session.note,
    evidence_count: session.evidence?.length || 0,
    facts,
  };
}
