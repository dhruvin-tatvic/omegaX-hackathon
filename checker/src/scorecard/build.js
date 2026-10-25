import { evaluateFact, flattenFacts, selectFacts } from '../evaluation/evaluate.js';

export const SCORECARD_CATEGORIES = ['correct', 'incorrect', 'missing', 'outdated', 'inconclusive'];
export const NOT_OBSERVED = 'Not observed';

export const CATEGORY_DEFINITIONS = {
  correct:
    'Website-sourced evidence matches the trusted Apex reference fact. If an AI answer was observed, it does not contradict the reference. A matching site fact is not treated as proof that an assistant cited the page.',
  incorrect:
    'An observed AI answer contains a checkable value that contradicts the trusted Apex reference. One question is counted here even if the website also disagrees.',
  missing:
    'The trusted reference has an expected fact, but available website evidence does not contain it. No AI contradiction was observed.',
  outdated:
    'Website-sourced evidence states a different value than the current trusted reference for the same fact, and no contradicting AI answer was observed. This is treated as a stale or divergent published value, not as a measured traffic effect.',
  inconclusive:
    'The question cannot be scored: the reference fact is missing or conflicting, or the observation cannot be interpreted.',
};

function asList(value) {
  return Array.isArray(value) ? value : value ? [value] : [];
}

export function formatExpectedFact(fact) {
  if (!fact) return null;
  const unit = fact.unit ? ` ${fact.unit}` : '';
  return `${fact.entity_name}: ${fact.key} = ${fact.value}${unit}`.trim();
}

function formatExpectedAnswer(facts) {
  if (!facts.length) return null;
  return facts.map((fact) => formatExpectedFact(fact)).join('; ');
}

function slugOf(entityId) {
  const parts = String(entityId || '').split(':');
  return (parts[1] || parts[0] || '').toLowerCase();
}

function evidenceItems(session) {
  if (!session) return [];
  return asList(session.facts?.length ? session.facts : session.evidence);
}

function evidenceForQuestion(question, facts, session) {
  const items = evidenceItems(session);
  if (!items.length) return [];
  const names = [...new Set(facts.map((fact) => String(fact.entity_name || '').toLowerCase()).filter(Boolean))];
  const slugs = [...new Set(facts.map((fact) => slugOf(fact.entity_id)).filter(Boolean))];
  const urls = asList(question.related_urls).map((url) => String(url).toLowerCase());
  return items.filter((item) => {
    const blob = `${item.text || ''} ${item.url || ''}`.toLowerCase();
    if (names.some((name) => name && blob.includes(name))) return true;
    if (slugs.some((slug) => slug && blob.includes(slug))) return true;
    if (urls.some((url) => url && String(item.url || '').toLowerCase() === url)) return true;
    return false;
  });
}

function websiteStatus(facts, items) {
  if (!items.length) {
    return {
      status: 'absent',
      snippets: [],
      url: null,
      fact_results: [],
    };
  }
  const blob = items.map((item) => item.text || '').join('\n');
  const factResults = facts.map((fact) => evaluateFact(fact, blob));
  const url = items.find((item) => item.url)?.url || null;
  const snippets = items.slice(0, 3).map((item) => ({
    url: item.url || null,
    kind: item.kind || 'text',
    text: item.text,
  }));
  if (factResults.some((row) => row.status === 'conflict_in_reference')) {
    return { status: 'conflict', snippets, url, fact_results: factResults };
  }
  if (factResults.some((row) => row.status === 'mismatch')) {
    return { status: 'mismatch', snippets, url, fact_results: factResults };
  }
  if (factResults.length && factResults.every((row) => row.status === 'match')) {
    return { status: 'match', snippets, url, fact_results: factResults };
  }
  if (factResults.some((row) => row.status === 'match') && factResults.some((row) => row.status === 'missing')) {
    return { status: 'partial', snippets, url, fact_results: factResults };
  }
  return { status: 'absent', snippets, url, fact_results: factResults };
}

function latestObservation(runs, question) {
  const matches = asList(runs).filter((run) => {
    const q = run.question || {};
    return q.id === question.id || (question.text && q.text === question.text);
  });
  matches.sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));
  return matches[0] || null;
}

function aiStatus(run, facts) {
  const raw = run?.answer?.raw_text;
  if (!run || raw == null || !String(raw).trim()) {
    return {
      status: 'not_observed',
      label: NOT_OBSERVED,
      text: null,
      fact_results: [],
    };
  }
  const factResults = facts.map((fact) => evaluateFact(fact, String(raw)));
  if (factResults.some((row) => row.status === 'conflict_in_reference')) {
    return { status: 'inconclusive', label: 'inconclusive', text: String(raw), fact_results: factResults };
  }
  if (factResults.some((row) => row.status === 'mismatch')) {
    return { status: 'mismatch', label: 'contradicts reference', text: String(raw), fact_results: factResults };
  }
  if (factResults.length && factResults.every((row) => row.status === 'match')) {
    return { status: 'match', label: 'matches reference', text: String(raw), fact_results: factResults };
  }
  if (factResults.every((row) => row.status === 'missing')) {
    return { status: 'omits', label: 'observed but omits expected fact', text: String(raw), fact_results: factResults };
  }
  return { status: 'inconclusive', label: 'inconclusive', text: String(raw), fact_results: factResults };
}

