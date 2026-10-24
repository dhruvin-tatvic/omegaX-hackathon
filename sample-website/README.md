# Apex Moto — Test Website for AI-Readability Audit

Apex Moto (https://apex-moto-one.vercel.app) is an existing React + Vite site deployed on Vercel, updated to serve as the test website for the AI-readability audit agent (Tatvic hackathon, Problem Statement 6).

---

## 🛠️ Test-site setup

### 1. Installation

```bash
cd sample-website
npm install
```

### 2. Build

The build runs three steps in sequence:
1. `node scripts/generate-static.mjs` — Generates `robots.txt`, `sitemap.xml`, 18 brochure PDFs, specs images, and health endpoint.
2. `vite build` — Builds the optimized client bundle.
3. `node scripts/prerender.mjs` — Pre-renders all routes to static HTML in `dist/` with per-page metadata, JSON-LD, and stable audit markup.

```bash
# Build for practice scenario (default)
npm run build

# Or build explicitly for a specific scenario
VITE_SCENARIO=practice npm run build
```

### 3. Run Locally

```bash
# Preview the pre-rendered production build
npm run preview
```
Visit `http://localhost:4173` to explore the static pre-rendered site.

### 4. Switch Scenario

The site supports switchable planted problems configured via `config/problems_practice.json` and `config/problems_dryrun.json`.

**Locally:**
```bash
# Switch to dryrun scenario
VITE_SCENARIO=dryrun npm run build
npm run preview
```

**On Vercel:**
1. Navigate to your Vercel Project Settings → Environment Variables.
2. Add or update `VITE_SCENARIO` to `practice` or `dryrun`.
3. Redeploy the deployment to apply the new planted problem set.

### 5. Run Audit Check Script (`check-site.mjs`)

The audit script reads `sitemap.xml` and fetches every public URL **without JavaScript** twice (once with `GPTBot/1.2` and once with standard Chrome UA). It validates status codes, response byte counts, presence of `.price` text, Product JSON-LD, and identical body responses:

```bash
# Check production live deployment
node scripts/check-site.mjs https://apex-moto-one.vercel.app

# Check local preview server
node scripts/check-site.mjs http://localhost:4173
```

---

## 🏍️ Features & Capabilities

- **Pre-rendered Static HTML:** Every route contains its full content in the HTML shell without requiring JavaScript.
- **Stable Markup for AI Audit:**
  - Ex-showroom price: `<span class="price" data-slug="<slug>">₹...</span>` with Indian digit grouping.
  - On-road prices table: `<table class="onroad">`
  - Full specifications: `<table class="specs">`
  - Model variants: `<ul class="variants">`
  - Colours: `<ul class="colours">`
  - Availability: `<p class="availability">`
  - Finance: `<table class="finance">`
- **Complete 18-Bike Catalogue:** Sourced from `data/catalogue.json` across 7 categories (Adventure, Classic, Street, Scrambler, Tourer, Cruiser, Electric).
- **Per-Page Head Tags & Structured Data:** Unique title, meta description, canonical link, and JSON-LD (`Product`, `FAQPage`, `Organization`).
- **Real Robots & Sitemap:** Dynamic `robots.txt` and `sitemap.xml` reflecting the active scenario rules.
- **Serverless API & Health Checks:** `/health` endpoint returning plain text `OK` for GET and HEAD, and `/api/test-ride` with 303 redirection to `/book-test-ride/thanks`.
- **Vercel Edge Middleware:** Implements `firewall_block` returning 403 for targeted bots on specified path prefixes, alongside non-blocking request logging.

---

## 📋 Planted Problems Reference

| Problem | Practice Scenario | Dry-Run Scenario |
| --- | --- | --- |
| `js_only_content` | `storm-200` | `thunderstrike-450` |
| `tabs_not_in_html` | `storm-390` | `phantom-500` |
| `conflicting_price` | `zenith-450-scrambler` (on `/offers`) | `phantom-350` (on `/motorcycles`) |
| `stale_page` | `thunderstrike-650` (`/motorcycles/thunderstrike-650-2025`) | `storm-200` (`/motorcycles/storm-200-2025`) |
| `missing_jsonld` | `phantom-500`, `storm-125`, `voyager-450` | `nightfall-350`, `zenith-350-scrambler` |
| `robots_block_dealers` | Enabled (`GPTBot`, `OAI-SearchBot`) | Disabled |
| `intentional_account_block` | `/account`, `/login` | `/account`, `/login` |
| `price_only_in_pdf` | `voyager-650` | `thunderstrike-650-rally` |
| `image_only_specs` | `zenith-650-scrambler` | Disabled |
| `finance_not_on_site` | `nightfall-650` | `storm-160` |
| `firewall_block` | `/finance` (`PerplexityBot`) | `/offers` (`ClaudeBot`) |
| `offer_terms_conflict` | Enabled | Disabled |
