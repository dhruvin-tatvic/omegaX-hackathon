import { extractNumbers, numbersEqual, parseNumber } from './numbers.js';

export function flattenFacts(referencePack) {
  const facts = [];
  for (const entity of referencePack.entities || []) {
    const seenKeys = new Map();
    for (const fact of entity.facts || []) {
      const id = `${entity.id}:${fact.key}`;
      const rec = {
        id,
        entity_id: entity.id,
        entity_name: entity.name,
        key: fact.key,
        value: fact.value,
        type: fact.type || 'string',
        unit: fact.unit || null,
        required_in_answer: Boolean(fact.required_in_answer),
      };
      if (!seenKeys.has(fact.key)) seenKeys.set(fact.key, []);
      seenKeys.get(fact.key).push(rec);
      facts.push(rec);
    }
    for (const list of seenKeys.values()) {
      if (list.length > 1) {
        const values = [...new Set(list.map((f) => String(f.value)))];
        if (values.length > 1) {
          for (const rec of list) rec.conflict = true;
        }
      }
    }
  }
  return facts;
}

export function selectFacts(allFacts, question) {
  const entityIds = new Set(question.entity_ids || []);
  const keys = new Set(question.fact_keys || []);
  return allFacts.filter((fact) => {
    const entityOk = entityIds.size === 0 || entityIds.has(fact.entity_id);
    const keyOk = keys.size === 0 || keys.has(fact.key);
    return entityOk && keyOk;
  });
}

function normalizeString(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function evaluateFact(fact, answerText) {
  if (fact.conflict) {
    return {
      fact_id: fact.id,
      key: fact.key,
      expected: fact.value,
      status: 'conflict_in_reference',
      observed: null,
      detail: 'Verified pack contains conflicting values for this fact.',
    };
  }

  if (fact.type === 'number') {
    const expected = parseNumber(fact.value);
    const found = extractNumbers(answerText);
    const matched = found.find((n) => numbersEqual(n, expected));
    if (matched != null) {
      return {
        fact_id: fact.id,
        key: fact.key,
        expected,
        status: 'match',
        observed: matched,
        detail: `Found expected value ${expected} in the answer.`,
      };
    }
    if (found.length > 0) {
      return {
        fact_id: fact.id,
        key: fact.key,
        expected,
        status: 'mismatch',
        observed: found[0],
        detail: `Answer contains ${found[0]} but verified value is ${expected}.`,
      };
    }
    return {
      fact_id: fact.id,
      key: fact.key,
      expected,
      status: 'missing',
      observed: null,
      detail: 'Required numeric value was not found in the answer.',
    };
  }

  const expected = normalizeString(fact.value);
  const haystack = normalizeString(answerText);
  if (expected && haystack.includes(expected)) {
    return {
      fact_id: fact.id,
      key: fact.key,
      expected: fact.value,
      status: 'match',
      observed: fact.value,
      detail: 'Expected text appears in the answer.',
    };
  }
  if (!haystack) {
    return {
      fact_id: fact.id,
      key: fact.key,
      expected: fact.value,
      status: 'missing',
      observed: null,
      detail: 'Answer is empty.',
    };
  }
  return {
    fact_id: fact.id,
    key: fact.key,
    expected: fact.value,
    status: 'missing',
    observed: null,
    detail: 'Expected text was not found in the answer.',
  };
}

export function rollupCategory(claimResults, { hasAnswer, collectionError, noReference } = {}) {
  if (collectionError || noReference) return 'inconclusive';
  if (!hasAnswer) return 'inconclusive';

  const required = claimResults.filter((c) => c.required);
  const work = required.length ? required : claimResults;
  if (work.length === 0) return 'unsupported';

  if (work.some((c) => c.status === 'conflict_in_reference')) return 'inconclusive';

  const matches = work.filter((c) => c.status === 'match').length;
  const mismatches = work.filter((c) => c.status === 'mismatch').length;
  const missings = work.filter((c) => c.status === 'missing').length;
  const unsupported = work.filter((c) => c.status === 'unsupported').length;

  if (mismatches > 0 && matches === 0) return 'incorrect';
  if (matches === work.length && mismatches === 0 && missings === 0) return 'correct';
  if (matches > 0 && (missings > 0 || mismatches > 0)) return 'partially_correct';
  if (matches === 0 && missings === work.length) return 'incorrect';
  if (unsupported > 0 && matches === 0 && mismatches === 0) return 'unsupported';
  return 'inconclusive';
}

function explain(category, claimResults) {
  const lines = {
    correct: 'All required verified facts appear in the answer, with no contradicting values.',
    partially_correct:
      'Some required facts match, but the answer is incomplete or also contains a mismatch.',
    incorrect: 'The answer contradicts verified facts, or omits every required fact.',
    unsupported: 'The answer could not be checked against verified facts.',
    inconclusive:
      'The test could not be completed, or the reference data is missing or conflicting.',
  };
  const details = claimResults
    .map((c) => {
      const bits = [`${c.key}: ${c.status}`];
      if (c.observed != null) bits.push(`observed ${c.observed}`);
      if (c.expected != null && c.status !== 'match') bits.push(`expected ${c.expected}`);
      return bits.join(', ');
    })
    .join('; ');
  return `${lines[category] || lines.inconclusive}${details ? ` ${details}.` : ''}`;
}

export function evaluateAnswer({
  question,
  answerText,
  referencePack,
  collectionError = null,
}) {
  const limitations = [
    'Deterministic checks look for expected numbers and strings in the original answer text.',
    'A citation is not treated as proof, and a missing citation is not treated as disproof.',
    'API answers may not have browsed the live website.',
  ];

  if (collectionError) {
    return {
      overall_category: 'inconclusive',
      claim_results: [],
      explanation: `The answer could not be collected: ${collectionError}`,
      fact_ids_used: [],
      limitations,
      complete: false,
    };
  }

  if (!referencePack || !(referencePack.entities || []).length) {
    return {
      overall_category: 'inconclusive',
      claim_results: [],
      explanation: 'No verified reference pack is loaded, so the answer cannot be scored.',
      fact_ids_used: [],
      limitations,
      complete: false,
    };
  }

  const allFacts = flattenFacts(referencePack);
  const selected = selectFacts(allFacts, question || {});
  const text = answerText == null ? '' : String(answerText);
  const claimResults = selected.map((fact) => ({
    ...evaluateFact(fact, text),
    required: fact.required_in_answer,
    unit: fact.unit,
    entity_id: fact.entity_id,
  }));

  const extraNumbers = extractNumbers(text).filter(
    (n) =>
      !selected.some(
        (fact) => fact.type === 'number' && !fact.conflict && numbersEqual(parseNumber(fact.value), n)
      )
  );
  if (extraNumbers.length && selected.some((f) => f.type === 'number')) {
    // Extra figures are notes, not automatic failures.
    limitations.push(
      `The answer also contained numeric values not in the selected reference facts: ${extraNumbers.join(', ')}.`
    );
  }

  const overall = rollupCategory(claimResults, {
    hasAnswer: text.trim().length > 0,
    collectionError: null,
    noReference: false,
  });

  return {
    overall_category: overall,
    claim_results: claimResults,
    explanation: explain(overall, claimResults),
    fact_ids_used: claimResults.map((c) => c.fact_id),
    limitations,
    complete: true,
  };
}
