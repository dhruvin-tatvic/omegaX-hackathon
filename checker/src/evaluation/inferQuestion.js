function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const KEYWORD_RULES = [
  { re: /on-?road/, keys: 'on_road' },
  { re: /ex-?showroom|price|cost|how much|rupee|\binr\b|₹/, keys: ['ex_showroom_price_inr'] },
  { re: /engine|displacement|\bcc\b/, keys: ['engine', 'displacement_cc'] },
  { re: /power|\bbhp\b/, keys: ['max_power_bhp'] },
  { re: /torque|\bnm\b/, keys: ['max_torque_nm'] },
  { re: /mileage|km\/?l|kmpl/, keys: ['mileage_kmpl'] },
  { re: /range/, keys: ['range_km'] },
  { re: /seat height|seat/, keys: ['seat_height_mm'] },
  { re: /fuel tank|tank/, keys: ['fuel_tank_l'] },
  { re: /weight|kerb/, keys: ['kerb_weight_kg'] },
  { re: /colour|color/, keys: ['colours'] },
  { re: /availab|in stock|out of stock/, keys: ['availability'] },
  { re: /\bemi\b|down payment|finance|interest/, keys: ['finance_emi_inr', 'finance_down_payment_inr', 'finance_interest_rate_pct'] },
];

function entityAliases(entity) {
  return [entity.name, entity.id, ...(entity.aliases || [])]
    .filter(Boolean)
    .map((alias) => normalize(alias.replace(/^product:|^bank:|^dealer:/, '')))
    .filter((alias) => alias.length >= 3);
}

export function findEntitiesInText(text, referencePack) {
  const hay = normalize(text);
  const matches = [];
  for (const entity of referencePack?.entities || []) {
    const aliases = entityAliases(entity).sort((a, b) => b.length - a.length);
    if (aliases.some((alias) => hay.includes(alias))) {
      matches.push(entity);
    }
  }
  return matches;
}

export function inferFactKeys(text, entities) {
  const hay = normalize(text);
  const available = new Set(
    (entities || []).flatMap((entity) => (entity.facts || []).map((fact) => fact.key))
  );
  const keys = [];

  if (KEYWORD_RULES[0].re.test(hay)) {
    for (const key of available) {
      if (key.startsWith('on_road_price_')) keys.push(key);
    }
  }

  for (const rule of KEYWORD_RULES.slice(1)) {
    if (!rule.re.test(hay)) continue;
    for (const key of rule.keys) {
      if (available.has(key)) keys.push(key);
    }
  }

  const unique = [...new Set(keys)];
  if (unique.length) return unique;
  if (available.has('ex_showroom_price_inr')) return ['ex_showroom_price_inr'];
  return [...available].slice(0, 3);
}

export function inferQuestion(text, referencePack, extraText = '') {
  const combined = `${text}\n${extraText}`;
  const entities = findEntitiesInText(combined, referencePack);
  const fact_keys = inferFactKeys(text, entities);
  return {
    id: 'custom',
    text: String(text || '').trim(),
    entity_ids: entities.map((entity) => entity.id),
    fact_keys,
    related_urls: entities.flatMap((entity) => entity.urls || []),
    matched_names: entities.map((entity) => entity.name),
    kind: fact_keys.includes('ex_showroom_price_inr') ? 'price' : 'other',
  };
}

export function factsForQuestion(referencePack, question) {
  const entityIds = new Set(question.entity_ids || []);
  const keys = new Set(question.fact_keys || []);
  const rows = [];
  for (const entity of referencePack?.entities || []) {
    if (entityIds.size && !entityIds.has(entity.id)) continue;
    if (!entityIds.size) continue;
    for (const fact of entity.facts || []) {
      if (keys.size && !keys.has(fact.key)) continue;
      rows.push({ ...fact, entity_id: entity.id, entity_name: entity.name });
    }
  }
  return rows;
}
