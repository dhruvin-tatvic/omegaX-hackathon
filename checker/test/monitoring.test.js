import { describe, expect, it } from 'vitest';
import { createApp } from '../src/api/app.js';
import { loadConfig, loadReference } from '../src/config.js';
import { buildMonitoringPlan, clampWeeks } from '../src/monitoring/plan.js';
import { analyzeSyntheticDemo } from '../src/traffic/analyze.js';
import { ga4NotConnected } from '../src/traffic/ga4.js';
import { createMemoryStore } from '../src/store.js';

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('buildMonitoringPlan', () => {
  it('clamps the horizon to 4–8 weeks and keeps GA4 unconnected without invented metrics', () => {
    expect(clampWeeks(3)).toBe(4);
    expect(clampWeeks(9)).toBe(8);
    expect(clampWeeks('6')).toBe(6);
    const plan = buildMonitoringPlan({
      weeks: 6,
      ga4: ga4NotConnected(),
      traffic: null,
      scorecard: { totals: { questions: 27, missing: 27 }, ai_observations: { not_observed: 27 }, rows: [] },
    });
    expect(plan.horizon_weeks).toBe(6);
    expect(plan.schedule).toHaveLength(6);
    expect(plan.owners.every((row) => row.role && row.duty)).toBe(true);
    expect(plan.change_policy.human_approval_before_website_changes).toBe(true);
    expect(plan.change_policy.auto_deploy_forbidden).toBe(true);
    expect(plan.current_inputs.ga4_status).toBe('not_connected');
    expect(JSON.stringify(plan)).not.toMatch(/invented conversion/i);
    expect(plan.limitations.some((line) => /GA4 status is not_connected/i.test(line))).toBe(true);
    expect(plan.schedule[0].change_control.human_approval_required).toBe(true);
    expect(plan.escalation.criteria.length).toBeGreaterThan(3);
  });

  it('labels synthetic traffic and local fixture changelog without treating them as production', () => {
    const traffic = analyzeSyntheticDemo();
    const plan = buildMonitoringPlan({
      weeks: 4,
      traffic,
      ga4: ga4NotConnected(),
      applyDemo: { changelog: [{ id: 'x' }] },
    });
    expect(plan.horizon_weeks).toBe(4);
    expect(plan.current_inputs.traffic_synthetic).toBe(true);
    expect(plan.data_sources.some((row) => row.synthetic && /SYNTHETIC DEMO DATA|LOCAL DEMO FIXTURE/.test(row.label || row.note))).toBe(
      true
    );
    expect(plan.limitations.some((line) => /SYNTHETIC DEMO DATA/.test(line))).toBe(true);
    expect(plan.limitations.some((line) => /verified_improved is not an AI-answer-visibility improvement/.test(line))).toBe(true);
  });
});

describe('monitoring-plan API', () => {
  it('builds a labelled plan from current checker state', async () => {
    const config = loadConfig();
    config.referencePack = loadReference(config);
    const app = createApp({
      config,
      store: createMemoryStore(),
      applyDemo: { list: () => ({ changelog: [], items: [] }), changelog: () => [] },
    });
    const { server, url } = await listen(app);
    try {
      await fetch(`${url}/api/traffic/demo`);
      const plan = await fetch(`${url}/api/monitoring-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeks: 8 }),
      }).then((res) => res.json());
      expect(plan.horizon_weeks).toBe(8);
      expect(plan.current_inputs.traffic_synthetic).toBe(true);
      expect(plan.current_inputs.ga4_status).toBe('not_connected');
    } finally {
      server.close();
    }
  });
});
