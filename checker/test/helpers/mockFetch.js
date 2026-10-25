export function publicLookup() {
  return async () => [{ address: '8.8.8.8', family: 4 }];
}

export function mockFetch(pages) {
  return async (url) => {
    const href = new URL(url).href;
    const trimmed = href.endsWith('/') && href.split('/').length > 4 ? href.slice(0, -1) : href;
    const exact =
      pages[url] ||
      pages[href] ||
      pages[trimmed] ||
      pages[`${trimmed}/`] ||
      pages[href.replace(/\/$/, '')];
    const status = exact?.status ?? (exact ? 200 : 404);
    const body = exact?.body ?? 'not found';
    return {
      status,
      headers: {
        get: (name) => {
          if (name.toLowerCase() === 'content-type') return exact?.type || 'text/html';
          return null;
        },
        entries: () => [['content-type', exact?.type || 'text/html']],
      },
      arrayBuffer: async () => Buffer.from(body),
    };
  };
}

export const SITE_A = 'https://lamps.example';
export const SITE_B = 'https://chairs.example';

export const pagesA = {
  'https://lamps.example/robots.txt': { status: 404, body: '' },
  'https://lamps.example/sitemap.xml': { status: 404, body: '' },
  'https://lamps.example/': {
    body: `<html><head><title>Lamps Co</title></head><body>
      <h1>Helios Lamp</h1>
      <p>The Helios Lamp ex-showroom price is <span class="price">₹12,500</span>.</p>
      <a href="/about">About</a>
    </body></html>`,
  },
  'https://lamps.example/about': {
    body: `<html><head><title>About Lamps Co</title></head><body>
      <h1>About</h1><p>We sell the Helios Lamp.</p>
    </body></html>`,
  },
};

export const pagesB = {
  'https://chairs.example/robots.txt': { status: 404, body: '' },
  'https://chairs.example/sitemap.xml': { status: 404, body: '' },
  'https://chairs.example/': {
    body: `<html><head><title>Chairs Co</title></head><body>
      <h1>Nimbus Chair</h1>
      <p>The Nimbus Chair is listed at <span class="price">₹8,900</span>.</p>
    </body></html>`,
  },
};
