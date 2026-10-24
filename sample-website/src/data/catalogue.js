// =============================================
// APEX MOTO — Master Data Adapter
// Single source of truth: src/data/catalogue.json
// NEVER import from the old motorcycles.js / dealers.js in new code.
// =============================================

import catalogueRaw from './catalogue.json';
import problemsPractice from '../config/problems_practice.json';
import problemsDryrun from '../config/problems_dryrun.json';

import imgThunderstrike from '../assets/images/motorcycle_thunderstrike.jpg';
import imgPhantom from '../assets/images/motorcycle_phantom.jpg';
import imgStorm from '../assets/images/motorcycle_storm.jpg';
import imgZenith from '../assets/images/motorcycle_zenith.jpg';

// --- Scenario Selection (set by VITE_SCENARIO env var at build time) ---
const SCENARIO = import.meta.env?.VITE_SCENARIO === 'dryrun' ? 'dryrun' : 'practice';
export const problems = SCENARIO === 'dryrun' ? problemsDryrun : problemsPractice;
export const scenario = SCENARIO;

// --- Raw catalogue ---
export const catalogue = catalogueRaw;
export const allBikes = catalogueRaw.bikes;
export const allDealers = catalogueRaw.dealers;
export const bankPartners = catalogueRaw.bank_finance_partners;

// --- Planted problem helpers ---
export const jsOnlyBikes = problems.js_only_content?.enabled ? (problems.js_only_content.bikes ?? []) : [];
export const tabsNotInHtmlBikes = problems.tabs_not_in_html?.enabled ? (problems.tabs_not_in_html.bikes ?? []) : [];
export const missingJsonldBikes = problems.missing_jsonld?.enabled ? (problems.missing_jsonld.bikes ?? []) : [];
export const priceOnlyInPdfBikes = problems.price_only_in_pdf?.enabled ? (problems.price_only_in_pdf.bikes ?? []) : [];
export const imageOnlySpecsBikes = problems.image_only_specs?.enabled ? (problems.image_only_specs.bikes ?? []) : [];
export const financeNotOnSiteBikes = problems.finance_not_on_site?.enabled ? (problems.finance_not_on_site.bikes ?? []) : [];
export const conflictingPriceBikes = problems.conflicting_price?.enabled ? (problems.conflicting_price.bikes ?? []) : [];
export const conflictingPricePage = problems.conflicting_price?.page ?? '/offers';
export const conflictingPriceWrong = problems.conflicting_price?.wrong_ex_showroom_price_inr ?? 0;
export const staleBikeSlug = problems.stale_page?.enabled ? (problems.stale_page?.bikes ?? [])[0] : null;
export const stalePageUrl = problems.stale_page?.enabled ? (problems.stale_page?.url ?? null) : null;
export const offerTermsConflict = problems.offer_terms_conflict?.enabled ?? false;
export const robotsBlockDealers = problems.robots_block_dealers?.enabled ?? false;
export const robotsBlockDealersAgents = problems.robots_block_dealers?.user_agents ?? [];
export const firewallBlock = problems.firewall_block;

// --- Utility: Indian number formatting ---
export function formatINR(num) {
  if (num == null) return '';
  return '₹' + Number(num).toLocaleString('en-IN');
}

// --- Image helper ---
export function getBikeImage(bike) {
  if (!bike) return imgThunderstrike;
  const slug = (bike.slug || '').toLowerCase();
  const cat = (bike.category || '').toLowerCase();

  if (slug.includes('thunderstrike') || cat === 'adventure' || cat === 'tourer') {
    return imgThunderstrike;
  }
  if (slug.includes('phantom') || cat === 'classic' || cat === 'cruiser') {
    return imgPhantom;
  }
  if (slug.includes('storm') || cat === 'street' || cat === 'electric') {
    return imgStorm;
  }
  if (slug.includes('zenith') || cat === 'scrambler') {
    return imgZenith;
  }
  return imgThunderstrike;
}

// --- Bike helpers ---
export function getBikeBySlug(slug) {
  if (!slug) return null;
  // Check if requesting stale bike
  const stale = getStaleBike();
  if (stale && (stale.slug === slug || stalePageUrl === `/motorcycles/${slug}`)) {
    return stale;
  }
  return allBikes.find(b => b.slug === slug) ?? null;
}

