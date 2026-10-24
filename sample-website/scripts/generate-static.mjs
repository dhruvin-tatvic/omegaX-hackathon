import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load configs and catalogue
const scenario = process.env.VITE_SCENARIO === 'dryrun' ? 'dryrun' : 'practice';
console.log(`[generate-static] Generating static assets for scenario: ${scenario}`);

const cataloguePath = path.join(projectRoot, 'src/data/catalogue.json');
const catalogue = JSON.parse(fs.readFileSync(cataloguePath, 'utf8'));

const problemsConfigPath = path.join(projectRoot, `src/config/problems_${scenario}.json`);
const problems = JSON.parse(fs.readFileSync(problemsConfigPath, 'utf8'));

// Ensure public directories
const publicDir = path.join(projectRoot, 'public');
const brochuresDir = path.join(publicDir, 'brochures');
const specsDir = path.join(publicDir, 'specs');

fs.mkdirSync(brochuresDir, { recursive: true });
fs.mkdirSync(specsDir, { recursive: true });

// 1. Generate robots.txt
console.log('[generate-static] Generating robots.txt...');
let robotsContent = '';

// Intentional account block (always on)
robotsContent += 'User-agent: *\n';
robotsContent += 'Disallow: /account\n';
robotsContent += 'Disallow: /login\n\n';

// robots_block_dealers
if (problems.robots_block_dealers && problems.robots_block_dealers.enabled) {
  for (const bot of problems.robots_block_dealers.user_agents || []) {
    robotsContent += `User-agent: ${bot}\n`;
    robotsContent += `Disallow: ${problems.robots_block_dealers.path || '/dealers'}\n\n`;
  }
}

robotsContent += 'Sitemap: https://apex-moto-one.vercel.app/sitemap.xml\n';
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robotsContent, 'utf8');

// 2. Generate sitemap.xml
console.log('[generate-static] Generating sitemap.xml...');
const publicUrls = [
  'https://apex-moto-one.vercel.app/',
  'https://apex-moto-one.vercel.app/motorcycles',
];

for (const bike of catalogue.bikes) {
  publicUrls.push(`https://apex-moto-one.vercel.app/motorcycles/${bike.slug}`);
}

// Stale page if enabled
if (problems.stale_page && problems.stale_page.enabled && problems.stale_page.url) {
  publicUrls.push(`https://apex-moto-one.vercel.app${problems.stale_page.url}`);
}

publicUrls.push(
  'https://apex-moto-one.vercel.app/offers',
  'https://apex-moto-one.vercel.app/dealers',
  'https://apex-moto-one.vercel.app/finance',
  'https://apex-moto-one.vercel.app/faq',
  'https://apex-moto-one.vercel.app/about',
  'https://apex-moto-one.vercel.app/contact',
  'https://apex-moto-one.vercel.app/book-test-ride'
);

let sitemapXml = '<?xml version="1.0" encoding="UTF-8"?>\n';
sitemapXml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
for (const url of publicUrls) {
  sitemapXml += '  <url>\n';
  sitemapXml += `    <loc>${url}</loc>\n`;
  sitemapXml += '    <changefreq>weekly</changefreq>\n';
  sitemapXml += '  </url>\n';
}
sitemapXml += '</urlset>\n';
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemapXml, 'utf8');

// 3. Health file
fs.writeFileSync(path.join(publicDir, 'health'), 'OK', 'utf8');

// 4. Generate PDF brochures for all bikes
console.log('[generate-static] Generating PDF brochures...');

function sanitizePdfText(str) {
  if (!str) return '';
  return String(str).replace(/[\\()]/g, '');
}

