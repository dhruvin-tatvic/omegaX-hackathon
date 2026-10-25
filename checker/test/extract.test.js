import { describe, expect, it } from 'vitest';
import { extractPage, looksJavaScriptRendered, pageLooksLikeProduct } from '../src/crawl/extract.js';

const html = `<!doctype html>
<html>
  <head>
    <title>Helios Lamp</title>
    <meta name="description" content="Desk lamp with brass finish" />
    <link rel="canonical" href="https://lamps.example/products/helios" />
    <script type="application/ld+json">{"@type":"Product","name":"Helios Lamp","offers":{"price":12500,"priceCurrency":"INR"}}</script>
  </head>
  <body>
    <h1>Helios Lamp</h1>
    <p>Ex-showroom price <span class="price">₹12,500</span></p>
    <table>
      <tr><th>Finish</th><td>Brass</td></tr>
    </table>
    <a href="/about">About</a>
  </body>
</html>`;

describe('extractPage', () => {
  it('extracts title, metadata, tables, json-ld, prices and links', () => {
    const page = extractPage('https://lamps.example/products/helios', html);
    expect(page.title).toBe('Helios Lamp');
    expect(page.description).toContain('Desk lamp');
    expect(page.canonical).toContain('/products/helios');
    expect(page.prices.join(' ')).toContain('12,500');
    expect(page.tables.join(' ')).toMatch(/Finish/);
    expect(JSON.stringify(page.jsonld)).toContain('12500');
    expect(page.links.some((l) => l.endsWith('/about'))).toBe(true);
    expect(page.evidence.some((e) => e.kind === 'price' && e.numbers.includes(12500))).toBe(true);
    expect(page.hasProductJsonLd).toBe(true);
  });

  it('flags a JS-shell heuristic without claiming proof', () => {
    const shell = `<html><body><div id="root"></div>
      <script></script><script></script><script></script><script></script>
    </body></html>`;
    const page = extractPage('https://lamps.example/app', shell);
    expect(page.jsLikely).toBe(true);
    expect(looksJavaScriptRendered(shell, page.readableText)).toBe(true);
  });

  it('does not flag ordinary HTML as a JS shell', () => {
    const page = extractPage('https://lamps.example/products/helios', html);
    expect(page.jsLikely).toBe(false);
  });

  it('records linked PDF and image resources instead of dropping them', () => {
    const page = extractPage(
      'https://lamps.example/products/helios',
      `<html><body>
        <h1>Helios Lamp</h1>
        <a href="/brochures/helios.pdf">Brochure</a>
        <img src="/images/helios.png" alt="Helios Lamp" />
      </body></html>`
    );
    expect(page.linkedResources.some((r) => r.kind === 'pdf' && r.url.endsWith('.pdf'))).toBe(true);
    expect(page.linkedResources.some((r) => r.kind === 'image' && r.url.endsWith('.png'))).toBe(true);
    expect(page.hasJsonLd).toBe(false);
    expect(pageLooksLikeProduct(page.url, page)).toBe(true);
  });
});
