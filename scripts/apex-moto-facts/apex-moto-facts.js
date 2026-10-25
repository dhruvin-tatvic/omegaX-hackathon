/**
 * Apex Moto website facts: weekly scrape with Firecrawl, saved as JSON in Google Drive.
 *
 * Runs as a standalone Google Apps Script (script.google.com > New project).
 * Setup (once):
 *   1. Project Settings > Script properties > add FIRECRAWL_API_KEY = fc-...
 *   2. Run setupWeeklyTrigger() and approve the permissions prompt.
 *   3. Optional: run refreshFacts() once to test.
 *
 * Local Node: scripts/apex-moto-facts/run.mjs (FIRECRAWL_API_KEY in env or .env)
 *
 * Each run writes three things to the Drive folder CONFIG.FOLDER_NAME:
 *   apex_moto_facts.json            latest facts, overwritten in place (stable file ID and link)
 *   snapshots/apex_moto_facts_YYYY-MM-DD.json   a dated copy of that week's facts
 *   apex_moto_changes.json          running log: one entry per run with every value that changed
 * If any page fails to scrape, nothing is written and Apps Script emails you the error.
 */

const CONFIG = {
  BASE_URL: 'https://omegax-hackathon.onrender.com',
  FIRECRAWL_ENDPOINT: 'https://api.firecrawl.dev/v2/scrape',
  BATCH_SIZE: 5,            // parallel requests per batch (lower it on a free Firecrawl plan)
  MAX_RETRIES: 3,
  TIMEZONE: 'Asia/Kolkata',
  TRIGGER_WEEKDAY: 'MONDAY', // day of the weekly run
  TRIGGER_HOUR: 7,           // hour of the weekly run, in TIMEZONE
  FOLDER_NAME: 'Apex Moto Facts',
  LATEST_FILE: 'apex_moto_facts.json',
  CHANGES_FILE: 'apex_moto_changes.json',
  KEEP_SNAPSHOTS: true,      // false = only keep the latest file
  EMAIL_ON_CHANGES: false,   // true = email the script owner when anything changed
  CITIES: ['Delhi', 'Mumbai', 'Bangalore', 'Pune', 'Chennai', 'Hyderabad', 'Jaipur', 'Kolkata'],
  PAGES: ['/', '/motorcycles', '/offers', '/finance', '/dealers', '/faq', '/about', '/contact'],
};

/* ============================== Entry points ============================== */

function setupWeeklyTrigger() {
  removeWeeklyTrigger();
  ScriptApp.newTrigger('refreshFacts').timeBased()
    .onWeekDay(ScriptApp.WeekDay[CONFIG.TRIGGER_WEEKDAY])
    .atHour(CONFIG.TRIGGER_HOUR)
    .inTimezone(CONFIG.TIMEZONE)
    .create();
}

function removeWeeklyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'refreshFacts')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

function refreshFacts() {
  const started = new Date();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Another refresh is already running.');
  try {
    scrapeMany_([CONFIG.BASE_URL + '/']); // wake the Render instance before the parallel batch

    const res = scrapeMany_(CONFIG.PAGES.map(p => CONFIG.BASE_URL + p));
    if (res.failed.length) throw failure_(res.failed);

    const lineup = parseLineup_(res.pages[CONFIG.BASE_URL + '/motorcycles']);
    if (!lineup.models.length) throw new Error('Not updated: no models parsed from /motorcycles.');

    const modelUrls = lineup.models.map(m => CONFIG.BASE_URL + '/motorcycles/' + m.slug);
    const modelRes = scrapeMany_(modelUrls);
    if (modelRes.failed.length) throw failure_(modelRes.failed);

    const scrapedAt = Utilities.formatDate(started, CONFIG.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
    const facts = buildFacts_(res.pages, modelRes.pages, lineup, url => {
      const r = scrapeMany_([url]);
      return r.pages[url] || null;
    }, scrapedAt);

    const result = saveFacts_(facts, started);
    if (CONFIG.EMAIL_ON_CHANGES && result.changes.length) {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
        'Apex Moto facts: ' + result.changes.length + ' change(s)',
        result.changes.map(c => c.path + ': ' + JSON.stringify(c.old) + ' -> ' + JSON.stringify(c.new)).join('\n') +
        '\n\n' + result.latestUrl);
    }
    console.log('Saved ' + result.latestUrl + ' with ' + result.changes.length + ' change(s).');
  } finally {
    lock.releaseLock();
  }
}

