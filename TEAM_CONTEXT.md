# OmegaX Hackathon — Team Context (as of 2026-10-25)

Share this file with teammates for a quick picture of what exists in the repo, how it runs, and what it is for.

---

## 1. What this repo is

| Item | Detail |
|------|--------|
| **Repo** | `omegaX-hackathon` |
| **Hackathon focus** | Tatvic hackathon — **Problem Statement 6 (PS6)**: build an **AI-readability audit** capability against a realistic motorcycle brand website |
| **What is in git today** | **`sample-website/`** (Apex Moto audit target) + **`tools/traffic-dashboard/`** (Render log UI: human vs bot, 24h window) + **`docs/`** (deploy, testing, evidence) |
| **What is not in this repo (yet)** | The audit **agent** itself (scoring, reports, automation beyond `check-site.mjs`) — configs mention tuning “the agent,” but agent code lives outside this tree if you are building it separately |
| **Live deployment** | **Render** — `https://<your-service>.onrender.com` (set `VITE_SITE_URL` / use `RENDER_EXTERNAL_URL` on build; see [docs/render-deployment.md](./docs/render-deployment.md)) |
| **Data** | **Simulated** — all catalogue, prices, dealers, and finance are fictional (`catalogue.json` includes `data_label: SIMULATED`) |

**Workspace note:** `d:\Hackathon` contains only this `omegaX-hackathon` folder.

---

## 2. Repository layout

```
omegaX-hackathon/
├── README.md                 # Repo overview + quick start
├── TEAM_CONTEXT.md           # This file
├── config/                   # Copy of problem scenarios (reference; build uses sample-website copies)
│   ├── problems_practice.json
│   └── problems_dryrun.json
├── data/
│   └── catalogue.json        # Duplicate/reference copy of master catalogue
├── docs/                     # LOCAL_TESTING, render-deployment, evidence/
├── scripts/                  # start-local-preview.ps1, start-traffic-dashboard.ps1
├── tools/
│   └── traffic-dashboard/    # http://localhost:3456 — Render API, bot/human split
└── sample-website/           # Main application (React + Vite)
    ├── src/                  # UI, pages, data adapter, scenario configs
    ├── scripts/              # Build-time generators, check-site, save-render-logs
    ├── public/               # Static assets (robots/sitemap generated at build)
    ├── dist/                 # Production output (pre-rendered HTML)
    └── server.js             # **Render production server** (static + firewall_block)
```

**Source of truth for bikes/dealers/finance:** `sample-website/src/data/catalogue.json`  
**Scenario switches (planted bugs):** `sample-website/src/config/problems_practice.json` and `problems_dryrun.json`

---

## 3. Product: Apex Moto website

**Brand:** Apex Moto — dark-themed motorcycle marketing site.

### Routes (React Router)

| Path | Purpose |
|------|---------|
| `/` | Home, featured bikes |
| `/motorcycles` | Full lineup |
| `/motorcycles/:slug` | Model detail (18 models + optional stale URL) |
| `/offers` | Promotions |
| `/dealers` | Dealer locator |
| `/finance` | EMI / bank partners |
| `/faq` | FAQ (FAQPage JSON-LD on build) |
| `/about`, `/contact` | Brand pages |
| `/book-test-ride`, `/book-test-ride/thanks` | Test ride form flow |
| `/account`, `/login` | Intentionally blocked for crawlers (see planted problems) |
| `*` | 404 |

### Catalogue

- **18 motorcycle models** across Adventure, Classic, Street, Scrambler, Tourer, Cruiser, Electric  
- Slugs: `thunderstrike-650`, `phantom-350`, `storm-200`, `zenith-450-scrambler`, `thunderstrike-450`, `thunderstrike-650-rally`, `phantom-500`, `phantom-350-bobber`, `storm-125`, `storm-160`, `storm-390`, `zenith-350-scrambler`, `zenith-650-scrambler`, `voyager-650`, `voyager-450`, `nightfall-350`, `nightfall-650`, `spark-e1`

### Tech stack

- **React 19** + **React Router 7** + **Vite 8**
- **Build output:** static pre-rendered HTML in `dist/` (not client-only SPA for production audit)
- **Deploy:** **Render** (`npm start` → Express on `PORT`)
- **Lint:** oxlint
- **Local dev:** `npm run dev` (Vite HMR; behavior may differ from production prerender)

