function addFact(facts, key, value, type, unit = null) {
  if (value == null || value === '') return;
  facts.push({
    key,
    value,
    type,
    unit,
    required_in_answer: false,
  });
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/\+/g, '_plus_')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function specUnit(key) {
  if (key.endsWith('_cc')) return 'cc';
  if (key.endsWith('_bhp')) return 'bhp';
  if (key.endsWith('_nm')) return 'Nm';
  if (key.endsWith('_rpm')) return 'rpm';
  if (key.endsWith('_kmpl')) return 'km/l';
  if (key.endsWith('_km')) return 'km';
  if (key.endsWith('_mm')) return 'mm';
  if (key.endsWith('_kwh')) return 'kWh';
  if (key.endsWith('_kmph')) return 'km/h';
  if (key.endsWith('_kg')) return 'kg';
  if (key.endsWith('_l')) return 'L';
  return null;
}

function bikeFacts(bike) {
  const facts = [];
  addFact(facts, 'model_name', bike.name, 'string');
  addFact(facts, 'category', bike.category, 'string');
  addFact(facts, 'badge', bike.badge, 'string');
  addFact(facts, 'tagline', bike.tagline, 'string');
  addFact(facts, 'model_year', bike.model_year, 'number');
  addFact(facts, 'ex_showroom_price_inr', bike.ex_showroom_price_inr, 'number', 'INR');
  addFact(facts, 'availability', bike.availability, 'string');
  addFact(facts, 'colours', Array.isArray(bike.colours) ? bike.colours.join(', ') : bike.colours, 'string');
  addFact(
    facts,
    'dealer_cities',
    Array.isArray(bike.dealer_cities) ? bike.dealer_cities.join(', ') : bike.dealer_cities,
    'string'
  );
  addFact(facts, 'on_road_note', bike.on_road_note, 'string');
  addFact(facts, 'brochure_url', bike.brochure_url, 'string');

  const specs = bike.specs || {};
  addFact(facts, 'engine', specs.engine, 'string');
  addFact(facts, 'displacement_cc', specs.displacement_cc, 'number', 'cc');
  addFact(facts, 'max_power_bhp', specs.max_power_bhp ?? specs.peak_power_bhp, 'number', 'bhp');
  addFact(facts, 'max_torque_nm', specs.max_torque_nm, 'number', 'Nm');
  addFact(facts, 'mileage_kmpl', specs.mileage_kmpl, 'number', 'km/l');
  addFact(facts, 'range_km', specs.range_km, 'number', 'km');
  addFact(facts, 'seat_height_mm', specs.seat_height_mm, 'number', 'mm');
  addFact(facts, 'fuel_tank_l', specs.fuel_tank_l, 'number', 'L');
  addFact(facts, 'kerb_weight_kg', specs.kerb_weight_kg, 'number', 'kg');
  addFact(facts, 'transmission', specs.transmission, 'string');

  const mappedSpecKeys = new Set(facts.map((fact) => fact.key));
  for (const [key, value] of Object.entries(specs)) {
    if (mappedSpecKeys.has(key) || (key === 'peak_power_bhp' && mappedSpecKeys.has('max_power_bhp'))) {
      continue;
    }
    const type = typeof value === 'number' ? 'number' : 'string';
    addFact(facts, key, value, type, specUnit(key));
    mappedSpecKeys.add(key);
  }

  const onRoad = bike.on_road_price_inr || {};
  for (const [city, price] of Object.entries(onRoad)) {
    const key = `on_road_price_${city.toLowerCase().replace(/\s+/g, '_')}_inr`;
    addFact(facts, key, price, 'number', 'INR');
  }

  if (Array.isArray(bike.variants) && bike.variants.length) {
    addFact(
      facts,
      'variants',
      bike.variants
        .map((variant) =>
          variant.ex_showroom_price_inr != null
            ? `${variant.name} (${variant.ex_showroom_price_inr} INR)`
            : variant.name
        )
        .join(', '),
      'string'
    );
    for (const variant of bike.variants) {
      const slug = slugify(variant.name || 'unnamed');
      addFact(facts, `variant_${slug}_name`, variant.name, 'string');
      addFact(facts, `variant_${slug}_ex_showroom_price_inr`, variant.ex_showroom_price_inr, 'number', 'INR');
      addFact(
        facts,
        `variant_${slug}_features`,
        Array.isArray(variant.features) ? variant.features.join(', ') : variant.features,
        'string'
      );
    }
  }

  if (bike.finance) {
    addFact(facts, 'finance_provider', bike.finance.provider, 'string');
    addFact(facts, 'finance_emi_inr', bike.finance.emi_inr, 'number', 'INR');
    addFact(facts, 'finance_down_payment_inr', bike.finance.down_payment_inr, 'number', 'INR');
    addFact(facts, 'finance_interest_rate_pct', bike.finance.interest_rate_pct, 'number', '%');
    addFact(facts, 'finance_tenure_months', bike.finance.tenure_months, 'number', 'months');
    addFact(facts, 'finance_basis', bike.finance.basis, 'string');
  }

  return facts;
}

