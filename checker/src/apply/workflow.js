import { randomUUID } from 'node:crypto';
import { recommendFromResults } from '../recommendations/engine.js';
import { DEMO_LABEL, demoFixes, getDemoFix } from './catalog.js';
import { compareSnapshots } from './compare.js';
import { inspectFixtureHtml, snapshotFromInspection } from './inspect.js';
import {
  appendChangelog,
  ensureWorkspace,
  fileHash,
  readChangelog,
  readOriginal,
  readRenderedOriginal,
  readWorking,
  resolveApplyPaths,
  writeWorking,
} from './workspace.js';

const ACTIVE = new Set(['applied', 'verified_improved', 'verified_no_improvement', 'verification_inconclusive']);

function nowIso(clock) {
  return (clock || (() => new Date().toISOString()))();
}

function statusFromLog(entries, id) {
  const relevant = entries.filter((row) => row.recommendation_id === id && !row.refused);
  if (!relevant.length) return 'proposed';
  return relevant[relevant.length - 1].status || 'proposed';
}

function lastSuccessfulApply(entries, id) {
  return [...entries].reverse().find((row) => row.recommendation_id === id && row.action === 'apply' && !row.refused);
}

function lastBaseline(entries, id) {
  return [...entries].reverse().find((row) => row.recommendation_id === id && row.action === 'baseline' && !row.refused);
}

function inspectFix(paths, fix) {
  const html = readWorking(paths, fix.file);
  const renderedHtml = fix.rendered_file ? readRenderedOriginal(paths, fix.rendered_file) : null;
  return inspectFixtureHtml({
    html,
    url: fix.fixture_url,
    renderedHtml,
    title: fix.expected_signals.product_name,
  });
}

function engineItem(report, fix) {
  const rec = report.recommendations || recommendFromResults({ readability: report });
  const match = (rec.items || []).find((row) => row.kind === 'fix' && row.source_test === 'readability' && (row.url === fix.fixture_url || (row.id || '').includes(fix.finding_category.replace(/_/g, '-')) || row.title === fix.title));
  const fallback = (rec.items || []).find((row) => row.kind === 'fix' && row.title === fix.title);
  return match || fallback || null;
}

function publicItem(paths, fix, entries) {
  const report = inspectFix(paths, fix);
  const snapshot = snapshotFromInspection(report, fix);
  const engine = engineItem(report, fix);
  const status = statusFromLog(entries, fix.id);
  const applyEntry = lastSuccessfulApply(entries, fix.id);
  const baselineEntry = lastBaseline(entries, fix.id);
  const findingEvidence = report.findings
    .filter((row) => row.category === fix.finding_category)
    .flatMap((row) => row.evidence);
  return {
    id: fix.id,
    kind: 'fix',
    status,
    title: fix.title,
    url: fix.fixture_url,
    problem:
      engine?.problem ||
      (snapshot.finding_present
        ? `Local demo fixture still exhibits ${fix.finding_category}.`
        : `Local demo fixture currently has no ${fix.finding_category} finding.`),
    evidence: engine?.evidence?.length
      ? engine.evidence
      : findingEvidence.length
        ? findingEvidence
        : [{ url: fix.fixture_url, kind: 'fixture', text: 'No matching finding on the current working copy.' }],
    recommended_change: fix.recommended_change,
    expected_benefit: {
      kind: 'estimate',
      text: 'Estimate only: the local readability inspection of this fixture may change. This does not measure live AI answer visibility.',
    },
    effort: engine?.effort || (fix.type === 'product_jsonld' ? 'low' : 'high'),
    risk: 'low',
    priority_score: engine?.priority_score || 0,
    ranking_explanation: engine?.ranking_explanation || 'Ranked from the isolated fixture inspection, not from the live website.',
    source_test: fix.source_test,
    synthetic: true,
    synthetic_label: DEMO_LABEL,
    apply: {
      allowed: true,
      target: 'isolated_local_fixture',
      file: fix.file,
      never_touches_live_site: true,
    },
    current_snapshot: snapshot,
    baseline: baselineEntry?.test_result || null,
    last_apply: applyEntry
      ? {
          timestamp: applyEntry.timestamp,
          before_hash: applyEntry.before_hash,
          after_hash: applyEntry.after_hash,
        }
      : null,
    last_comparison: [...entries].reverse().find((row) => row.recommendation_id === fix.id && row.action === 'retest' && !row.refused)?.comparison || null,
    limitations: [
      'LOCAL DEMO FIXTURE only. The live Apex Moto site is not modified.',
      'Verification reports local fixture test evidence, not real-world AI answer visibility.',
    ],
  };
}