function failure_(failed) {
  return new Error('Not updated. Failed: ' + failed.map(f => f.url + (f.code ? ' (' + f.code + ')' : '')).join(', '));
}

/* ============================== Firecrawl ============================== */

function scrapeMany_(urls) {
  const key = PropertiesService.getScriptProperties().getProperty('FIRECRAWL_API_KEY');
  if (!key) throw new Error('Add FIRECRAWL_API_KEY under Project Settings > Script properties.');
  const pages = {};
  let pending = urls.slice();
  let failed = [];
  for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES && pending.length; attempt++) {
    failed = [];
    for (let i = 0; i < pending.length; i += CONFIG.BATCH_SIZE) {
      const batch = pending.slice(i, i + CONFIG.BATCH_SIZE);
      const responses = UrlFetchApp.fetchAll(batch.map(u => ({
        url: CONFIG.FIRECRAWL_ENDPOINT,
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + key },
        muteHttpExceptions: true,
        payload: JSON.stringify({
          url: u, formats: ['markdown'], onlyMainContent: true,
          maxAge: 0, waitFor: u.endsWith('.pdf') ? 0 : 3000, timeout: 55000,
        }),
      })));
      responses.forEach((r, j) => {
        let body = null;
        try { body = JSON.parse(r.getContentText()); } catch (e) { /* not JSON */ }
        if (r.getResponseCode() === 200 && body && body.success && body.data && body.data.markdown) {
          pages[batch[j]] = body.data.markdown;
        } else {
          failed.push({ url: batch[j], code: r.getResponseCode(), msg: body && (body.error || body.message) });
        }
      });
    }
    pending = failed.map(f => f.url);
    if (pending.length && attempt < CONFIG.MAX_RETRIES) Utilities.sleep(10000 * attempt);
  }
  return { pages: pages, failed: failed };
}


/* ============================== Facts object (pure) ============================== */

/**
 * Page markdown in, one JSON-ready facts object out. `fetchBrochure(url)` returns a
 * brochure's markdown; it is called only for models whose page lacks specs,
 * variants or on-road prices.
 */
