import { createHash } from 'node:crypto';

export const DEMO_LABEL = 'LOCAL DEMO FIXTURE';

export const FIXTURE_ORIGIN = 'https://apply-demo.invalid';

export const STATUSES = [
  'proposed',
  'applied',
  'verified_improved',
  'verified_no_improvement',
  'verification_inconclusive',
  'rolled_back',
];

const JSONLD_SLOT = '<!-- LOCAL-DEMO-FIX:jsonld:slot -->';
const RAW_FACT_SLOT = '<!-- LOCAL-DEMO-FIX:raw-fact:slot -->';

export function formatInr(amount) {
  const digits = String(Math.round(Number(amount)));
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3);
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return grouped ? `${grouped},${last3}` : last3;
}

export function entityFact(referencePack, entityId, key) {
  const entity = (referencePack?.entities || []).find((row) => row.id === entityId);
  if (!entity) throw new Error(`Reference entity ${entityId} is not in the loaded pack.`);
  const fact = (entity.facts || []).find((row) => row.key === key);
  if (!fact) throw new Error(`Reference fact ${entityId}:${key} is not in the loaded pack.`);
  return { entity, fact };
}

export function sha256(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function jsonLdBlock({ name, price, currency, availability }) {
  const availabilityUrl =
    String(availability).toLowerCase() === 'in stock' ? 'https://schema.org/InStock' : 'https://schema.org/PreOrder';
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    brand: 'Apex Moto',
    offers: {
      '@type': 'Offer',
      priceCurrency: currency || 'INR',
      price: String(price),
      availability: availabilityUrl,
    },
  };
  return [
    '<!-- LOCAL-DEMO-FIX:jsonld:start -->',
    '<script type="application/ld+json">',
    JSON.stringify(payload),
    '</script>',
    '<!-- LOCAL-DEMO-FIX:jsonld:end -->',
  ].join('\n');
}

function rawFactBlock({ name, price }) {
  return [
    '<!-- LOCAL-DEMO-FIX:raw-fact:start -->',
    `<p class="price">Ex-showroom price for the ${name} is ₹${formatInr(price)} in the Apex Moto catalogue.</p>`,
    '<!-- LOCAL-DEMO-FIX:raw-fact:end -->',
  ].join('\n');
}

export function demoFixes(referencePack) {
  const thunder = entityFact(referencePack, 'product:thunderstrike-650', 'ex_showroom_price_inr');
  const thunderAvail = entityFact(referencePack, 'product:thunderstrike-650', 'availability');
  const nightfall = entityFact(referencePack, 'product:nightfall-350', 'ex_showroom_price_inr');

  return [
    {
      id: 'demo-jsonld-thunderstrike-650',
      type: 'product_jsonld',
      title: 'Add Product JSON-LD on this product-like page',
      file: 'thunderstrike-650.html',
      entity_id: thunder.entity.id,
      fixture_url: `${FIXTURE_ORIGIN}/motorcycles/thunderstrike-650`,
      finding_category: 'missing_structured_data',
      source_test: 'readability',
      recommended_change:
        'Insert Product/Offer JSON-LD into the isolated Thunderstrike 650 demo HTML using the Apex reference name, ex-showroom price, and availability. Do not invent values.',
      patch(html) {
        if (!html.includes(JSONLD_SLOT)) {
          throw new Error('The JSON-LD slot is missing from the Thunderstrike demo fixture.');
        }
        if (html.includes('LOCAL-DEMO-FIX:jsonld:start')) {
          throw new Error('The JSON-LD demo fix is already present in the fixture.');
        }
        return html.replace(
          JSONLD_SLOT,
          jsonLdBlock({
            name: thunder.entity.name,
            price: thunder.fact.value,
            currency: thunder.fact.unit,
            availability: thunderAvail.fact.value,
          })
        );
      },
      expected_signals: {
        product_name: thunder.entity.name,
        price: thunder.fact.value,
        currency: thunder.fact.unit || 'INR',
      },
    },
    {
      id: 'demo-raw-html-nightfall-350',
      type: 'raw_html_fact',
      title: 'Put key facts in raw HTML as well as the rendered page',
      file: 'nightfall-350.html',
      rendered_file: 'nightfall-350.rendered.html',
      entity_id: nightfall.entity.id,
      fixture_url: `${FIXTURE_ORIGIN}/motorcycles/nightfall-350`,
      finding_category: 'js_dependent_content',
      source_test: 'readability',
      fact_sentence: `Ex-showroom price for the ${nightfall.entity.name} is ₹${formatInr(nightfall.fact.value)} in the Apex Moto catalogue.`,
      recommended_change:
        'Copy the Nightfall 350 ex-showroom price from the Apex reference pack into the raw HTML of the isolated demo page so HTTP-only readers see the same fact as the labelled rendered snapshot.',
      patch(html) {
        if (!html.includes(RAW_FACT_SLOT)) {
          throw new Error('The raw-fact slot is missing from the Nightfall demo fixture.');
        }
        if (html.includes('LOCAL-DEMO-FIX:raw-fact:start')) {
          throw new Error('The raw-HTML demo fix is already present in the fixture.');
        }
        return html.replace(
          RAW_FACT_SLOT,
          rawFactBlock({
            name: nightfall.entity.name,
            price: nightfall.fact.value,
          })
        );
      },
      expected_signals: {
        product_name: nightfall.entity.name,
        price: nightfall.fact.value,
        fact_sentence: `Ex-showroom price for the ${nightfall.entity.name} is ₹${formatInr(nightfall.fact.value)} in the Apex Moto catalogue.`,
      },
    },
  ];
}

export function getDemoFix(referencePack, id) {
  const fix = demoFixes(referencePack).find((row) => row.id === id);
  if (!fix) {
    throw new Error(`Unknown demo fix "${id}". Only the isolated local demo fixes can be applied.`);
  }
  return fix;
}
