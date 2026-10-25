/**
 * Deterministic ground-truth selection and question analysis for LLM comparison.
 */

const CITIES = ['Delhi', 'Mumbai', 'Bangalore', 'Pune', 'Chennai', 'Hyderabad', 'Jaipur', 'Kolkata'];

/** User said "Zenith 450" but site model is Zenith 450 Scrambler */
const MODEL_ALIASES = [
  { pattern: /\bzenith\s*450\b/i, slug: 'zenith-450-scrambler' },
  { pattern: /\bthunderstrike\s*650\s*rally\b/i, slug: 'thunderstrike-650-rally' },
  { pattern: /\bthunderstrike\s*650\b/i, slug: 'thunderstrike-650' },
  { pattern: /\bthunderstrike\s*450\b/i, slug: 'thunderstrike-450' },
  { pattern: /\bphantom\s*350\b/i, slug: 'phantom-350' },
  { pattern: /\bstorm\s*200\b/i, slug: 'storm-200' },
];

export function extractCities(text) {
  const found = [];
  const lower = text.toLowerCase();
  for (const city of CITIES) {
    if (lower.includes(city.toLowerCase())) found.push(city);
  }
  return found;
}

export function classifyIntent(input) {
  const q = input.toLowerCase();
  if (/cheapest|lowest|most affordable|least expensive/.test(q)) return 'cheapest_ex_showroom';
  if (/expensive|costliest|highest price|most expensive/.test(q)) return 'most_expensive_ex_showroom';
  if (/on[- ]?road/.test(q)) return 'on_road_price';
  if (/colour|color/.test(q)) return 'colours';
  if (/mileage|km\/l|range/.test(q)) return 'mileage_or_range';
  if (/spec|technical|engine|torque|bhp/.test(q)) return 'specifications';
  if (/similar|also like|comparable|might also/.test(q)) return 'similar_models';
  if (/price|₹|inr|cost|how much/.test(q)) return 'ex_showroom_price';
  return 'general';
}

function modelsMatchingText(facts, text) {
  const lower = text.toLowerCase();
  const hits = new Set();
  for (const m of facts.models) {
    const name = m.name.toLowerCase();
    const slugSpaced = m.slug.replace(/-/g, ' ');
    if (lower.includes(name) || lower.includes(slugSpaced)) hits.add(m.slug);
    else {
      const tokens = name.split(/\s+/).filter(Boolean);
      if (tokens.length >= 2 && tokens.every(t => lower.includes(t))) hits.add(m.slug);
    }
  }
  for (const { pattern, slug } of MODEL_ALIASES) {
    if (pattern.test(text) && facts.models.some(m => m.slug === slug)) hits.add(slug);
  }
  return facts.models.filter(m => hits.has(m.slug));
}

function compactModel(m, { full = false, cities = [] } = {}) {
  const base = {
    slug: m.slug,
    name: m.name,
    category: m.category,
    ex_showroom_inr: m.ex_showroom_inr,
    engine: m.engine,
    power: m.power,
    torque: m.torque,
    mileage_or_range: m.mileage_or_range,
    availability: m.availability,
    colours: m.colours,
    variants: m.variants,
    on_road_inr: m.on_road_inr,
    key_features: m.key_features,
    page_url: m.page_url,
  };
  if (cities.length && m.on_road_inr) {
    base.on_road_for_question_cities = {};
    for (const c of cities) {
      if (m.on_road_inr[c] != null) base.on_road_for_question_cities[c] = m.on_road_inr[c];
    }
  }
  if (full) base.specs = m.specs;
  return base;
}

/**
 * Build the minimal authoritative fact bundle for one Q&A row.
 */