function buildFacts_(pages, modelPages, lineup, fetchBrochure, scrapedAt) {
  const B = CONFIG.BASE_URL;
  const brochuresUsed = [];
  const warnings = [];

  const models = lineup.models.map(card => {
    const md = modelPages[B + '/motorcycles/' + card.slug] || '';
    const p = parseModelPage_(md, card.slug);
    let specs = p.specs, onroad = p.onroad, variants = p.variants;
    const src = { specs: 'model_page', on_road: 'model_page', variants: 'model_page' };
    if ((!specs.length || !Object.keys(onroad).length || !variants.length) && p.brochure) {
      const bmd = fetchBrochure(p.brochure);
      if (bmd) {
        brochuresUsed.push(card.slug);
        const b = parseBrochure_(bmd);
        if (!specs.length && b.specs.length) { specs = b.specs; src.specs = 'brochure_pdf'; }
        if (!Object.keys(onroad).length && Object.keys(b.onroad).length) { onroad = b.onroad; src.on_road = 'brochure_pdf'; }
        if (!variants.length && b.variants.length) { variants = b.variants; src.variants = 'brochure_pdf'; }
      } else {
        warnings.push('brochure failed: ' + card.slug);
      }
    }
    if (!specs.length) warnings.push('no specs: ' + card.slug);
    const specObj = {};
    specs.forEach(s => { specObj[s[0].replace(/\s+/g, '_')] = numOrText_(s[1]); });
    return {
      slug: card.slug,
      name: p.name || card.name,
      category: card.category,
      badge: card.badge,
      tagline: p.tagline || card.tagline,
      engine: p.engine,
      power: p.power,
      torque: p.torque,
      mileage_or_range: p.mileage,
      ex_showroom_inr: p.price != null ? p.price : card.cardPrice,
      availability: p.stock,
      colours: p.colours,
      dealer_cities: p.dealers,
      key_features: p.features,
      variants: variants.map(v => ({ name: v.name, price_inr: v.price, features: v.features })),
      specs: specObj,
      on_road_inr: onroad,
      sources: src,
      page_url: B + '/motorcycles/' + card.slug,
      brochure_url: p.brochure || null,
    };
  });

  const finance = parseFinance_(pages[B + '/finance'] || '');
  const offers = parseOffers_(pages[B + '/offers'] || '');
  const dealers = parseDealers_(pages[B + '/dealers'] || '');
  const faq = parseFaq_(pages[B + '/faq'] || '');
  const about = parseAbout_(pages[B + '/about'] || '');
  const home = parseStats_(pages[B + '/'] || '');
  const contact = parseContact_(pages[B + '/contact'] || '');
  const names = models.map(m => m.name);
  const prices = models.map(m => m.ex_showroom_inr).filter(x => x != null);
  const toObj = pairs => { const o = {}; pairs.forEach(p => { o[p[1]] = p[0]; }); return o; };
  const categories = {};
  lineup.categories.forEach(c => { categories[c[0]] = c[1]; });

  return {
    meta: {
      source: B + '/',
      scraped_at: scrapedAt,
      scraper: 'Firecrawl',
      pages_scraped: CONFIG.PAGES.length + models.length + brochuresUsed.length,
      brochures_used: brochuresUsed,
      currency: 'INR',
      notes: 'Prices are ex-showroom unless the field name says on_road. All prices are indicative per the site.',
      warnings: warnings,
    },
    summary: {
      models_listed: models.length,
      categories: categories,
      lowest_ex_showroom_inr: prices.length ? Math.min.apply(null, prices) : null,
      highest_ex_showroom_inr: prices.length ? Math.max.apply(null, prices) : null,
      dealerships_listed: dealers.length,
      active_offers: offers.length,
      partner_banks: finance.banks.length,
      home_stats: toObj(home),
      about_stats: toObj(about.stats),
    },
    models: models,
    finance: {
      partner_banks: finance.banks.map(b => ({ bank: b[0], interest_rate_pa: b[1], max_tenure_months: b[2], down_payment: b[3] })),
      emi_estimates: finance.emis.map(e => ({
        model: e.model, category: e.category, ex_showroom_inr: e.price, down_payment_inr: e.down,
        interest_rate_pa: e.rate, tenure_months: e.tenure, emi_inr: e.emi,
        emi_recomputed_inr: emi_(e.price - e.down, e.rate, e.tenure),
      })),
    },
    offers: offers.map(o => ({ title: o.title, type: o.type, headline: o.headline, applies_to: o.applies,
      benefits: o.benefits, valid_till: o.valid })),
    dealers: dealers.map(d => ({
      name: d.name, city_state: d.city, flagship: d.tag === 'Flagship', address: d.address, phone: d.phone,
      email: d.email, hours: d.hours, services: d.services, models_in_stock: d.stock,
      models_not_stocked: names.filter(n => d.stock.indexOf(n) < 0),
    })),
    faq: faq.map(f => ({ id: f[0], question: f[1], answer: f[2] })),
    milestones: about.milestones.map(m => ({ year: Number(m[0]), title: m[1], detail: m[2] })),
    contact: contact.map(c => ({ channel: c[0], detail: c[1], availability: c[2] })),
  };
}

/** Reducing-balance EMI, the formula the site's Finance page shows. */
function emi_(principal, annualRate, months) {
  if (!principal || !months) return null;
  const r = annualRate / 12;
  if (!r) return Math.round(principal / months);
  const f = Math.pow(1 + r, months);
  return Math.round(principal * r * f / (f - 1));
}

/* ============================== Change detection (pure) ============================== */

