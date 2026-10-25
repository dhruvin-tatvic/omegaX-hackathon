const IMPROVED = 'verified_improved';
const NO_IMPROVEMENT = 'verified_no_improvement';
const INCONCLUSIVE = 'verification_inconclusive';

function includesPrice(text, price) {
  const raw = String(text || '');
  const digits = String(price);
  const compact = raw.replace(/[^\d]/g, '');
  return raw.includes(digits) || compact.includes(digits);
}

export function compareSnapshots({ fix, baseline, after }) {
  if (!baseline || !after) {
    return {
      status: INCONCLUSIVE,
      improved: false,
      explanation: 'Insufficient evidence to compare: a baseline snapshot is required before a verification status can be assigned.',
      changed: [],
    };
  }

  if (fix.type === 'product_jsonld') {
    const jsonldNow = after.has_product_jsonld || after.jsonld_has_expected;
    const mentions = after.jsonld_has_expected || after.readable_has_price || includesPrice(after.readable_excerpt, fix.expected_signals.price);
    const named = after.readable_has_name || after.jsonld_has_expected;
    const changed = [
      {
        metric: 'missing_structured_data',
        before: baseline.finding_present,
        after: after.finding_present,
      },
      {
        metric: 'has_product_jsonld',
        before: baseline.has_product_jsonld,
        after: after.has_product_jsonld,
      },
    ];
    if (baseline.finding_present && !after.finding_present && jsonldNow && mentions && named) {
      return {
        status: IMPROVED,
        improved: true,
        explanation:
          'The isolated fixture no longer has a missing Product JSON-LD finding, and the inserted Offer uses the Apex reference name and price. This is local test evidence only.',
        changed,
      };
    }
    if (baseline.finding_present && after.finding_present) {
      return {
        status: NO_IMPROVEMENT,
        improved: false,
        explanation: 'The missing Product JSON-LD finding is still present on the isolated fixture after the change.',
        changed,
      };
    }
    if (!baseline.finding_present && !after.finding_present) {
      return {
        status: INCONCLUSIVE,
        improved: false,
        explanation: 'The baseline already lacked a missing JSON-LD finding, so improvement cannot be demonstrated.',
        changed,
      };
    }
    return {
      status: NO_IMPROVEMENT,
      improved: false,
      explanation: 'JSON-LD is still missing, incomplete, or does not include the Apex reference name and price.',
      changed,
    };
  }

  if (fix.type === 'raw_html_fact') {
    const sentence = fix.expected_signals.fact_sentence;
    const beforeOnly = (baseline.rendered_only || []).some((row) => String(row).includes(sentence) || includesPrice(row, fix.expected_signals.price));
    const afterOnly = (after.rendered_only || []).some((row) => String(row).includes(sentence) || includesPrice(row, fix.expected_signals.price));
    const nowInRaw =
      after.raw_has_expected_fact ||
      String(after.readable_excerpt || '').includes(sentence) ||
      includesPrice(after.readable_excerpt, fix.expected_signals.price);
    const changed = [
      {
        metric: 'js_dependent_content',
        before: baseline.finding_present,
        after: after.finding_present,
      },
      {
        metric: 'fact_in_raw_html',
        before: Boolean(baseline.raw_has_expected_fact),
        after: nowInRaw,
      },
    ];
    if (baseline.finding_present && beforeOnly && nowInRaw && !afterOnly) {
      return {
        status: IMPROVED,
        improved: true,
        explanation:
          'The Nightfall 350 ex-showroom price from the Apex reference pack is now present in the raw demo HTML and is no longer only in the rendered snapshot. This is local test evidence only.',
        changed,
      };
    }
    if (nowInRaw && !after.finding_present && baseline.finding_present) {
      return {
        status: IMPROVED,
        improved: true,
        explanation:
          'The rendered-only finding for this demo page is gone after the raw HTML received the catalogue price. This is local test evidence only.',
        changed,
      };
    }
    if (baseline.finding_present && after.finding_present && !nowInRaw) {
      return {
        status: NO_IMPROVEMENT,
        improved: false,
        explanation: 'The catalogue price is still absent from the raw demo HTML, so the rendered-only finding remains.',
        changed,
      };
    }
    if (!baseline.finding_present) {
      return {
        status: INCONCLUSIVE,
        improved: false,
        explanation: 'The baseline did not show a rendered-only gap, so improvement cannot be demonstrated.',
        changed,
      };
    }
    return {
      status: NO_IMPROVEMENT,
      improved: false,
      explanation: 'The raw-HTML fact change did not remove the rendered-only finding on the isolated fixture.',
      changed,
    };
  }

  return {
    status: INCONCLUSIVE,
    improved: false,
    explanation: 'This demo fix type has no comparison rule.',
    changed: [],
  };
}