export function buildGroundTruthPackage(facts, input, output) {
  const combined = `${input}\n${output}`;
  const intent = classifyIntent(input);
  const cities = extractCities(combined);
  const matched = modelsMatchingText(facts, combined);

  const needsFull = /spec|colour|color|variant|on[- ]?road|mileage|range|finance|emi|similar/i.test(input);

  const payload = {
    question_intent: intent,
    cities_mentioned: cities,
    meta: {
      source: facts.meta.source,
      scraped_at: facts.meta.scraped_at,
      currency: facts.meta.currency || 'INR',
      notes: facts.meta.notes,
    },
    catalogue_summary: {
      models_listed: facts.summary.models_listed,
      lowest_ex_showroom_inr: facts.summary.lowest_ex_showroom_inr,
      highest_ex_showroom_inr: facts.summary.highest_ex_showroom_inr,
      lowest_price_model: null,
      highest_price_model: null,
    },
    evaluation_rules: [
      'Ground truth is ONLY from this JSON (Firecrawl scrape of the live site).',
      'Ex-showroom fields are ex_showroom_inr unless on_road_inr or on_road_for_question_cities is used.',
      'If the AI refused, guessed, or used off-site brands, score down and tag access_failure or hallucination.',
      'If the question is cheapest/most expensive, use full catalogue_summary, not homepage featured cards only.',
      'Partial credit only when the AI states correct facts but omits required fields for the question intent.',
    ],
  };

  const priced = [...facts.models].filter(m => m.ex_showroom_inr != null);
  priced.sort((a, b) => a.ex_showroom_inr - b.ex_showroom_inr);
  if (priced.length) {
    payload.catalogue_summary.lowest_price_model = {
      name: priced[0].name,
      slug: priced[0].slug,
      ex_showroom_inr: priced[0].ex_showroom_inr,
    };
    const hi = priced[priced.length - 1];
    payload.catalogue_summary.highest_price_model = {
      name: hi.name,
      slug: hi.slug,
      ex_showroom_inr: hi.ex_showroom_inr,
    };
  }

  if (intent === 'cheapest_ex_showroom') {
    payload.authoritative_answer_hint = {
      type: 'cheapest',
      models_top_5_by_price: priced.slice(0, 5).map(m => ({
        name: m.name,
        slug: m.slug,
        ex_showroom_inr: m.ex_showroom_inr,
      })),
      homepage_caveat:
        'Featured homepage cards may hide prices (e.g. Storm 200). Cheapest in full catalogue may differ from featured-only answers.',
    };
  }

  if (intent === 'most_expensive_ex_showroom') {
    const sorted = [...facts.models].sort((a, b) => b.ex_showroom_inr - a.ex_showroom_inr);
    payload.authoritative_answer_hint = {
      type: 'most_expensive',
      top_models: sorted.slice(0, 3).map(m => ({
        name: m.name,
        slug: m.slug,
        ex_showroom_inr: m.ex_showroom_inr,
      })),
    };
  }

  if (intent === 'similar_models') {
    const storm = facts.models.find(m => m.slug === 'storm-200');
    if (storm) {
      payload.reference_model = compactModel(storm, { full: false });
      payload.authoritative_answer_hint = {
        type: 'similar_to_storm_200',
        note: 'Use site "You Might Also Like" or related models on storm-200 page if present in scrape; do not invent models.',
      };
    }
  }

  if (matched.length) {
    payload.models = matched.map(m => compactModel(m, { full: needsFull, cities }));
  } else if (intent === 'cheapest_ex_showroom' || intent === 'most_expensive_ex_showroom') {
    payload.models = [];
  } else {
    payload.models = facts.models.map(m => ({
      name: m.name,
      slug: m.slug,
      ex_showroom_inr: m.ex_showroom_inr,
      category: m.category,
    }));
  }

  return payload;
}

/** Lightweight numeric hints for the model (not a verdict). */
export function extractInrMentions(text) {
  const amounts = [];
  const re = /₹\s*([\d,]+(?:\.\d+)?)|(?:INR|Rs\.?)\s*([\d,]+(?:\.\d+)?)/gi;
  let m;
  while ((m = re.exec(text))) {
    const raw = (m[1] || m[2]).replace(/,/g, '');
    const n = Number(raw);
    if (!Number.isNaN(n)) amounts.push(n);
  }
  return [...new Set(amounts)];
}
