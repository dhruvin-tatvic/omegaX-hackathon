import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const scenario = process.env.VITE_SCENARIO === 'dryrun' ? 'dryrun' : 'practice';
console.log(`[prerender] Starting prerender for scenario: ${scenario}`);

const catalogue = JSON.parse(
  fs.readFileSync(path.join(projectRoot, 'src/data/catalogue.json'), 'utf8')
);
const problems = JSON.parse(
  fs.readFileSync(path.join(projectRoot, `src/config/problems_${scenario}.json`), 'utf8')
);

// Determine routes to prerender
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
  '/book-test-ride/thanks',
  '/account',
  '/login',
  '/404',
];

for (const bike of catalogue.bikes) {
  routes.push(`/motorcycles/${bike.slug}`);
}

if (problems.stale_page && problems.stale_page.enabled && problems.stale_page.url) {
  routes.push(problems.stale_page.url);
}

// Helpers for metadata
const SITE_URL = 'https://apex-moto-one.vercel.app';
const jsOnlyBikes = problems.js_only_content?.enabled ? (problems.js_only_content.bikes || []) : [];
const missingJsonldBikes = problems.missing_jsonld?.enabled ? (problems.missing_jsonld.bikes || []) : [];

function formatINR(num) {
  if (num == null) return '';
  return '₹' + Number(num).toLocaleString('en-IN');
}