export function catalogueToReferencePack(catalogue, { baseUrl } = {}) {
  const origin = String(baseUrl || catalogue.site || '').replace(/\/$/, '');
  const entities = [];

  for (const bike of catalogue.bikes || []) {
    const path = bike.page_url || `/motorcycles/${bike.slug || bike.id}`;
    entities.push({
      id: `product:${bike.slug || bike.id}`,
      name: bike.name,
      aliases: [bike.slug, bike.id, bike.name].filter(Boolean),
      urls: origin ? [`${origin}${path}`] : [path],
      facts: bikeFacts(bike),
    });
  }

  for (const bank of catalogue.bank_finance_partners || []) {
    entities.push({
      id: `bank:${bank.bank.toLowerCase().replace(/\s+/g, '-')}`,
      name: bank.bank,
      aliases: [bank.bank],
      urls: origin ? [`${origin}/finance`] : ['/finance'],
      facts: [
        { key: 'interest_rate_pct', value: bank.interest_rate_pct, type: 'number', unit: '%', required_in_answer: false },
        { key: 'max_tenure_months', value: bank.max_tenure_months, type: 'number', unit: 'months', required_in_answer: false },
        { key: 'down_payment', value: bank.down_payment, type: 'string', required_in_answer: false },
      ],
    });
  }

  for (const dealer of catalogue.dealers || []) {
    const facts = [];
    addFact(facts, 'city', dealer.city, 'string');
    addFact(facts, 'state', dealer.state, 'string');
    addFact(facts, 'premium', dealer.premium, 'boolean');
    addFact(facts, 'phone', dealer.phone, 'string');
    addFact(facts, 'email', dealer.email, 'string');
    addFact(facts, 'address', dealer.address, 'string');
    addFact(facts, 'hours', dealer.hours, 'string');
    addFact(facts, 'services', Array.isArray(dealer.services) ? dealer.services.join(', ') : dealer.services, 'string');
    addFact(facts, 'stocks', Array.isArray(dealer.stocks) ? dealer.stocks.join(', ') : dealer.stocks, 'string');
    entities.push({
      id: `dealer:${dealer.id}`,
      name: dealer.name,
      aliases: [dealer.city, dealer.name].filter(Boolean),
      urls: origin ? [`${origin}/dealers`] : ['/dealers'],
      facts,
    });
  }

  return {
    source_id: `catalogue:${catalogue.brand || 'site'}`,
    as_of: catalogue.as_of || null,
    label: catalogue.data_label || 'Verified pack generated from the site catalogue.',
    brand: catalogue.brand || null,
    entities,
  };
}

function factKeys(entity) {
  return new Set((entity.facts || []).map((fact) => fact.key));
}

function hasFactKeys(entity, keys) {
  const available = factKeys(entity);
  return keys.every((key) => available.has(key));
}

function firstWithKeys(entities, keys) {
  return (entities || []).find((entity) => hasFactKeys(entity, keys));
}

function firstFactKey(entity, predicate) {
  return (entity?.facts || []).map((fact) => fact.key).find(predicate);
}

function pushQuestion(questions, entity, spec) {
  if (!entity) return;
  questions.push({
    related_urls: entity.urls || [],
    entity_ids: [entity.id],
    ...spec,
  });
}