### Stable HTML markers (for bots / audit agents)

The site is designed so auditors can scrape **without JavaScript** and find consistent selectors:

- Ex-showroom price: `<span class="price" data-slug="...">`
- On-road table: `<table class="onroad">`
- Specs: `<table class="specs">` (or image-only specs on specific bikes)
- Variants: `<ul class="variants">`
- Colours: `<ul class="colours">`
- Availability: `<p class="availability">`
- Finance: `<table class="finance">`

Per-route **title, meta description, canonical**, and **JSON-LD** (`Product`, `Organization`, `FAQPage`) are injected during **prerender**.

### Production server (Render)

| Piece | Behavior |
|-------|----------|
| `server.js` | Serves pre-rendered `dist/`; **firewall_block** from `problems_*.json`; morgan access logs → Render log stream |
| Build generates | `robots.txt`, `sitemap.xml`, brochure PDFs, spec images |
| Log archive | **`tools/traffic-dashboard/`** — live UI (bot vs human) via Render API; or `docs/evidence/` exports ([render-deployment.md](./docs/render-deployment.md)) |

### Traffic dashboard (`tools/traffic-dashboard`)

| Item | Detail |
|------|--------|
| **URL (local)** | http://localhost:3456 |
| **Config** | `.env` — `RENDER_API_KEY`, `RENDER_SERVICE_ID` (`srv-…`); copy from `.env.example` |
| **Start** | `npm start` (runs `check-env` + `node --env-file=.env server.js`) or `restart-dashboard.cmd` on Windows |
| **Window** | Rolling **24h** (`LOG_WINDOW_HOURS`); **Refresh now** = full paginated pull from Render |
| **Classifies** | Morgan access lines from `server.js` → human / bot (OpenAI, Exa, Perplexity, etc.) / unknown |
| **Secrets** | Never commit `.env`; rotate API keys if exposed |

See [docs/LOCAL_TESTING.md](./docs/LOCAL_TESTING.md) for CMD `cd /d` and troubleshooting “Not configured”.

---

## 4. Build pipeline

```bash
cd sample-website
npm install
npm run build    # default scenario: practice
npm run preview  # http://localhost:4173 — use this to mimic production
```

`npm run build` runs **in order**:

1. **`scripts/generate-static.mjs`** — `robots.txt`, `sitemap.xml`, PDFs, spec assets, health-related static output; reads `VITE_SCENARIO`
2. **`vite build`** — client bundle into `dist/`
3. **`scripts/prerender.mjs`** — SSR prerender all routes; merges metadata + JSON-LD into HTML files (including `cleanUrls` style `.html` and `/index.html` variants)

### Scenario switch

| Env var | Values | Effect |
|---------|--------|--------|
| `VITE_SCENARIO` | `practice` (default) or `dryrun` | Selects which planted-problem JSON is baked into the build |

**Render:** set `VITE_SCENARIO` and build with `VITE_SITE_URL=$RENDER_EXTERNAL_URL` (see [docs/render-deployment.md](./docs/render-deployment.md)).

**Dry run** uses a **different** problem mix (intended as a hidden evaluation set).

---

## 5. Planted problems (audit ground truth)

Problems are declared in JSON and implemented via `src/data/catalogue.js` helpers + page components (`MotorcycleDetail.jsx`, `ProductCard.jsx`, `Offers.jsx`, etc.) and build scripts.

### Practice vs dry-run (summary)

| Problem type | Practice | Dry-run |
|--------------|----------|---------|
| `js_only_content` | `storm-200` | `thunderstrike-450` |
| `tabs_not_in_html` | `storm-390` | `phantom-500` |
| `conflicting_price` | `zenith-450-scrambler` on `/offers` | `phantom-350` on `/motorcycles` |
| `stale_page` | `thunderstrike-650` → `/motorcycles/thunderstrike-650-2025` | `storm-200` → `/motorcycles/storm-200-2025` |
| `missing_jsonld` | `phantom-500`, `storm-125`, `voyager-450` | `nightfall-350`, `zenith-350-scrambler` |
| `robots_block_dealers` | On (`GPTBot`, `OAI-SearchBot`) | Off |
| `intentional_account_block` | `/account`, `/login` | Same |
| `price_only_in_pdf` | `voyager-650` | `thunderstrike-650-rally` |
| `image_only_specs` | `zenith-650-scrambler` | Disabled |
| `finance_not_on_site` | `nightfall-650` | `storm-160` |
| `firewall_block` | `/finance` + Perplexity bots | `/offers` + ClaudeBot |
| `offer_terms_conflict` | Enabled | Disabled |