function getPageMetadata(url) {
  let title = 'Apex Moto — Born to Ride. Built to Last.';
  let description = 'Precision-engineered motorcycles forged for those who demand more from every road.';
  let schema = null;
  const canonical = `${SITE_URL}${url === '/404' ? '/404' : url}`;

  if (url === '/') {
    title = 'Apex Moto — Born to Ride. Built to Last.';
    description = 'Explore 18 iconic motorcycles precision-engineered for adventure, street, touring, cruising, and electric performance.';
    schema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Apex Moto',
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.svg`,
    };
  } else if (url === '/motorcycles') {
    title = 'Motorcycles Lineup — All 18 Models | Apex Moto';
    description = 'Browse the complete Apex Moto motorcycle collection: Adventure, Classic, Street, Scrambler, Tourer, Cruiser, and Electric models.';
  } else if (url.startsWith('/motorcycles/')) {
    const slug = url.replace('/motorcycles/', '');
    const isStale = problems.stale_page?.enabled && problems.stale_page.url === url;
    let bike = catalogue.bikes.find(b => b.slug === slug);

    if (isStale) {
      const staleSlug = (problems.stale_page.bikes || [])[0];
      const base = catalogue.bikes.find(b => b.slug === staleSlug);
      if (base && base.previous_values) {
        bike = {
          ...base,
          name: `${base.name} (2025)`,
          model_year: base.previous_values.model_year || 2025,
          ex_showroom_price_inr: base.previous_values.ex_showroom_price_inr,
          tagline: base.tagline,
          slug,
        };
      }
    }

    if (bike) {
      const isJsOnly = jsOnlyBikes.includes(bike.slug);
      const isMissingLd = missingJsonldBikes.includes(bike.slug);

      title = `${bike.name} — Apex Moto`;
      if (isJsOnly) {
        description = `${bike.name} by Apex Moto. ${bike.tagline}. View specifications, features, and dealer availability.`;
      } else {
        description = `${bike.name} by Apex Moto starting at ${formatINR(bike.ex_showroom_price_inr)} ex-showroom. ${bike.tagline}.`;
      }

      // JSON-LD Product (unless missing_jsonld or js_only_content)
      if (!isMissingLd && !isJsOnly) {
        schema = {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: bike.name,
          brand: {
            '@type': 'Brand',
            name: 'Apex Moto',
          },
          image: `${SITE_URL}/motorcycle_thunderstrike.jpg`,
          description: bike.tagline,
          sku: bike.slug,
          offers: {
            '@type': 'AggregateOffer',
            price: bike.ex_showroom_price_inr,
            priceCurrency: 'INR',
            availability: bike.availability === 'In stock'
              ? 'https://schema.org/InStock'
              : 'https://schema.org/PreOrder',
            url: `${SITE_URL}/motorcycles/${bike.slug}`,
          },
        };
      }
    }
  } else if (url === '/offers') {
    title = 'Exclusive Offers & Financing Deals | Apex Moto';
    description = 'Explore current cashback, bundle offers, and zero down payment finance deals across the Apex Moto lineup.';
  } else if (url === '/dealers') {
    title = 'Find an Authorized Dealer — Nationwide Network | Apex Moto';
    description = 'Visit any of our 8 flagship Apex Moto showrooms and authorized service centres across Delhi, Mumbai, Bangalore, Pune, Chennai, Hyderabad, Jaipur, and Kolkata.';
  } else if (url === '/finance') {
    title = 'Motorcycle Financing & EMI Options | Apex Moto';
    description = 'Calculate your monthly EMI, explore partner bank interest rates from 7.9% p.a., and browse per-bike finance schemes across all Apex Moto models.';
  } else if (url === '/faq') {
    title = 'Frequently Asked Questions (FAQ) — Buyer Guide | Apex Moto';
    description = 'Find answers to common questions about Apex Moto motorcycles, pricing, warranty, financing rates, test rides, delivery timelines, and dealer locations.';
    schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is the price range of Apex Moto motorcycles?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Apex Moto motorcycles start at ₹99,000 ex-showroom for the entry commuter Storm 125 and go up to ₹5,29,000 ex-showroom for the flagship Thunderstrike 650 Rally.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which is the most affordable motorcycle?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'The most affordable motorcycle is the Storm 125 priced at ₹99,000 ex-showroom.',
          },
        },
      ],
    };
  } else if (url === '/about') {
    title = 'About Apex Moto — Engineering Excellence';
    description = 'Learn about Apex Moto\'s journey from Pune in 2014 to over 50,000 riders across India, driven by precision engineering and rider passion.';
  } else if (url === '/contact') {
    title = 'Contact Customer Support & Enquiries — Apex Moto';
    description = 'Get in touch with Apex Moto for test ride assistance, dealer inquiries, financing support, or after-sales service.';
  } else if (url === '/book-test-ride') {
    title = 'Book a Test Ride — Experience Apex Moto';
    description = 'Schedule a complimentary test ride for any of our 18 motorcycles at an authorized Apex Moto dealership near you.';
  } else if (url === '/book-test-ride/thanks') {
    title = 'Test Ride Booking Confirmed | Apex Moto';
    description = 'Your test ride request has been confirmed. Our team will contact you shortly.';
  } else if (url === '/account') {
    title = 'My Account — Apex Moto Rider Portal';
    description = 'Manage your Apex Moto rider profile, saved motorcycles, bookings, and service schedule.';
  } else if (url === '/login') {
    title = 'Rider Login — Apex Moto';
    description = 'Sign in to your Apex Moto account to manage test rides, motorcycle orders, and service history.';
  } else if (url === '/404') {
    title = '404 — Road Ended Here | Apex Moto';
    description = 'The page you are looking for has been moved or does not exist.';
  }

  return { title, description, canonical, schema };
}

async function prerender() {
  const distDir = path.join(projectRoot, 'dist');
  const templatePath = path.join(distDir, 'index.html');

  if (!fs.existsSync(templatePath)) {
    console.error('[prerender] Error: dist/index.html not found! Run vite build first.');
    process.exit(1);
  }

  const rawTemplate = fs.readFileSync(templatePath, 'utf8');

  // Build map of dev asset URLs to compiled production asset filenames
  const assetsDir = path.join(distDir, 'assets');
  const assetMap = {};
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    for (const file of assetFiles) {
      // Match pattern like name-hash.ext or name.ext
      const lastDot = file.lastIndexOf('.');
      if (lastDot > 0) {
        const ext = file.slice(lastDot);
        const namePart = file.slice(0, lastDot);
        // Find base name by removing hash suffix (e.g. -8FE7-Duu)
        const baseNameMatch = namePart.match(/^(.*?)(?:-[a-zA-Z0-9_-]{8,})?$/);
        const baseName = (baseNameMatch ? baseNameMatch[1] : namePart) + ext;
        assetMap[`/src/assets/images/${baseName}`] = `/assets/${file}`;
        assetMap[`/src/assets/${baseName}`] = `/assets/${file}`;
      }
    }
  }

  console.log('[prerender] Asset mappings discovered:', Object.keys(assetMap).length);

  // Launch Vite SSR server in middleware mode
  const vite = await createServer({
    root: projectRoot,
    server: { middlewareMode: true },
    appType: 'custom',
  });

  const { render } = await vite.ssrLoadModule('/src/entry-server.jsx');

  console.log(`[prerender] Rendering ${routes.length} routes...`);

  for (const route of routes) {
    try {
      const { html } = render(route);
      const meta = getPageMetadata(route);

      // Inject into template
      let pageHtml = rawTemplate;

      // Replace root
      pageHtml = pageHtml.replace(
        '<div id="root"></div>',
        `<div id="root">${html}</div>`
      );

      // Inject Title
      pageHtml = pageHtml.replace(
        /<title>.*?<\/title>/i,
        `<title>${meta.title}</title>`
      );

      // Inject Meta Tags into <head>
      let headTags = `\n    <meta name="description" content="${meta.description}" />\n`;
      headTags += `    <link rel="canonical" href="${meta.canonical}" />\n`;
      headTags += `    <meta property="og:title" content="${meta.title}" />\n`;
      headTags += `    <meta property="og:description" content="${meta.description}" />\n`;
      headTags += `    <meta property="og:url" content="${meta.canonical}" />\n`;
      headTags += `    <meta property="og:type" content="website" />\n`;

      if (meta.schema) {
        headTags += `    <script type="application/ld+json">${JSON.stringify(meta.schema)}</script>\n`;
      }

      pageHtml = pageHtml.replace('</head>', `${headTags}  </head>`);

      // Replace dev asset URLs with production hashed URLs
      for (const [srcPath, hashedPath] of Object.entries(assetMap)) {
        pageHtml = pageHtml.replaceAll(srcPath, hashedPath);
      }

      // Determine output file path
      let outFilePath;
      if (route === '/') {
        outFilePath = path.join(distDir, 'index.html');
      } else if (route === '/404') {
        outFilePath = path.join(distDir, '404.html');
      } else {
        const routePath = route.startsWith('/') ? route.slice(1) : route;
        const targetDir = path.join(distDir, routePath);
        fs.mkdirSync(targetDir, { recursive: true });
        outFilePath = path.join(targetDir, 'index.html');

        // Also write clean-url HTML file (e.g. dist/motorcycles.html)
        const cleanFile = path.join(distDir, `${routePath}.html`);
        fs.mkdirSync(path.dirname(cleanFile), { recursive: true });
        fs.writeFileSync(cleanFile, pageHtml, 'utf8');
      }

      fs.writeFileSync(outFilePath, pageHtml, 'utf8');
      console.log(`  ✓ Prerendered: ${route} -> ${path.relative(distDir, outFilePath)}`);
    } catch (err) {
      console.error(`  ✗ Failed rendering ${route}:`, err);
    }
  }

  await vite.close();

  // Copy public assets into dist (brochures, specs, robots.txt, sitemap.xml, health)
  const publicDir = path.join(projectRoot, 'public');
  function copyRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    const stats = fs.statSync(src);
    if (stats.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const item of fs.readdirSync(src)) {
        copyRecursive(path.join(src, item), path.join(dest, item));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  copyRecursive(publicDir, distDir);

  // Also copy src/assets into dist/src/assets as an extra fallback
  const srcAssetsDir = path.join(projectRoot, 'src/assets');
  if (fs.existsSync(srcAssetsDir)) {
    copyRecursive(srcAssetsDir, path.join(distDir, 'src/assets'));
  }

  console.log('[prerender] Copied public and source assets to dist.');
  console.log('[prerender] Prerendering finished successfully!');
}

prerender().catch(err => {
  console.error('[prerender] Fatal error:', err);
  process.exit(1);
});
