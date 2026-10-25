import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES = path.join(__dirname, 'public', 'pages');

export const TATVIC_LOGO =
  'https://tatvic.com/wp-content/themes/tatvic-digital-analytics/assets/img/logo/tatvic-dark-logo.svg';

export const PRODUCT = {
  name: 'Be The Answer',
  subtitle: 'AI Visibility & Answer Intelligence',
};

export const ROUTES = [
  { id: 'traffic', href: '/traffic', label: 'Traffic Intelligence', group: null },
  { id: 'human-view', href: '/human-view', label: 'Human View', group: null },
  { id: 'readability', href: '/readability', label: 'AI vs Human Readability', group: null },
  {
    id: 'comparison',
    href: '/comparison',
    label: 'Comparison Overview',
    group: 'LLM Comparison',
  },
  {
    id: 'recommendations',
    href: '/comparison/recommendations',
    label: 'Gap Analysis & Recommendations',
    group: 'LLM Comparison',
  },
  {
    id: 'runs',
    href: '/comparison/runs',
    label: 'Run History',
    group: 'LLM Comparison',
  },
];

function navMarkup(activeId) {
  const primary = ROUTES.filter((item) => !item.group)
    .map((item) => {
      const current = item.id === activeId ? ' aria-current="page"' : '';
      const cls = item.id === activeId ? ' class="is-active"' : '';
      return `<a href="${item.href}"${cls}${current}>${item.label}</a>`;
    })
    .join('');

  const nested = ROUTES.filter((item) => item.group === 'LLM Comparison');
  const groupOpen = nested.some((item) => item.id === activeId) ? ' open' : '';
  const nestedLinks = nested
    .map((item) => {
      const current = item.id === activeId ? ' aria-current="page"' : '';
      const cls = item.id === activeId ? ' class="is-active"' : '';
      return `<a href="${item.href}"${cls}${current}>${item.label}</a>`;
    })
    .join('');

  return `${primary}
        <details class="ta-nav-group"${groupOpen}>
          <summary>LLM Comparison</summary>
          <div class="ta-nav-sub">${nestedLinks}</div>
        </details>`;
}

export function renderPage({
  title,
  activeId,
  bodyFile,
  styles = [],
  scripts = [],
  bodyClass = '',
  configScript = '',
}) {
  const body = fs.readFileSync(path.join(PAGES, bodyFile), 'utf8');
  const extraStyles = styles.map((href) => `    <link rel="stylesheet" href="${href}" />`).join('\n');
  const extraScripts = scripts.join('\n');

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} | ${PRODUCT.name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/shell.css" />
${extraStyles}
    <link rel="stylesheet" href="/unify.css" />
  </head>
  <body class="ta-app ${bodyClass}">
    <header class="ta-topbar">
      <button type="button" class="ta-icon-btn" id="sidebarToggle" aria-controls="appSidebar" aria-expanded="false" aria-label="Toggle navigation">
        <span></span><span></span><span></span>
      </button>
      <a class="ta-brand" href="/traffic">
        <img class="ta-logo" src="${TATVIC_LOGO}" alt="Tatvic" width="120" height="34" />
        <span class="ta-product">
          <span class="ta-product-title">${PRODUCT.name}</span>
          <span class="ta-product-sub">${PRODUCT.subtitle}</span>
        </span>
      </a>
      <button type="button" class="ta-theme-btn" id="themeToggle">Dark mode</button>
    </header>
    <div class="ta-shell">
      <aside class="ta-sidebar" id="appSidebar">
        <p class="ta-nav-label">Apex Moto</p>
        <nav class="ta-nav" aria-label="Primary">${navMarkup(activeId)}
        </nav>
      </aside>
      <main class="ta-main" id="main">${body}
      </main>
    </div>
    <div class="ta-backdrop" id="sidebarBackdrop" hidden></div>
    <script src="/shell.js"></script>
    ${configScript}
    ${extraScripts}
  </body>
</html>
`;
}