Full fields and notes: see `sample-website/src/config/problems_*.json` and `sample-website/README.md`.

### Implementation patterns teammates should know

- **`js_only_content`:** `useIsClient()` — price/specs hidden in initial HTML until browser mount (detail page + cards).
- **`tabs_not_in_html`:** Specs/variants tabs mount content only after click.
- **`stale_page`:** Extra sitemap URL with outdated `previous_values` from catalogue.
- **`conflicting_price`:** Wrong price on a specific listing page.
- **`missing_jsonld`:** Product schema omitted at prerender for listed slugs.
- **`price_only_in_pdf`:** HTML omits price; PDF brochure holds it.
- **`image_only_specs`:** Specs as image, not `<table class="specs">`.
- **`finance_not_on_site`:** Finance table absent on bike page.
- **`robots_block_dealers` / `intentional_account_block`:** Generated into `robots.txt`.
- **`firewall_block`:** `server.js` returns 403 by User-Agent + path prefix on Render.

---

## 6. Verification tooling

**`npm run check-site`** (or `node scripts/check-site.mjs <base-url>`):

- Parses `sitemap.xml` from the target host
- Fetches each URL **without JS** twice: **GPTBot/1.2** and **Chrome** UA
- Checks status, body size, `.price` presence, Product JSON-LD, and body equality across UAs

Example:

```bash
node scripts/check-site.mjs https://your-service.onrender.com
node scripts/check-site.mjs http://localhost:4173
```

---

## 7. Key files for agent / audit development

| File | Why it matters |
|------|----------------|
| `src/data/catalogue.json` | Ground-truth product data |
| `src/data/catalogue.js` | Scenario flags + `getBikeBySlug`, stale bike, formatINR |
| `src/config/problems_practice.json` | Practice planted issues |
| `src/config/problems_dryrun.json` | Evaluation planted issues |
| `scripts/prerender.mjs` | What bots see in static HTML |
| `scripts/generate-static.mjs` | robots, sitemap, PDFs |
| `server.js` | Live static host + firewall on Render |
| `scripts/save-render-logs.mjs` | Pull Render logs into `docs/evidence/` |
| `tools/traffic-dashboard/` | Live bot/human dashboard (Render Logs API) |
| `src/config/siteUrl.js` | `VITE_SITE_URL` for canonicals / sitemap |
| `src/pages/MotorcycleDetail.jsx` | Most per-bike audit surface |
| `public/robots.txt` | Overwritten at build from scenario |

---

## 8. Suggested teammate onboarding (5 minutes)

1. Clone repo → `cd sample-website` → `npm install`
2. `npm run build && npm run preview` — browse at `:4173`
3. Read `sample-website/README.md` and one problem config JSON
4. Run `npm run check-site` against local preview or production
5. If building the **audit agent**, treat planted problems as **expected findings**; use catalogue + configs as labels, and static HTML + sitemap as crawl scope  
6. Optional: `tools/traffic-dashboard` → monitor Render access logs (human vs AI bots)

---

## 9. LLM fetch evidence (manual test)

Render access logs (2026-10-25) show **ChatGPT-User** and **ExaUser** successfully `GET /` (200); **no Google/Gemini crawler** requests in that export—aligned with Gemini failing to read the live site while ChatGPT/Perplexity could. Stored under [`docs/evidence/`](./docs/evidence/).

---

## 10. Open questions / next work (typical hackathon gaps)

- **Audit agent** repository, API, or scoring rubric — coordinate separately if not merged here
- Whether `dist/` is committed intentionally (large); teammates may prefer build-on-CI only
- Keep `config/` at repo root in sync with `sample-website/src/config/` when changing scenarios

---

*Update this file when you add the agent, change scenarios, or change deployment.*
