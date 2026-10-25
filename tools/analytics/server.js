import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { renderPage } from './layout.js';
import { compareReadability, listCatalog, loadAiFixture } from './lib/readability.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const PORT = Number(process.env.ANALYTICS_PORT) || 3460;
const TRAFFIC_ORIGIN = process.env.TRAFFIC_ORIGIN || 'http://127.0.0.1:3456';
const COMPARE_ORIGIN = process.env.COMPARE_ORIGIN || 'http://127.0.0.1:3457';

const app = express();

function proxyTo(origin) {
  return (req, res) => {
    const incoming = new URL(req.originalUrl, 'http://127.0.0.1');
    const prefix = req.baseUrl || '';
    const rest = incoming.pathname.slice(prefix.length) || '/';
    const dest = new URL(rest + incoming.search, origin);
    const headers = { ...req.headers, host: dest.host };
    delete headers.connection;

    const upstream = http.request(
      dest,
      { method: req.method, headers },
      (up) => {
        const outHeaders = { ...up.headers };
        res.writeHead(up.statusCode || 502, outHeaders);
        up.pipe(res);
      },
    );
    upstream.on('error', (err) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      res.status(502).json({
        error: 'Upstream service unavailable',
        origin,
        detail: err.message,
      });
    });
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      req.pipe(upstream);
    } else {
      upstream.end();
    }
  };
}

app.use('/traffic-api', proxyTo(TRAFFIC_ORIGIN));
app.use('/compare-api', proxyTo(COMPARE_ORIGIN));
app.use('/legacy/traffic', express.static(path.join(repoRoot, 'tools/traffic-dashboard/public')));
app.use('/legacy/compare', express.static(path.join(repoRoot, 'tools/comparison-dashboard/public')));
app.use('/tatvic', express.static(path.join(repoRoot, 'tools/comparison-dashboard/public/tatvic')));
app.use('/human-assets', express.static(path.join(repoRoot, 'agents/readability/review_dashboard')));
app.use('/artifacts', express.static(repoRoot));
app.use(express.static(path.join(__dirname, 'public')));

const trafficConfig = `<script>
window.TATVIC_TRAFFIC_API = '/traffic-api';
window.TATVIC_SHARED_THEME = true;
window.BTA_APP = true;
</script>`;

const compareConfig = `<script>
window.TATVIC_COMPARE_API = '/compare-api';
window.TATVIC_SHARED_THEME = true;
window.BTA_APP = true;
</script>`;

const humanConfig = `<script>
window.TATVIC_ARTIFACT_PREFIX = '/artifacts/';
window.TATVIC_HUMAN_MANIFEST = '/human-assets/manifest.json';
window.TATVIC_SHARED_THEME = true;
window.BTA_APP = true;
</script>`;

app.get('/recommendations.html', (_req, res) => res.redirect('/comparison/recommendations'));
app.get('/runs.html', (_req, res) => res.redirect('/comparison/runs'));

app.get('/', (_req, res) => {
  res.redirect('/traffic');
});

app.get('/readability', (_req, res) => {
  res.type('html').send(
    renderPage({
      title: 'AI vs Human Readability',
      activeId: 'readability',
      bodyFile: 'readability.html',
      bodyClass: 'page-readability',
      styles: ['/readability.css'],
      scripts: ['<script src="/readability.js" type="module"></script>'],
    }),
  );
});

app.get('/traffic', (_req, res) => {
  res.type('html').send(
    renderPage({
      title: 'Traffic Intelligence',
      activeId: 'traffic',
      bodyFile: 'traffic.html',
      bodyClass: 'page-traffic',
      styles: ['/legacy/traffic/styles.css'],
      configScript: trafficConfig,
      scripts: ['<script src="/legacy/traffic/app.js" type="module"></script>'],
    }),
  );
});

app.get('/human-view', (_req, res) => {
  res.type('html').send(
    renderPage({
      title: 'Human View',
      activeId: 'human-view',
      bodyFile: 'human-view.html',
      bodyClass: 'page-human',
      styles: ['/human-assets/styles.css'],
      configScript: humanConfig,
      scripts: ['<script src="/human-assets/app.js"></script>'],
    }),
  );
});

app.get('/comparison', (_req, res) => {
  res.type('html').send(
    renderPage({
      title: 'Comparison Overview',
      activeId: 'comparison',
      bodyFile: 'comparison.html',
      bodyClass: 'page-compare',
      styles: [
        '/legacy/compare/tatvic/tokens.css',
        '/legacy/compare/styles.css',
        '/legacy/compare/comparison-ui.css',
      ],
      configScript: compareConfig,
      scripts: ['<script src="/legacy/compare/app.js" type="module"></script>'],
    }),
  );
});

app.get('/comparison/recommendations', (_req, res) => {
  res.type('html').send(
    renderPage({
      title: 'Gap Analysis and Recommendations',
      activeId: 'recommendations',
      bodyFile: 'recommendations.html',
      bodyClass: 'page-compare page-gap',
      styles: [
        '/legacy/compare/tatvic/tokens.css',
        '/legacy/compare/styles.css',
        '/legacy/compare/comparison-ui.css',
        '/legacy/compare/gap-analysis.css',
      ],
      configScript: compareConfig,
      scripts: ['<script src="/legacy/compare/recommendations.js" type="module"></script>'],
    }),
  );
});

app.get('/comparison/runs', (_req, res) => {
  res.type('html').send(
    renderPage({
      title: 'Run History',
      activeId: 'runs',
      bodyFile: 'runs.html',
      bodyClass: 'page-compare',
      styles: [
        '/legacy/compare/tatvic/tokens.css',
        '/legacy/compare/styles.css',
        '/legacy/compare/comparison-ui.css',
      ],
      configScript: compareConfig,
      scripts: ['<script src="/legacy/compare/runs.js" type="module"></script>'],
    }),
  );
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'be-the-answer',
    trafficOrigin: TRAFFIC_ORIGIN,
    compareOrigin: COMPARE_ORIGIN,
  });
});

app.get('/api/readability/catalog', (_req, res) => {
  const fixture = loadAiFixture();
  res.json({
    products: listCatalog(),
    fixture_slugs: (fixture.pages || []).map((page) => page.slug),
    disclaimer: fixture.disclaimer,
  });
});

app.get('/api/readability/compare', (req, res) => {
  const slug = String(req.query.slug || '').trim();
  if (!slug) {
    res.status(400).json({ error: 'slug is required' });
    return;
  }
  res.json(compareReadability(slug));
});

if (!fs.existsSync(path.join(__dirname, 'public', 'pages', 'traffic.html'))) {
  console.warn('Page fragments missing under public/pages');
}

app.listen(PORT, () => {
  console.log(`Be The Answer: http://localhost:${PORT}`);
  console.log(`Traffic API: ${TRAFFIC_ORIGIN}`);
  console.log(`Comparison API: ${COMPARE_ORIGIN}`);
});