function logEntry(fields) {
  return {
    entry_id: fields.entry_id || randomUUID(),
    recommendation_id: fields.recommendation_id,
    action: fields.action,
    status: fields.status,
    affected_file: fields.affected_file,
    before: fields.before ?? null,
    after: fields.after ?? null,
    before_hash: fields.before_hash ?? null,
    after_hash: fields.after_hash ?? null,
    timestamp: fields.timestamp,
    test_result: fields.test_result ?? null,
    comparison: fields.comparison ?? null,
    refused: Boolean(fields.refused),
    error: fields.error || null,
    synthetic: true,
    synthetic_label: DEMO_LABEL,
  };
}

export function createApplyDemo({ referencePack, paths: pathOverrides, clock } = {}) {
  const paths = ensureWorkspace(resolveApplyPaths(pathOverrides));
  if (!referencePack) throw new Error('A reference pack is required for demo facts.');

  function list() {
    ensureWorkspace(paths);
    const entries = readChangelog(paths);
    const items = demoFixes(referencePack).map((fix) => publicItem(paths, fix, entries));
    return {
      generated_at: nowIso(clock),
      label: DEMO_LABEL,
      live_site_untouched: true,
      items,
      changelog: entries,
      limitations: [
        'Changes are written only under checker/data/apply-demo/working/. The live website is never edited.',
        'Rendered snapshots under originals/ are read-only comparison fixtures.',
        'Do not treat a local verified_improved status as proof that AI systems cite the live site.',
      ],
    };
  }

  function inspectOne(id) {
    const fix = getDemoFix(referencePack, id);
    ensureWorkspace(paths);
    return inspectFix(paths, fix);
  }

  function baseline(id) {
    const fix = getDemoFix(referencePack, id);
    ensureWorkspace(paths);
    const html = readWorking(paths, fix.file);
    const report = inspectFix(paths, fix);
    const snapshot = snapshotFromInspection(report, fix);
    const status = statusFromLog(readChangelog(paths), id);
    const entry = appendChangelog(
      paths,
      logEntry({
        recommendation_id: id,
        action: 'baseline',
        status: status === 'proposed' || status === 'rolled_back' ? 'proposed' : status,
        affected_file: fix.file,
        before: html,
        before_hash: fileHash(html),
        timestamp: nowIso(clock),
        test_result: snapshot,
      })
    );
    return { ...list(), last_entry: entry, inspection: report };
  }

  function apply(id, { record_baseline = true } = {}) {
    const fix = getDemoFix(referencePack, id);
    ensureWorkspace(paths);
    const entries = readChangelog(paths);
    const status = statusFromLog(entries, id);
    if (ACTIVE.has(status)) {
      const entry = appendChangelog(
        paths,
        logEntry({
          recommendation_id: id,
          action: 'apply',
          status,
          affected_file: fix.file,
          timestamp: nowIso(clock),
          refused: true,
          error: `Repeated apply refused: demo fix ${id} is already ${status}. Roll it back first.`,
        })
      );
      const err = new Error(entry.error);
      err.statusCode = 409;
      err.payload = { ...list(), last_entry: entry };
      throw err;
    }

    if (record_baseline) {
      baseline(id);
    }

    const before = readWorking(paths, fix.file);
    let after;
    try {
      after = fix.patch(before);
    } catch (err) {
      const entry = appendChangelog(
        paths,
        logEntry({
          recommendation_id: id,
          action: 'apply',
          status: 'proposed',
          affected_file: fix.file,
          before,
          before_hash: fileHash(before),
          timestamp: nowIso(clock),
          refused: true,
          error: err.message,
        })
      );
      const wrapped = new Error(err.message);
      wrapped.statusCode = 409;
      wrapped.payload = { ...list(), last_entry: entry };
      throw wrapped;
    }
    writeWorking(paths, fix.file, after);
    const entry = appendChangelog(
      paths,
      logEntry({
        recommendation_id: id,
        action: 'apply',
        status: 'applied',
        affected_file: fix.file,
        before,
        after,
        before_hash: fileHash(before),
        after_hash: fileHash(after),
        timestamp: nowIso(clock),
        test_result: lastBaseline(readChangelog(paths), id)?.test_result || null,
      })
    );
    return { ...list(), last_entry: entry };
  }

  function retest(id) {
    const fix = getDemoFix(referencePack, id);
    ensureWorkspace(paths);
    const entries = readChangelog(paths);
    const applyEntry = lastSuccessfulApply(entries, id);
    const baselineEntry = lastBaseline(entries, id);
    const current = readWorking(paths, fix.file);

    if (!applyEntry) {
      const entry = appendChangelog(
        paths,
        logEntry({
          recommendation_id: id,
          action: 'retest',
          status: 'verification_inconclusive',
          affected_file: fix.file,
          timestamp: nowIso(clock),
          refused: true,
          error: 'Retest refused: the demo fix has not been applied.',
        })
      );
      const err = new Error(entry.error);
      err.statusCode = 409;
      err.payload = { ...list(), last_entry: entry };
      throw err;
    }

    if (fileHash(current) !== applyEntry.after_hash) {
      const report = inspectFix(paths, fix);
      const afterSnap = snapshotFromInspection(report, fix);
      const comparison = {
        status: 'verification_inconclusive',
        improved: false,
        explanation:
          'Verification is inconclusive because the working file no longer matches the exact applied patch.',
        changed: [],
      };
      const entry = appendChangelog(
        paths,
        logEntry({
          recommendation_id: id,
          action: 'retest',
          status: 'verification_inconclusive',
          affected_file: fix.file,
          after: current,
          after_hash: fileHash(current),
          timestamp: nowIso(clock),
          test_result: afterSnap,
          comparison,
        })
      );
      return { ...list(), last_entry: entry, inspection: report };
    }

    if (!baselineEntry?.test_result) {
      const report = inspectFix(paths, fix);
      const afterSnap = snapshotFromInspection(report, fix);
      const comparison = compareSnapshots({ fix, baseline: null, after: afterSnap });
      const entry = appendChangelog(
        paths,
        logEntry({
          recommendation_id: id,
          action: 'retest',
          status: 'verification_inconclusive',
          affected_file: fix.file,
          after: current,
          after_hash: fileHash(current),
          timestamp: nowIso(clock),
          test_result: afterSnap,
          comparison,
        })
      );
      return { ...list(), last_entry: entry, inspection: report };
    }

    const report = inspectFix(paths, fix);
    const afterSnap = snapshotFromInspection(report, fix);
    const comparison = compareSnapshots({
      fix,
      baseline: baselineEntry.test_result,
      after: afterSnap,
    });
    const entry = appendChangelog(
      paths,
      logEntry({
        recommendation_id: id,
        action: 'retest',
        status: comparison.status,
        affected_file: fix.file,
        after: current,
        after_hash: fileHash(current),
        timestamp: nowIso(clock),
        test_result: afterSnap,
        comparison,
      })
    );
    return { ...list(), last_entry: entry, inspection: report };
  }

  function rollback(id) {
    const fix = getDemoFix(referencePack, id);
    ensureWorkspace(paths);
    const entries = readChangelog(paths);
    const applyEntry = lastSuccessfulApply(entries, id);
    const status = statusFromLog(entries, id);
    if (!applyEntry || status === 'rolled_back' || status === 'proposed') {
      const entry = appendChangelog(
        paths,
        logEntry({
          recommendation_id: id,
          action: 'rollback',
          status,
          affected_file: fix.file,
          timestamp: nowIso(clock),
          refused: true,
          error: 'Rollback refused: there is no applied demo patch to restore.',
        })
      );
      const err = new Error(entry.error);
      err.statusCode = 409;
      err.payload = { ...list(), last_entry: entry };
      throw err;
    }

    const current = readWorking(paths, fix.file);
    if (fileHash(current) !== applyEntry.after_hash) {
      const entry = appendChangelog(
        paths,
        logEntry({
          recommendation_id: id,
          action: 'rollback',
          status,
          affected_file: fix.file,
          after: current,
          after_hash: fileHash(current),
          timestamp: nowIso(clock),
          refused: true,
          error:
            'Rollback refused: the working file changed unexpectedly since the demo fix was applied. Restore it manually or reset from originals.',
        })
      );
      const err = new Error(entry.error);
      err.statusCode = 409;
      err.payload = { ...list(), last_entry: entry };
      throw err;
    }

    writeWorking(paths, fix.file, applyEntry.before);
    const restored = readWorking(paths, fix.file);
    if (fileHash(restored) !== applyEntry.before_hash || restored !== applyEntry.before) {
      const entry = appendChangelog(
        paths,
        logEntry({
          recommendation_id: id,
          action: 'rollback',
          status,
          affected_file: fix.file,
          timestamp: nowIso(clock),
          refused: true,
          error: 'Rollback refused: restored content did not match the recorded prior content.',
        })
      );
      const err = new Error(entry.error);
      err.statusCode = 500;
      err.payload = { ...list(), last_entry: entry };
      throw err;
    }
    const original = readOriginal(paths, fix.file);
    const matchesOriginal = restored === original;
    const entry = appendChangelog(
      paths,
      logEntry({
        recommendation_id: id,
        action: 'rollback',
        status: 'rolled_back',
        affected_file: fix.file,
        before: applyEntry.after,
        after: restored,
        before_hash: applyEntry.after_hash,
        after_hash: fileHash(restored),
        timestamp: nowIso(clock),
        test_result: {
          restored_exactly: true,
          matches_original_fixture: matchesOriginal,
          label: DEMO_LABEL,
        },
      })
    );
    return { ...list(), last_entry: entry };
  }

  return {
    paths,
    list,
    inspectOne,
    baseline,
    apply,
    retest,
    rollback,
    changelog: () => readChangelog(paths),
  };
}