// Arrays of objects are matched by the first of these keys an element has, so a
// reordered list is not reported as a change.
const ID_KEYS = ['slug', 'id', 'bank', 'model', 'title', 'year', 'channel', 'name'];

function flatten_(v, path, out) {
  if (Array.isArray(v)) {
    if (v.every(x => x === null || typeof x !== 'object')) { out[path] = v; return out; }
    v.forEach((x, i) => {
      const k = x && typeof x === 'object' ? ID_KEYS.find(key => key in x) : null;
      flatten_(x, path + '[' + (k ? x[k] : i) + ']', out);
    });
  } else if (v && typeof v === 'object') {
    Object.keys(v).forEach(k => flatten_(v[k], path ? path + '.' + k : k, out));
  } else {
    out[path] = v;
  }
  return out;
}

/** Returns [{path, old, new}] for every value added, removed or changed (meta is ignored). */
function diffFacts_(prev, next) {
  const a = {}, b = {};
  Object.keys(prev || {}).filter(k => k !== 'meta').forEach(k => flatten_(prev[k], k, a));
  Object.keys(next || {}).filter(k => k !== 'meta').forEach(k => flatten_(next[k], k, b));
  const out = [];
  Object.keys(b).forEach(p => {
    if (!(p in a)) out.push({ path: p, old: null, new: b[p] });
    else if (JSON.stringify(a[p]) !== JSON.stringify(b[p])) out.push({ path: p, old: a[p], new: b[p] });
  });
  Object.keys(a).forEach(p => { if (!(p in b)) out.push({ path: p, old: a[p], new: null }); });
  return out;
}

/* ============================== Google Drive storage ============================== */

function saveFacts_(facts, runAt) {
  const folder = folder_(CONFIG.FOLDER_NAME, DriveApp.getRootFolder());
  const latest = file_(folder, CONFIG.LATEST_FILE);
  let previous = null;
  if (latest) {
    try { previous = JSON.parse(latest.getBlob().getDataAsString()); } catch (e) { previous = null; }
  }
  const changes = previous ? diffFacts_(previous, facts) : [];
  facts.meta.changes_since_previous = previous ? changes.length : null;
  const body = JSON.stringify(facts, null, 2);

  const out = latest || folder.createFile(CONFIG.LATEST_FILE, body, 'application/json');
  if (latest) latest.setContent(body);

  if (CONFIG.KEEP_SNAPSHOTS) {
    const snaps = folder_('snapshots', folder);
    const name = 'apex_moto_facts_' + Utilities.formatDate(runAt, CONFIG.TIMEZONE, 'yyyy-MM-dd') + '.json';
    const existing = file_(snaps, name);
    if (existing) existing.setContent(body); else snaps.createFile(name, body, 'application/json');
  }

  const log = file_(folder, CONFIG.CHANGES_FILE);
  let entries = [];
  if (log) { try { entries = JSON.parse(log.getBlob().getDataAsString()); } catch (e) { entries = []; } }
  entries.push({ run_at: facts.meta.scraped_at, baseline: !previous, change_count: changes.length, changes: changes });
  const logBody = JSON.stringify(entries, null, 2);
  if (log) log.setContent(logBody); else folder.createFile(CONFIG.CHANGES_FILE, logBody, 'application/json');

  return { changes: changes, latestUrl: out.getUrl() };
}

