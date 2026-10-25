import http from 'http';
import https from 'https';
import { URL } from 'url';

import { getSiteUrl } from './site-url.mjs';

const baseUrl = process.argv[2] || getSiteUrl();
console.log(`\n======================================================`);
console.log(`APEX MOTO — AI-READABILITY AUDIT CHECK SCRIPT`);
console.log(`Target Base URL: ${baseUrl}`);
console.log(`======================================================\n`);

const UA_GPTBOT = 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)';
const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function fetchUrl(targetUrl, userAgent) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(targetUrl);
    const client = urlObj.protocol === 'https:' ? https : http;
    const req = client.get(
      urlObj,
      {
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      },
      res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data,
          });
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${targetUrl}`));
    });
  });
}

function parseSitemapUrls(xmlText) {
  const matches = [];
  const regex = /<loc>(.*?)<\/loc>/g;
  let match;
  while ((match = regex.exec(xmlText)) !== null) {
    matches.push(match[1].trim());
  }
  return matches;
}

function hasPriceText(html) {
  const priceRegex = /<[^>]+class="[^"]*\bprice\b[^"]*"[^>]*>([\s\S]*?)<\/[^>]+>/gi;
  let m;
  while ((m = priceRegex.exec(html)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, '').trim();
    if (text.length > 0) return true;
  }
  return false;
}

function hasProductJsonLd(html) {
  const scriptRegex = /<script\s+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = scriptRegex.exec(html)) !== null) {
    if (m[1].includes('"Product"')) return true;
  }
  return false;
}

async function runCheck() {
  const sitemapUrl = `${baseUrl.replace(/\/$/, '')}/sitemap.xml`;
  console.log(`Fetching sitemap: ${sitemapUrl}...`);

  let sitemapXml;
  try {
    const sitemapRes = await fetchUrl(sitemapUrl, UA_CHROME);
    if (sitemapRes.status !== 200) {
      console.error(`Error: sitemap.xml returned status ${sitemapRes.status}`);
      process.exit(1);
    }
    sitemapXml = sitemapRes.body;
  } catch (err) {
    console.error(`Failed to fetch sitemap:`, err.message);
    process.exit(1);
  }

  const urls = parseSitemapUrls(sitemapXml);
  console.log(`Found ${urls.length} URLs in sitemap.\n`);

  console.log(
    `| ${'Path'.padEnd(38)} | Status | Bytes | .price? | JSON-LD? | GPT=Chrome? |`
  );
  console.log(
    `|${'-'.repeat(40)}|${'-'.repeat(8)}|${'-'.repeat(7)}|${'-'.repeat(9)}|${'-'.repeat(10)}|${'-'.repeat(13)}|`
  );

  let passCount = 0;
  let failCount = 0;

  for (const urlStr of urls) {
    // If testing localhost or custom baseUrl, replace sitemap domain with test baseUrl
    const sitemapOrigin = new URL(urls[0]).origin;
    const testOrigin = new URL(baseUrl.replace(/\/$/, '') + '/').origin;
    const testUrl = urlStr.replace(sitemapOrigin, testOrigin);
    const urlObj = new URL(testUrl);
    const displayPath = urlObj.pathname;

    try {
      const [resBot, resChrome] = await Promise.all([
        fetchUrl(testUrl, UA_GPTBOT),
        fetchUrl(testUrl, UA_CHROME),
      ]);

      const priceOk = hasPriceText(resBot.body);
      const jsonLdOk = hasProductJsonLd(resBot.body);
      const bodiesMatch = resBot.body === resChrome.body;

      console.log(
        `| ${displayPath.padEnd(38)} | ${String(resBot.status).padEnd(6)} | ${String(resBot.body.length).padEnd(5)} | ${String(priceOk).padEnd(7)} | ${String(jsonLdOk).padEnd(8)} | ${String(bodiesMatch).padEnd(11)} |`
      );

      passCount++;
    } catch (err) {
      console.log(
        `| ${displayPath.padEnd(38)} | ERROR  | ${err.message}`
      );
      failCount++;
    }
  }

  console.log(`\nAudit completed: ${passCount} URLs checked, ${failCount} errors.\n`);
}

runCheck().catch(err => {
  console.error('Audit check failed:', err);
  process.exit(1);
});
