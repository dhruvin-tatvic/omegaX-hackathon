import { extractMoneyNumbers, extractNumbers, numbersEqual } from './numbers.js';

const STOP = new Set(
  'the a an of to for on in at and or is are was were what how much does do about website page listed price from with that this'.split(
    ' '
  )
);

const GENERIC = new Set([
  'price',
  'cost',
  'showroom',
  'listed',
  'rupee',
  'rupees',
  'inr',
  'website',
  'page',
  'product',
  'model',
  'ex',
]);

function distinctiveTokens(text) {
  return tokens(text).filter((t) => t.length > 3 && !GENERIC.has(t) && !/^\d+$/.test(t));
}

export function tokens(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9₹]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

export function splitClaims(answerText) {
  return String(answerText || '')
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

function scoreEvidence(queryTokens, item) {
  const itemTokens = new Set(tokens(item.text));
  let overlap = 0;
  for (const t of queryTokens) if (itemTokens.has(t)) overlap += 1;
  return overlap;
}

export function relevantEvidence(question, session, minScore = 1) {
  const qTokens = tokens(question);
  const qNumbers = extractNumbers(question);
  const ranked = (session.evidence || [])
    .map((item) => {
      let score = scoreEvidence(qTokens, item);
      if (qNumbers.some((n) => (item.numbers || []).some((m) => numbersEqual(n, m)))) score += 3;
      return { item, score };
    })
    .filter((row) => row.score >= minScore)
    .sort((a, b) => b.score - a.score);
  return ranked;
}

function relatedForClaim(claim, evidenceRows) {
  const cTokens = tokens(claim);
  const cNumbers = extractNumbers(claim);
  return evidenceRows
    .map(({ item, score }) => {
      let s = scoreEvidence(cTokens, item) + score * 0.15;
      if (cNumbers.some((n) => (item.numbers || []).some((m) => numbersEqual(n, m)))) s += 4;
      return { item, score: s, numbers: item.numbers || [] };
    })
    .filter((row) => row.score >= 1)
    .sort((a, b) => b.score - a.score);
}

export function evaluateAgainstEvidence({ question, answerText, session, collectionError = null }) {
  const limitations = [
    'Website-sourced evidence is extracted from public HTML and is not independently audited truth.',
    'JavaScript-only or image/PDF-only facts may be missing from this crawl.',
    'A citation is not treated as proof, and missing evidence is not treated as a contradiction.',
  ];

  if (collectionError) {
    return {
      overall_category: 'inconclusive',
      explanation: `The answer could not be collected: ${collectionError}`,
      claim_results: [],
      complete: false,
      limitations,
      evidence_coverage: null,
    };
  }

  const text = String(answerText || '').trim();
  if (!text) {
    return {
      overall_category: 'inconclusive',
      explanation: 'No answer was provided.',
      claim_results: [],
      complete: false,
      limitations,
      evidence_coverage: null,
    };
  }

  const priceQuestion = /price|cost|₹|inr|emi|rupee/i.test(question);
  const ranked = relevantEvidence(question, session);
  const coverage = {
    origin: session.origin,
    crawled_at: session.crawled_at,
    pages_visited: session.pages_visited?.length || 0,
    pages_failed: session.pages_failed?.length || 0,
    evidence_items: session.evidence?.length || 0,
    relevant_items: ranked.length,
    conflicts: session.conflicts || [],
    js_likely: session.js_likely_urls || [],
    label: session.label,
  };

  if (!ranked.length) {
    return {
      overall_category: 'insufficient_evidence',
      explanation:
        'Insufficient evidence: the crawl did not find website text that is relevant to this question, so the answer was not marked true or false.',
      claim_results: [],
      complete: true,
      limitations,
      evidence_coverage: coverage,
      recommendations: recommendationsFor(session, 'insufficient_evidence'),
    };
  }

  const claims = splitClaims(text);
  const work = claims.length ? claims : [text];
  const claim_results = work.map((claim, index) => {
    const claimNumbers = priceQuestion ? extractMoneyNumbers(claim) : extractNumbers(claim);
    const related = relatedForClaim(claim, ranked).slice(0, 5);
    const questionTokens = new Set(tokens(question));
    const namedTokens = distinctiveTokens(`${question} ${claim}`);
    const supporting = related.filter((row) => {
      if (claimNumbers.length) {
        const itemTokens = new Set(tokens(row.item.text));
        const named = namedTokens.some((t) => itemTokens.has(t));
        const moneyHit = (priceQuestion ? extractMoneyNumbers(row.item.text) : row.numbers).some((m) =>
          claimNumbers.some((n) => numbersEqual(n, m))
        );
        return moneyHit && named;
      }
      const extra = tokens(claim).filter((t) => !questionTokens.has(t));
      const itemTokens = new Set(tokens(row.item.text));
      return extra.filter((t) => itemTokens.has(t)).length >= 2;
    });
    const contradicting = related.filter((row) => {
      if (!claimNumbers.length) return false;
      const itemTokens = new Set(tokens(row.item.text));
      const named = namedTokens.some((t) => itemTokens.has(t));
      if (!named) return false;
      const money = priceQuestion ? extractMoneyNumbers(row.item.text) : row.numbers;
      const supports = claimNumbers.some((n) => money.some((m) => numbersEqual(n, m)));
      if (supports) return false;
      return money.length > 0 && row.score >= 2;
    });

    let status = 'unsupported';
    let detail = 'The website crawl did not mention this claim.';
    if (session.conflicts?.length && claimNumbers.length) {
      const hit = session.conflicts.find((c) => {
        const blob = `${c.context || ''} ${(c.snippets || []).join(' ')}`.toLowerCase();
        const named = distinctiveTokens(`${question} ${claim}`).some((t) => blob.includes(t));
        if (!named) return false;
        return (
          c.values.some((v) => claimNumbers.some((n) => numbersEqual(n, v))) &&
          c.values.some((v) => !claimNumbers.some((n) => numbersEqual(n, v)))
        );
      });
      if (hit && hit.values.length > 1) {
        status = 'conflict_in_reference';
        detail = `Multiple pages disagree (${hit.values.join(' vs ')}) for similar content.`;
      }
    }
    if (status !== 'conflict_in_reference') {
      if (supporting.length && contradicting.length) {
        status = 'mismatch';
        detail = 'Some pages support this claim and others list a different value.';
      } else if (contradicting.length && !supporting.length) {
        status = 'mismatch';
        detail = `Website evidence lists ${contradicting[0].numbers[0]} rather than the claimed value.`;
      } else if (supporting.length) {
        status = 'match';
        detail = 'Website text supports this claim.';
      } else if (claimNumbers.length && ranked.some((r) => r.item.numbers?.length)) {
        status = 'unsupported';
        detail = 'This numeric claim was not found in crawled website evidence.';
      }
    }

    const evidenceFor = (status === 'mismatch' ? contradicting : supporting).length
      ? status === 'mismatch'
        ? contradicting
        : supporting
      : related.slice(0, 2);

    return {
      fact_id: `claim-${index + 1}`,
      key: `claim_${index + 1}`,
      claim,
      expected: evidenceFor[0]?.item.text || null,
      observed: claimNumbers[0] ?? null,
      status,
      detail,
      required: true,
      sources: evidenceFor.map((row) => ({
        url: row.item.url,
        text: row.item.text,
        kind: row.item.kind,
      })),
    };
  });

  const overall = rollupEvidence(claim_results);
  return {
    overall_category: overall,
    explanation: explainEvidence(overall, claim_results),
    claim_results,
    complete: true,
    limitations,
    evidence_coverage: coverage,
    recommendations: recommendationsFor(session, overall),
  };
}

export function rollupEvidence(claimResults) {
  if (!claimResults.length) return 'insufficient_evidence';
  if (claimResults.some((c) => c.status === 'conflict_in_reference')) return 'inconclusive';
  const matches = claimResults.filter((c) => c.status === 'match').length;
  const mismatches = claimResults.filter((c) => c.status === 'mismatch').length;
  const unsupported = claimResults.filter((c) => c.status === 'unsupported').length;
  if (mismatches && !matches) return 'incorrect';
  if (matches && mismatches) return 'partially_correct';
  if (matches && unsupported) return 'partially_correct';
  if (matches && !mismatches && !unsupported) return 'correct';
  if (!matches && !mismatches && unsupported) return 'unsupported';
  return 'inconclusive';
}

function explainEvidence(category, claims) {
  const lines = {
    correct: 'The answer matches website-sourced evidence for the checkable claims.',
    partially_correct: 'Some claims match the website, while others are missing or contradicted.',
    incorrect: 'The answer conflicts with website-sourced evidence.',
    unsupported:
      'The website was crawled, but it does not mention these claims. That is not the same as proving them false.',
    inconclusive: 'Pages disagree or the test could not be completed cleanly.',
    insufficient_evidence: 'Insufficient evidence was extracted to judge this question.',
  };
  const extra = claims.map((c) => `${c.status}: ${c.detail}`).join(' ');
  return `${lines[category] || lines.inconclusive} ${extra}`.trim();
}

export function recommendationsFor(session, category) {
  const recs = [];
  if (session.js_likely_urls?.length) {
    recs.push({
      basis: 'possible_factor',
      title: 'Important facts may be missing from initial HTML',
      suggestion: 'Publish key facts in server-rendered HTML, not only after JavaScript.',
      expected_benefit: 'Crawlers and some AI systems may then see the same facts users see.',
      evidence_urls: session.js_likely_urls.slice(0, 5),
      confidence: 'medium',
      verification_steps: ['Fetch the page without JavaScript and confirm the fact is present.'],
    });
  }
  if (session.conflicts?.length) {
    recs.push({
      basis: 'confirmed_site_issue',
      title: 'Resolve conflicting values across pages',
      suggestion: 'Make prices and specs consistent, or clearly label outdated pages.',
      expected_benefit: 'Reduces the chance that an AI cites the wrong figure.',
      evidence_urls: session.conflicts.flatMap((c) => c.urls).slice(0, 6),
      confidence: 'high',
      verification_steps: ['Compare the listed URLs and keep a single canonical value.'],
    });
  }
  if (session.pages_failed?.length) {
    recs.push({
      basis: 'possible_factor',
      title: 'Some pages could not be fetched',
      suggestion: 'Review HTTP errors, robots rules, and bot blocks for public content.',
      expected_benefit: 'More of the site can be used as evidence.',
      evidence_urls: session.pages_failed.map((p) => p.url).slice(0, 5),
      confidence: 'medium',
      verification_steps: ['Retry the failed URLs from a public network without logging in.'],
    });
  }
  if (category === 'insufficient_evidence') {
    recs.push({
      basis: 'unverified_explanation',
      title: 'The crawl did not find enough on-page evidence for this question',
      suggestion: 'Add a clear, crawlable statement answering the question, or confirm it lives only in PDFs/images.',
      expected_benefit: 'Future answer tests can be scored against visible text.',
      evidence_urls: [],
      confidence: 'low',
      verification_steps: ['Search the live page for the fact with JavaScript disabled.'],
    });
  }
  recs.forEach((r) => {
    r.caveat = 'These steps may not change AI answers. They are investigation leads, not guarantees.';
  });
  return recs;
}