export function suggestQuestions(referencePack) {
  const entities = referencePack.entities || [];
  const products = entities.filter((e) => String(e.id).startsWith('product:'));
  const dealers = entities.filter((e) => String(e.id).startsWith('dealer:'));
  const banks = entities.filter((e) => String(e.id).startsWith('bank:'));
  const questions = [
    {
      id: 'custom',
      text: '',
      entity_ids: [],
      fact_keys: [],
      kind: 'other',
      label: 'Type my own question',
    },
  ];

  for (const product of products) {
    if (!hasFactKeys(product, ['ex_showroom_price_inr'])) continue;
    pushQuestion(questions, product, {
      id: `price-${product.id}`,
      text: `What is the ex-showroom price of the ${product.name}?`,
      fact_keys: ['ex_showroom_price_inr'],
      kind: 'price',
      label: `${product.name} — price`,
    });
  }

  const specProduct =
    firstWithKeys(products, ['engine', 'max_power_bhp']) || firstWithKeys(products, ['max_power_bhp']);
  if (specProduct) {
    const keys = ['engine', 'max_power_bhp'].filter((key) => factKeys(specProduct).has(key));
    pushQuestion(questions, specProduct, {
      id: `specs-${specProduct.id}`,
      text:
        keys.includes('engine') && keys.includes('max_power_bhp')
          ? `What is the engine and peak power of the ${specProduct.name}?`
          : `What is the peak power of the ${specProduct.name}?`,
      fact_keys: keys,
      kind: 'spec',
      label: `${specProduct.name} — specs`,
    });
  }

  const rangeProduct = firstWithKeys(products, ['range_km']);
  if (rangeProduct) {
    pushQuestion(questions, rangeProduct, {
      id: `range-${rangeProduct.id}`,
      text: `What is the claimed range of the ${rangeProduct.name}?`,
      fact_keys: ['range_km'],
      kind: 'spec',
      label: `${rangeProduct.name} — range`,
    });
  }

  const onRoadProduct = products.find((product) => firstFactKey(product, (key) => key.startsWith('on_road_price_')));
  if (onRoadProduct) {
    const key =
      firstFactKey(onRoadProduct, (item) => item === 'on_road_price_delhi_inr') ||
      firstFactKey(onRoadProduct, (item) => item.startsWith('on_road_price_'));
    const city = key.replace(/^on_road_price_/, '').replace(/_inr$/, '').replace(/_/g, ' ');
    pushQuestion(questions, onRoadProduct, {
      id: `on-road-${onRoadProduct.id}`,
      text: `What is the on-road price of the ${onRoadProduct.name} in ${city}?`,
      fact_keys: [key],
      kind: 'price',
      label: `${onRoadProduct.name} — on-road`,
    });
  }

  const variantProduct = products.find((product) =>
    firstFactKey(product, (key) => key.startsWith('variant_') && key.endsWith('_ex_showroom_price_inr'))
  );
  if (variantProduct) {
    const key = firstFactKey(
      variantProduct,
      (item) => item.startsWith('variant_') && item.endsWith('_ex_showroom_price_inr')
    );
    const variantName =
      (variantProduct.facts || []).find((fact) => fact.key === key.replace(/_ex_showroom_price_inr$/, '_name'))
        ?.value || 'listed variant';
    pushQuestion(questions, variantProduct, {
      id: `variant-${variantProduct.id}`,
      text: `What is the ex-showroom price of the ${variantName} variant of the ${variantProduct.name}?`,
      fact_keys: [key],
      kind: 'variant',
      label: `${variantProduct.name} — variant`,
    });
  }

  const colourProduct = firstWithKeys(products, ['colours']);
  if (colourProduct) {
    pushQuestion(questions, colourProduct, {
      id: `colours-${colourProduct.id}`,
      text: `Which colours is the ${colourProduct.name} offered in?`,
      fact_keys: ['colours'],
      kind: 'colour',
      label: `${colourProduct.name} — colours`,
    });
  }

  const availabilityProduct = firstWithKeys(products, ['availability']);
  if (availabilityProduct) {
    pushQuestion(questions, availabilityProduct, {
      id: `availability-${availabilityProduct.id}`,
      text: `What is the availability of the ${availabilityProduct.name}?`,
      fact_keys: ['availability'],
      kind: 'availability',
      label: `${availabilityProduct.name} — availability`,
    });
  }

  const financeProduct = firstWithKeys(products, ['finance_emi_inr']);
  if (financeProduct) {
    pushQuestion(questions, financeProduct, {
      id: `finance-${financeProduct.id}`,
      text: `What is the listed monthly EMI for the ${financeProduct.name}?`,
      fact_keys: ['finance_emi_inr'],
      kind: 'finance',
      label: `${financeProduct.name} — finance`,
    });
  }

  const dealer = firstWithKeys(dealers, ['city', 'phone']) || dealers[0];
  if (dealer && hasFactKeys(dealer, ['city'])) {
    const keys = ['city', 'phone'].filter((key) => factKeys(dealer).has(key));
    pushQuestion(questions, dealer, {
      id: `dealer-${dealer.id}`,
      text: `Which city is ${dealer.name} in, and what is the dealership phone number?`,
      fact_keys: keys,
      kind: 'dealer',
      label: `${dealer.name} — dealer`,
    });
  }

  const bank = firstWithKeys(banks, ['interest_rate_pct']);
  if (bank) {
    pushQuestion(questions, bank, {
      id: `bank-${bank.id}`,
      text: `What interest rate does ${bank.name} offer as a finance partner?`,
      fact_keys: ['interest_rate_pct'],
      kind: 'finance',
      label: `${bank.name} — finance`,
    });
  }

  return questions;
}

export function questionsPackFromReference(
  referencePack,
  {
    id = 'apex-set',
    name = 'Apex Moto starter questions',
    description = 'Starter pack questions generated from the Apex Moto fact sheet. Do not put reference answers in the question text.',
  } = {}
) {
  return {
    id,
    name,
    description,
    questions: suggestQuestions(referencePack).map((question) => ({
      id: question.id,
      text: question.text,
      set_id: id,
      related_urls: question.related_urls || [],
      entity_ids: question.entity_ids || [],
      fact_keys: question.fact_keys || [],
      kind: question.kind,
      label: question.label || null,
    })),
  };
}