function generateMinimalPdf(bike) {
  // A5 / A4 single page PDF 1.4 stream
  const lines = [
    `APEX MOTO - OFFICIAL SPECIFICATION BROCHURE`,
    `=============================================`,
    `Model: ${bike.name} (${bike.model_year || 2026})`,
    `Category: ${bike.category} | Badge: ${bike.badge || 'Standard'}`,
    `Tagline: ${bike.tagline}`,
    `Ex-Showroom Price: INR ${Number(bike.ex_showroom_price_inr).toLocaleString('en-IN')}`,
    ``,
    `VARIANTS & PRICING:`,
  ];

  for (const v of bike.variants || []) {
    lines.push(`  * ${v.name}: INR ${Number(v.ex_showroom_price_inr).toLocaleString('en-IN')}`);
    if (v.features) {
      lines.push(`    Features: ${v.features.join(', ')}`);
    }
  }

  lines.push(``);
  lines.push(`INDICATIVE ON-ROAD PRICES BY CITY:`);
  if (bike.on_road_price_inr) {
    for (const [city, price] of Object.entries(bike.on_road_price_inr)) {
      lines.push(`  * ${city}: INR ${Number(price).toLocaleString('en-IN')}`);
    }
  }

  lines.push(``);
  lines.push(`KEY TECHNICAL SPECIFICATIONS:`);
  if (bike.specs) {
    for (const [k, val] of Object.entries(bike.specs)) {
      lines.push(`  * ${k.replace(/_/g, ' ')}: ${val}`);
    }
  }

  lines.push(``);
  lines.push(`COLOURS: ${(bike.colours || []).join(', ')}`);
  lines.push(`AVAILABILITY: ${bike.availability || 'In stock'}`);
  lines.push(``);
  lines.push(`Authorised Dealers: ${(bike.dealer_cities || []).join(', ')}`);
  lines.push(`Visit https://apex-moto-one.vercel.app/motorcycles/${bike.slug} for test rides.`);

  // Build PDF content stream
  let streamText = 'BT\n/F1 10 Tf\n14 TL\n40 790 Td\n';
  for (const line of lines) {
    const safe = sanitizePdfText(line);
    streamText += `(${safe}) '\n`;
  }
  streamText += 'ET\n';

  const streamBuffer = Buffer.from(streamText, 'utf8');

  // PDF Objects
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n';
  const obj3 = '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n';
  const obj4 = '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>\nendobj\n';
  const obj5Header = `5 0 obj\n<< /Length ${streamBuffer.length} >>\nstream\n`;
  const obj5Footer = '\nendstream\nendobj\n';

  let offset = 9; // length of "%PDF-1.4\n"
  const offsets = [0];

  offsets.push(offset);
  offset += Buffer.byteLength(obj1);

  offsets.push(offset);
  offset += Buffer.byteLength(obj2);

  offsets.push(offset);
  offset += Buffer.byteLength(obj3);

  offsets.push(offset);
  offset += Buffer.byteLength(obj4);

  offsets.push(offset);
  const obj5Total = Buffer.byteLength(obj5Header) + streamBuffer.length + Buffer.byteLength(obj5Footer);
  offset += obj5Total;

  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) {
    xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;

  return Buffer.concat([
    Buffer.from('%PDF-1.4\n', 'utf8'),
    Buffer.from(obj1, 'utf8'),
    Buffer.from(obj2, 'utf8'),
    Buffer.from(obj3, 'utf8'),
    Buffer.from(obj4, 'utf8'),
    Buffer.from(obj5Header, 'utf8'),
    streamBuffer,
    Buffer.from(obj5Footer, 'utf8'),
    Buffer.from(xref, 'utf8'),
    Buffer.from(trailer, 'utf8')
  ]);
}

for (const bike of catalogue.bikes) {
  const pdfBuf = generateMinimalPdf(bike);
  fs.writeFileSync(path.join(brochuresDir, `${bike.slug}.pdf`), pdfBuf);
}

// 5. Generate Specs PNG for image_only_specs bikes
console.log('[generate-static] Generating Specs PNG image...');

function generateTablePng(width, height) {
  // Generate simple valid uncompressed PNG image with RGB data
  const rowBytes = width * 3;
  const rawData = Buffer.alloc((rowBytes + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * (rowBytes + 1);
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      // Grid lines pattern
      if (y === 0 || y === height - 1 || x === 0 || x === width - 1 || y % 30 === 0 || x === 260) {
        rawData[pixelOffset] = 60;
        rawData[pixelOffset + 1] = 60;
        rawData[pixelOffset + 2] = 70;
      } else if (y < 40) {
        // Header
        rawData[pixelOffset] = 30;
        rawData[pixelOffset + 1] = 30;
        rawData[pixelOffset + 2] = 40;
      } else {
        // Table body
        rawData[pixelOffset] = 18;
        rawData[pixelOffset + 1] = 18;
        rawData[pixelOffset + 2] = 22;
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);

  function createChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    // Simple crc32 calculation
    let crc = 0xffffffff;
    const combined = Buffer.concat([typeBuf, data]);
    for (let i = 0; i < combined.length; i++) {
      crc = (crc >>> 8) ^ crcTable[(crc ^ combined[i]) & 0xff];
    }
    crc = (crc ^ 0xffffffff) >>> 0;
    crcBuf.writeUInt32BE(crc, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c >>> 0;
  }

  // PNG Signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = createChunk('IHDR', ihdr);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

const specsBikes = problems.image_only_specs?.enabled ? (problems.image_only_specs.bikes || []) : ['zenith-650-scrambler'];
for (const slug of specsBikes) {
  const pngBuf = generateTablePng(700, 480);
  fs.writeFileSync(path.join(specsDir, `${slug}.png`), pngBuf);
}

console.log('[generate-static] Static generation complete!');