export function assignCategory({ referenceOk, website, ai }) {
  if (!referenceOk) return 'inconclusive';
  if (ai.status === 'inconclusive') return 'inconclusive';
  if (ai.status === 'mismatch') return 'incorrect';
  if (website.status === 'mismatch') return 'outdated';
  if (website.status === 'partial') return 'inconclusive';
  if (website.status === 'conflict') return 'inconclusive';
  if (website.status === 'absent') return 'missing';
  if (website.status === 'match') return 'correct';
  return 'inconclusive';
}

function explainRow({ status, website, ai, expected }) {
  const parts = [];
  if (expected) parts.push(`Expected from Apex reference: ${expected}.`);
  if (website.status === 'match') parts.push('Crawled website evidence matches that fact.');
  if (website.status === 'mismatch') parts.push('Crawled website evidence disagrees with the current reference.');
  if (website.status === 'absent') parts.push('No matching website evidence was available for this fact.');
  if (ai.status === 'not_observed') parts.push(`AI answer: ${NOT_OBSERVED}. The expected fact was not treated as an assistant answer.`);
  if (ai.status === 'mismatch') parts.push('An observed AI answer contradicts the reference.');
  if (ai.status === 'match') parts.push('An observed AI answer matches the reference. That is not proof of live citation.');
  if (ai.status === 'omits') parts.push('An observed AI answer does not contain the expected fact.');
  if (status === 'inconclusive') parts.push('The question could not be given a stronger category.');
  return parts.join(' ');
}

function percent(count, total) {
  if (!total) return 0;
  return Math.round((count / total) * 1000) / 10;
}

export function buildScorecard({
  questionsPack,
  referencePack,
  session = null,
  runs = [],
} = {}) {
  const generated_at = new Date().toISOString();
  const questions = asList(questionsPack?.questions).filter((q) => q.id && q.id !== 'custom' && String(q.text || '').trim());
  const allFacts = flattenFacts(referencePack);
  const rows = questions.map((question) => {
    const facts = selectFacts(allFacts, question);
    const expected = formatExpectedAnswer(facts);
    const referenceOk = facts.length > 0 && !facts.some((fact) => fact.conflict);
    const items = evidenceForQuestion(question, facts, session);
    const website = websiteStatus(facts, items);
    const observation = latestObservation(runs, question);
    const ai = aiStatus(observation, facts);
    const status = assignCategory({
      referenceOk,
      website,
      ai: referenceOk ? ai : { status: 'inconclusive' },
    });
    const url = website.url || question.related_urls?.[0] || null;
    return {
      question_id: question.id,
      question: question.text,
      label: question.label || question.id,
      status,
      expected_fact: expected,
      expected_facts: facts.map((fact) => ({
        id: fact.id,
        entity_id: fact.entity_id,
        key: fact.key,
        value: fact.value,
        unit: fact.unit,
      })),
      website_evidence: {
        status: website.status,
        source: session ? 'crawled_html' : 'none',
        url,
        snippets: website.snippets,
      },
      ai_answer: {
        status: ai.status,
        label: ai.label,
        text: ai.text,
        run_id: observation?.id || null,
        observed_at: observation?.started_at || null,
      },
      affected_url: url,
      evidence_source: website.snippets[0]
        ? website.snippets[0].url || 'crawled_html'
        : session
          ? 'crawl session had no matching snippet'
          : 'no website crawl',
      explanation: explainRow({ status, website, ai, expected }),
    };
  });

  const totals = Object.fromEntries(SCORECARD_CATEGORIES.map((key) => [key, 0]));
  for (const row of rows) totals[row.status] += 1;
  const total = rows.length;
  const percentages = Object.fromEntries(SCORECARD_CATEGORIES.map((key) => [key, percent(totals[key], total)]));

  const ai_observations = {
    not_observed: rows.filter((row) => row.ai_answer.status === 'not_observed').length,
    observed: rows.filter((row) => row.ai_answer.status !== 'not_observed').length,
  };

  return {
    generated_at,
    set: {
      id: questionsPack?.id || 'apex-set',
      name: questionsPack?.name || 'Apex Moto starter questions',
      reference_source_id: referencePack?.source_id || null,
      reference_as_of: referencePack?.as_of || null,
      reference_label: referencePack?.label || null,
    },
    definitions: CATEGORY_DEFINITIONS,
    totals: { ...totals, questions: total },
    percentages,
    ai_observations,
    rows,
    limitations: [
      'Each question is assigned exactly one of correct, incorrect, missing, outdated, or inconclusive.',
      `${NOT_OBSERVED} means no pasted or collected assistant answer exists for that question. The reference fact is never copied in as an AI answer.`,
      'Website evidence is extracted HTML from a crawl session when one is supplied. No crawl means missing, not invented page text.',
      'A correct row is not a claim that an AI assistant cited or used the page.',
      'Outdated means the crawled value disagrees with the current trusted sheet; it is not a measured conversion or ranking change.',
    ],
  };
}
