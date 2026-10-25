# Apex Moto — Test Website for AI-Readability Audit

Fictional motorcycle brand site (React + Vite) for the Tatvic hackathon **Problem Statement 6**. **Production hosting is Render only** — see [../docs/render-deployment.md](../docs/render-deployment.md).

Set public URL at build time:

```bash
VITE_SITE_URL=https://your-service.onrender.com npm run build
```

On Render, use `VITE_SITE_URL=$RENDER_EXTERNAL_URL` in the build command.

---

## Test-site setup

### 1. Installation

```bash
cd sample-website
npm install
```

### 2. Build

1. `node scripts/generate-static.mjs` — `robots.txt`, `sitemap.xml`, PDFs, spec images  
2. `vite build` — client bundle  
3. `node scripts/prerender.mjs` — static HTML + metadata + JSON-LD in `dist/`

```bash
npm run build
# or
VITE_SCENARIO=dryrun VITE_SITE_URL=https://your-service.onrender.com npm run build
```

### 3. Run locally

```bash
npm run preview          # static dist on :4173
npm start                # Express (same as Render) on PORT / 10000
```

### 4. Scenario switch

Configs: `src/config/problems_practice.json`, `problems_dryrun.json`.

**Render:** set env `VITE_SCENARIO` to `practice` or `dryrun` and rebuild.

### 5. Audit check (`check-site.mjs`)

Fetches sitemap URLs without JS (GPTBot vs Chrome):

```bash
node scripts/check-site.mjs https://your-service.onrender.com
node scripts/check-site.mjs http://localhost:4173
```

### 6. Save Render logs locally

```bash
npm run logs:save -- <render-service-id>
```

Writes `docs/evidence/render-logs-<date>.txt`. See [../docs/render-deployment.md](../docs/render-deployment.md).

---

## Features

- Pre-rendered static HTML per route  
- Stable audit selectors (`.price`, `.specs`, `.onroad`, etc.)  
- 18-bike catalogue in `src/data/catalogue.json`  
- Planted problems per scenario JSON  
- **`server.js`:** static hosting + `firewall_block` on Render  

---

## Planted problems reference

| Problem | Practice | Dry-Run |
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