export function getStaleBike() {
  if (!problems.stale_page?.enabled) return null;
  const slug = (problems.stale_page?.bikes ?? [])[0];
  if (!slug) return null;
  const baseBike = allBikes.find(b => b.slug === slug);
  if (!baseBike || !baseBike.previous_values) return null;

  const pv = baseBike.previous_values;
  const variants = (pv.variants || []).map(v => {
    if (Array.isArray(v)) {
      return {
        name: v[0],
        ex_showroom_price_inr: v[1],
        features: ['Standard equipment']
      };
    }
    return v;
  });

  const staleSlug = (pv.stale_url || problems.stale_page?.url || '').replace('/motorcycles/', '') || `${slug}-2025`;

  return {
    ...baseBike,
    id: `${baseBike.id}-2025`,
    slug: staleSlug,
    name: `${baseBike.name} (2025)`,
    model_year: pv.model_year || 2025,
    ex_showroom_price_inr: pv.ex_showroom_price_inr,
    specs: {
      ...baseBike.specs,
      max_power_bhp: pv.max_power_bhp || baseBike.specs.max_power_bhp,
    },
    colours: pv.colours || baseBike.colours,
    variants: variants.length > 0 ? variants : baseBike.variants,
    page_url: pv.stale_url || problems.stale_page?.url || `/motorcycles/${staleSlug}`,
    isStale: true
  };
}

export function isJsOnlyBike(slug) {
  return jsOnlyBikes.includes(slug);
}

export function isTabsNotInHtmlBike(slug) {
  return tabsNotInHtmlBikes.includes(slug);
}

export function isMissingJsonld(slug) {
  return missingJsonldBikes.includes(slug);
}

export function isPriceOnlyInPdf(slug) {
  return priceOnlyInPdfBikes.includes(slug);
}

export function isImageOnlySpecs(slug) {
  return imageOnlySpecsBikes.includes(slug);
}

export function isFinanceNotOnSite(slug) {
  return financeNotOnSiteBikes.includes(slug);
}

// Get display price for a bike on a specific page (handles conflicting_price)
export function getBikeDisplayPrice(slug, page) {
  const bike = getBikeBySlug(slug);
  if (!bike) return 0;
  if (conflictingPriceBikes.includes(slug) && page === conflictingPricePage) {
    return conflictingPriceWrong;
  }
  return bike.ex_showroom_price_inr;
}

// Get related bikes (same or adjacent category)
export function getRelatedBikes(slug, count = 2) {
  const bike = getBikeBySlug(slug);
  if (!bike) return [];
  const categoryOrder = ['Adventure', 'Classic', 'Street', 'Scrambler', 'Tourer', 'Cruiser', 'Electric'];
  const catIdx = categoryOrder.indexOf(bike.category);
  const relatedCats = new Set(
    [bike.category, categoryOrder[catIdx - 1], categoryOrder[catIdx + 1]].filter(Boolean)
  );
  return allBikes
    .filter(b => b.slug !== slug && relatedCats.has(b.category))
    .slice(0, count);
}

// Featured bikes for home page (6 bikes)
export function getFeaturedBikes() {
  return allBikes.slice(0, 6);
}

// Dealers for a bike (dealers in the bike's dealer_cities)
export function getDealersForBike(slug) {
  const bike = getBikeBySlug(slug);
  if (!bike) return [];
  return allDealers.filter(d => (bike.dealer_cities || []).includes(d.city));
}

// Bikes stocked by a dealer
export function getBikesForDealer(dealerId) {
  const dealer = allDealers.find(d => d.id === dealerId);
  if (!dealer) return [];
  return (dealer.stocks || []).map(s => getBikeBySlug(s)).filter(Boolean);
}

// All public routes (for sitemap generation and prerender)
export function getAllPublicRoutes() {
  const routes = [
    '/',
    '/motorcycles',
    '/offers',
    '/dealers',
    '/finance',
    '/faq',
    '/about',
    '/contact',
    '/book-test-ride',
  ];
  for (const bike of allBikes) {
    routes.push(`/motorcycles/${bike.slug}`);
  }
  if (stalePageUrl) {
    routes.push(stalePageUrl);
  }
  return routes;
}

// Categories derived from catalogue
export const categories = ['All', 'Adventure', 'Classic', 'Street', 'Scrambler', 'Tourer', 'Cruiser', 'Electric'];
