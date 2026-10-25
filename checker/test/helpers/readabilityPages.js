export const SITE = 'https://lamps.example';

const productCopy = `The Helios Lamp is a brass desk lamp with a listed specification sheet and a detailed product overview for buyers.`;

export function pagesForReadability() {
  return {
    [`${SITE}/robots.txt`]: {
      status: 200,
      body: `User-agent: *\nDisallow: /hidden\n`,
    },
    [`${SITE}/sitemap.xml`]: { status: 404, body: '' },
    [`${SITE}/`]: {
      body: `<html><head><title>Helios Lamp</title></head><body>
        <h1>Helios Lamp</h1>
        <p>${productCopy} Ex-showroom price <span class="price">₹12,500</span>.</p>
        <a href="/offers">Offers</a>
        <a href="/hidden">Hidden</a>
        <a href="/blocked">Blocked</a>
        <a href="/brochures/helios.pdf">Brochure PDF</a>
        <img src="/images/helios.png" alt="Helios Lamp" />
      </body></html>`,
    },
    [`${SITE}/offers`]: {
      body: `<html><head><title>Offers</title></head><body>
        <h1>Helios Lamp</h1>
        <p>${productCopy} Ex-showroom price <span class="price">₹9,999</span>.</p>
      </body></html>`,
    },
    [`${SITE}/hidden`]: {
      body: `<html><body><h1>Should not be crawled</h1></body></html>`,
    },
    [`${SITE}/blocked`]: { status: 403, body: 'Forbidden' },
    [`${SITE}/brochures/helios.pdf`]: {
      status: 200,
      type: 'application/pdf',
      body: '%PDF-fake-brochure',
    },
    [`${SITE}/images/helios.png`]: {
      status: 200,
      type: 'image/png',
      body: 'fake-png',
    },
  };
}

export function sparseShellPage() {
  return {
    [`${SITE}/robots.txt`]: { status: 404, body: '' },
    [`${SITE}/sitemap.xml`]: { status: 404, body: '' },
    [`${SITE}/`]: {
      body: `<html><body>
        <div id="root"></div>
        <script></script><script></script><script></script><script></script>
      </body></html>`,
    },
  };
}

export const renderedHeliosHtml = `<html><body>
  <h1>Helios Lamp</h1>
  <p>The Helios Lamp is a brass desk lamp with a listed specification sheet and a detailed product overview for buyers. Ex-showroom price ₹12,500.</p>
  <p>Peak power after paint is forty seven brake horsepower on the display panel.</p>
</body></html>`;