function folder_(name, parent) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function file_(folder, name) {
  const it = folder.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

/* ============================== Parsers (pure) ============================== */

function clean_(s) {
  return String(s == null ? '' : s).replace(/\\([*#|_\[\]])/g, '$1').replace(/\*\*/g, '')
    .replace(/\s+/g, ' ').trim();
}

function money_(s) {
  const m = String(s == null ? '' : s).match(/(?:₹|INR)?\s*(\d[\d,]*(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

function pct_(s) {
  return Math.round(parseFloat(s) * 1e6) / 1e8; // '9.99%' -> 0.0999
}

function numOrText_(s) {
  return /^\d+(\.\d+)?$/.test(String(s).trim()) ? Number(s) : s;
}

function prettyKey_(k) {
  const units = { cc: '(cc)', bhp: '(bhp)', rpm: '(rpm)', nm: '(Nm)', mm: '(mm)', l: '(L)', kg: '(kg)',
    kmpl: '(km/l)', kwh: '(kWh)', km: '(km)', kmph: '(km/h)' };
  const parts = k.split(' ');
  const last = parts[parts.length - 1];
  if (units[last]) { parts.pop(); parts.push(units[last]); }
  const s = parts.join(' ').replace('charging time 0 80', 'charging time 0-80%');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function section_(md, startRe, endRe) {
  const m = md.match(startRe);
  if (!m) return '';
  const after = md.slice(m.index + m[0].length);
  const j = endRe ? after.search(endRe) : -1;
  return j < 0 ? after : after.slice(0, j);
}

function tableRows_(text) {
  return text.split('\n').map(l => l.trim()).filter(l => l.charAt(0) === '|')
    .map(l => l.replace(/^\||\|$/g, '').split('|').map(clean_))
    .filter(r => !r.every(c => /^:?-*:?$/.test(c)));
}

function parseLineup_(md) {
  md = md || '';
  const models = [];
  const re = /(?:^|\n)([^\n\[]*?)\s*\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\/motorcycles\/([a-z0-9-]+)\)\s*\n+([^\n]+)\n+### \[([^\]]+)\]\([^)]*\)\s*\n+([^\n]+)\n+([^\n]*?)Engine\s*\n+([^\n]*?)Power\s*\n+([^\n]*?)Starting/g;
  let m;
  while ((m = re.exec(md))) {
    models.push({ badge: clean_(m[1]), slug: m[2], category: clean_(m[3]), name: clean_(m[4]),
      tagline: clean_(m[5]), cardEngine: clean_(m[6]), cardPower: clean_(m[7]), cardPrice: money_(m[8]) });
  }
  const filter = (md.match(/Filter by:\s*\n+([^\n]+)/) || [])[1] || '';
  const categories = [];
  const cre = /([A-Za-z][A-Za-z-]*?)(\d+)/g;
  let c;
  while ((c = cre.exec(filter))) if (c[1] !== 'All') categories.push([c[1], Number(c[2])]);
  return { models: models, categories: categories };
}

function parseModelPage_(md, slug) {
  md = md || '';
  const out = { slug: slug, specs: [], onroad: {}, variants: [], colours: [], dealers: [], features: [], emi: null };
  const t = md.match(/^#\s+(.+)$/m);
  if (t) out.name = clean_(t[1]);
  const head = md.match(/\n#\s+[^\n]+\n+([^\n]+)\n+₹([\d,]+)\s*onwards/);
  if (head) { out.tagline = clean_(head[1]); out.price = money_(head[2]); }
  const stat = label => {
    const x = md.match(new RegExp('\\n([^\\n|]+?)' + label + '\\s*\\n'));
    return x ? clean_(x[1]) : '';
  };
  out.engine = stat('Engine / Powertrain');
  out.power = stat('Max Power');
  out.torque = stat('Torque');
  out.mileage = stat('Mileage') || stat('Range');

  out.colours = section_(md, /### Available Colours\s*\n/, /\n#/).split('\n')
    .filter(l => /^\s*-\s+/.test(l)).map(l => clean_(l.replace(/^\s*-\s+/, '')));
  const stock = md.match(/### Stock & Availability\s*\n+([^\n]+)/);
  out.stock = stock ? clean_(stock[1]) : '';
  const bro = md.match(/\((https?:[^)\s]+\/brochures\/[^)\s]+\.pdf)\)/);
  out.brochure = bro ? bro[1] : '';

  tableRows_(section_(md, /### On-Road Price by City[^\n]*\n/, /\n###? /))
    .filter(r => r[0] !== 'City' && r.length >= 2)
    .forEach(r => { out.onroad[r[0]] = money_(r[1]); });

  const dsec = section_(md, /### Available at these Authorized Dealerships\s*\n/, /\n## /);
  const dre = /([A-Z][a-z]+) • \+/g;
  let d;
  while ((d = dre.exec(dsec))) out.dealers.push(d[1]);

  out.features = section_(md, /## Key Features\s*\n/, /\n## /).split('\n')
    .filter(l => /^### /.test(l)).map(l => clean_(l.slice(4)));

  out.specs = tableRows_(section_(md, /## Technical Specifications\s*\n/, /\n## /))
    .filter(r => r.length >= 2 && r[0]).map(r => [r[0].toLowerCase(), r[1]]);

  let cur = null;
  section_(md, /## Available Variants\s*\n/, /\n###? |\nExplore More/).split('\n').forEach(l => {
    const v = l.match(/^-\s+(.+?)\s*₹([\d,]+)\s*$/);
    const f = l.match(/^\s+-\s+•\s*(.+)$/);
    if (v) { cur = { name: clean_(v[1]), price: money_(v[2]), features: [] }; out.variants.push(cur); }
    else if (f && cur) cur.features.push(clean_(f[1]));
  });

  const emi = tableRows_(section_(md, /### Estimated Finance[^\n]*\n/, /\[View Full|\n## /))
    .filter(r => r[0] !== 'Down Payment');
  if (emi.length) out.emi = { down: money_(emi[0][0]), rate: pct_(emi[0][1]),
    tenure: parseInt(emi[0][2], 10), emi: money_(emi[0][3]) };
  return out;
}

function parseBrochure_(md) {
  md = md || '';
  const out = { specs: [], onroad: {}, variants: [] };
  md.split('\n').filter(l => /^\*\s/.test(l)).forEach(raw => {
    // Each bullet can carry the next block's caps heading on its tail; cut it off.
    const l = raw.replace(/^\*\s+/, '').replace(/\s+[A-Z][A-Z\- ]{2,}:.*$/, '').trim();
    let m;
    if ((m = l.match(/^(.+?):\s*INR\s*([\d,]+)\s*Features:\s*(.+)$/))) {
      out.variants.push({ name: clean_(m[1]), price: money_(m[2]),
        features: m[3].split(',').map(clean_).filter(Boolean) });
    } else if ((m = l.match(/^([A-Z][a-zA-Z ]+):\s*INR\s*([\d,]+)$/))) {
      out.onroad[clean_(m[1])] = money_(m[2]);
    } else if ((m = l.match(/^([a-z0-9 ]+):\s*(.+)$/))) {
      out.specs.push([m[1].trim(), clean_(m[2])]);
    }
  });
  return out;
}

function parseFinance_(md) {
  md = md || '';
  const banks = tableRows_(section_(md, /## Official Banking Partners[^\n]*\n/, /\n## |Model Estimates/))
    .filter(r => r[0] !== 'Banking Partner' && r.length >= 4)
    .map(r => [r[0], pct_(r[1]), parseInt(r[2], 10), r[3].replace('-', '–')]);
  const emis = [];
  section_(md, /## Per-Model EMI Estimates[^\n]*\n/, null).split(/\n### \[/).slice(1).forEach(chunk => {
    const name = clean_(chunk.slice(0, chunk.indexOf(']')));
    const cat = (chunk.match(/\)\s*\n+([^\n]+)\n/) || [])[1];
    const price = (chunk.match(/Ex-showroom:\s*₹([\d,]+)/) || [])[1];
    const row = tableRows_(chunk).filter(r => r[0] !== 'Down Payment')[0];
    if (row) emis.push({ model: name, category: clean_(cat), price: money_(price), down: money_(row[0]),
      rate: pct_(row[1]), tenure: parseInt(row[2], 10), emi: money_(row[3]) });
  });
  return { banks: banks, emis: emis };
}

function parseOffers_(md) {
  md = md || '';
  const sec = section_(md, /## Active Offers\s*\n/, /\n## /);
  const chunks = sec.split(/\n### /);
  const offers = [];
  for (let i = 1; i < chunks.length; i++) {
    const prevLines = chunks[i - 1].split('\n').map(s => s.trim()).filter(Boolean);
    const lines = chunks[i].split('\n').map(s => s.trim()).filter(Boolean);
    const vIdx = lines.findIndex(l => /^Valid till:/.test(l));
    const body = lines.slice(1).filter(l => !/^✓|^Valid till:|^\[/.test(l));
    offers.push({
      type: clean_(prevLines[prevLines.length - 1]),
      title: clean_(lines[0]),
      headline: clean_(body[0] || ''),
      benefits: lines.filter(l => /^✓/.test(l)).map(l => clean_(l.slice(1))),
      valid: vIdx >= 0 ? clean_(lines[vIdx].replace(/^Valid till:/, '')) : '',
      applies: vIdx >= 0 && lines[vIdx + 1] && !/^\[/.test(lines[vIdx + 1])
        ? clean_(lines[vIdx + 1].replace(/\s*•\s*Starting\s*/g, ' from ').replace(/(\d)([A-Z])/g, '$1; $2')) : '',
    });
  }
  return offers;
}

function parseDealers_(md) {
  md = md || '';
  return md.split(/\n### /).slice(1).map(chunk => {
    const lines = chunk.split('\n').map(s => s.trim()).filter(Boolean);
    const get = re => { const x = chunk.match(re); return x ? clean_(x[1]) : ''; };
    const stockSec = section_(chunk, /Bikes in Stock:\s*\n/, /\n\s*\n(?!\s*-)/);
    const svcLine = lines.find(l => /^(Sales|Service)/.test(l) && !/^-/.test(l)) || '';
    return {
      name: clean_(lines[0]), city: clean_(lines[1]),
      tag: lines[2] === 'Flagship' ? 'Flagship' : '',
      address: get(/📍\s*([^\n]+)/), phone: get(/📞\s*\[([^\]]+)\]/), email: get(/📧\s*\[([^\]]+)\]/),
      hours: get(/🕐\s*([^\n]+)/),
      stock: (stockSec.match(/^\s*-\s*\[([^\]]+)\]/gm) || []).map(s => clean_(s.replace(/^\s*-\s*\[|\]$/g, ''))),
      services: svcLine.match(/Test Ride|Accessories|Insurance|Finance|Service|Sales/g) || [],
    };
  });
}

function parseFaq_(md) {
  md = md || '';
  const rows = [];
  md.split(/\n## \\?#/).slice(1).forEach(chunk => {
    const m = chunk.match(/^(\d+)([^\n]+)\n+([\s\S]*?)(?:\n\nStill have questions|$)/);
    if (m) rows.push([Number(m[1]), clean_(m[2]), clean_(m[3])]);
  });
  return rows;
}

function parseAbout_(md) {
  md = md || '';
  const milestones = [];
  const re = /\n(\d{4})\s*\n+#### ([^\n]+)\n+([^\n]+)/g;
  let m;
  while ((m = re.exec(md))) milestones.push([m[1], clean_(m[2]), clean_(m[3])]);
  milestones.reverse(); // newest first
  return { milestones: milestones, stats: parseStats_(md) };
}

function parseStats_(md) {
  const out = [];
  const re = /^(\d[\d,]*K?\+?(?: Yrs)?)([A-Z][A-Za-z ]+)$/gm;
  let m;
  while ((m = re.exec(md || ''))) out.push([m[1], m[2].trim()]);
  return out;
}

function parseContact_(md) {
  const out = [];
  const re = /\n(?:📞|📧|📍|💬)\s*\n+([^\n]+)\n+([^\n]+)\n+([^\n]+)/g;
  let m;
  while ((m = re.exec(md || ''))) out.push([clean_(m[1]), clean_(m[2]), clean_(m[3])]);
  return out;
}

/* Node test hook (ignored by Apps Script). */
if (typeof module !== 'undefined') {
  module.exports = { parseLineup_, parseModelPage_, parseBrochure_, parseFinance_, parseOffers_, parseDealers_,
    parseFaq_, parseAbout_, parseStats_, parseContact_, buildFacts_, diffFacts_, emi_, CONFIG };
}
