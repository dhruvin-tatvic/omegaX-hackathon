# OmegaX Hackathon — Team Context (as of 2026-10-25)

Share this file with teammates for a quick picture of what exists in the repo, how it runs, and what it is for.

**GitHub:** https://github.com/dhruvin-tatvic/omegaX-hackathon

---

## 1. What this repo is

| Item | Detail |
|------|--------|
| **Repo** | `omegaX-hackathon` |
| **Hackathon focus** | Tatvic hackathon — **Problem Statement 6 (PS6)**: build an **AI-readability audit** capability against a realistic motorcycle brand website |
| **What is in git today** | **`sample-website/`** (Apex Moto audit target) + **`tools/traffic-dashboard/`** (Render log UI: human vs bot, 24h, AI crawler detail) + **`docs/`** (deploy, testing, evidence, alternates) |
| **What is not in this repo (yet)** | The audit **agent** itself (scoring, reports, automation beyond `check-site.mjs`) — configs mention tuning “the agent,” but agent code lives outside this tree if you are building it separately |
| **Live deployment (Render)** | **https://omegax-hackathon.onrender.com** — service `srv-dbe892a9lscs73a8o5vg` ([dashboard](https://dashboard.render.com/web/srv-dbe892a9lscs73a8o5vg)) |
| **Health check** | `GET /health` → plain text `OK` (set as Render health check path) |
| **Data** | **Simulated** — all catalogue, prices, dealers, and finance are fictional (`catalogue.json` includes `data_label: SIMULATED`) |

**Workspace note:** `d:\Hackathon` contains only this `omegaX-hackathon` folder.

**Site URL in builds:** set `VITE_SITE_URL` to the public URL (or `RENDER_EXTERNAL_URL` on Render). See [docs/render-deployment.md](./docs/render-deployment.md).

---

## 2. Repository layout

```
omegaX-hackathon/
├── README.md
├── TEAM_CONTEXT.md           # This file
├── config/                   # Reference scenario JSON (sync with sample-website/src/config)
├── data/catalogue.json
├── docs/
│   ├── LOCAL_TESTING.md      # Local URLs, CMD cd /d, dashboard setup
│   ├── render-deployment.md  # Render build/start, 503 troubleshooting
│   ├── ALTERNATE_TESTING.md  # Tunnel, Netlify, check-site when LLM gets 503
│   └── evidence/             # Saved Render logs, LLM access test notes
├── scripts/
│   ├── start-local-preview.ps1
│   ├── start-traffic-dashboard.ps1
│   └── tunnel-preview.ps1    # Build + preview + tunnel hints for LLM tests
├── tools/traffic-dashboard/  # Local dashboard :3456 (Render Logs API)
└── sample-website/
    ├── render.yaml           # Optional Render blueprint
    ├── netlify.toml          # Optional static deploy (dist only)
    ├── server.js             # Render: static dist + firewall_block + /health
    ├── src/, scripts/, public/
    └── dist/                 # Built output (gitignored; required on deploy)
```

**Source of truth for bikes/dealers/finance:** `sample-website/src/data/catalogue.json`  
**Scenario switches:** `sample-website/src/config/problems_practice.json` and `problems_dryrun.json`

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
- **Build output:** static pre-rendered HTML in `dist/` (audit target for no-JS crawlers)
- **Production:** **Render** — `npm start` → Express `server.js` on `PORT`
- **Alternate hosting:** static `dist/` via **Netlify** / Cloudflare Pages (`netlify.toml`) — avoids Render sleep; no Express/firewall on static-only hosts
- **Lint:** oxlint

### Stable HTML markers (for bots / audit agents)

- Ex-showroom price: `<span class="price" data-slug="...">`
- On-road: `<table class="onroad">` · Specs: `<table class="specs">` (or image-only on some bikes)
- Variants: `<ul class="variants">` · Colours: `<ul class="colours">`
- Availability: `<p class="availability">` · Finance: `<table class="finance">`

Per-route **title, meta description, canonical**, and **JSON-LD** are injected at **prerender**.

### Production server (Render)

| Piece | Behavior |
|-------|----------|
| `server.js` | Serves `dist/`; **`GET /health`**; **firewall_block** from scenario JSON; Morgan logs → Render |
| **Render settings** | Root dir: **`sample-website`** · Build: `npm install && VITE_SITE_URL=$RENDER_EXTERNAL_URL npm run build` · Start: `npm start` · Health: `/health` |
| Build artifacts | `robots.txt`, `sitemap.xml`, brochure PDFs, spec images |

---

## 4. Traffic dashboard (`tools/traffic-dashboard`)

Local tool — **does not** host the website; pulls **Render Logs API** using API key (never commit `.env`).

| Item | Detail |
|------|--------|
| **Overview** | http://localhost:3456 |
| **AI crawlers** | http://localhost:3456/ai-crawlers.html — provider, crawler UA, paths fetched, recent bot hits |
| **Status** | http://localhost:3456/status.html |
| **`.env`** | `RENDER_API_KEY`, `RENDER_SERVICE_ID=srv-dbe892a9lscs73a8o5vg` |
| **Start** | `cd tools/traffic-dashboard` → `npm start` or `restart-dashboard.cmd` |
| **Window** | Last **24h** (`LOG_WINDOW_HOURS`); **Refresh now** = full paginated sync |
| **API** | `GET /api/status`, `/api/ai-crawlers`, `/api/logs` |

**Limitation:** HTTP logs show **User-Agent + URL + time**, not the user’s **chat prompt**.

**“Not configured” fix:** stop old process on port 3456, restart from `tools/traffic-dashboard` after `.env` exists. See [docs/LOCAL_TESTING.md](./docs/LOCAL_TESTING.md).

---

## 5. LLM testing & 503 errors

| Symptom | Likely cause |
|---------|----------------|
| LLM says **503** / site unavailable | **Render free tier asleep** — one-shot bot fetch times out during wake-up (browser retry may work) |
| Dashboard shows **200** but LLM fails | Same cold-start pattern; bots don’t retry like browsers |
| **403** on `/finance` for some bots | Planted **`firewall_block`** (practice: Perplexity on `/finance`) — not a full-site outage |
| **Gemini** can’t read site | Often **no Google crawler hit** in logs; not always a 503 |

### Recommended alternates (when Render 503 blocks demos)

Documented in **[docs/ALTERNATE_TESTING.md](./docs/ALTERNATE_TESTING.md)**:

1. **Tunnel + local preview** — `npm run build && npm run preview` → ngrok/localtunnel port **4173** (best for live ChatGPT/Perplexity)
2. **Static deploy** — Netlify/Cloudflare Pages from `dist/` (always on)
3. **`check-site.mjs`** — simulates GPTBot without any LLM
4. **Uptime ping** `/health` every 10–14 min or **paid** Render plan

Evidence from manual tests: [docs/evidence/](./docs/evidence/) (ChatGPT-User / ExaUser 200; Gemini often absent in logs).

---

## 6. Build pipeline

```bash
cd sample-website
npm install
npm run build
npm run preview   # :4173
# or
npm start         # :10000 — same as Render (Express)
```

Build steps: `generate-static.mjs` → `vite build` → `prerender.mjs`.

| Env var | Effect |
|---------|--------|
| `VITE_SCENARIO` | `practice` (default) or `dryrun` — planted problem set |
| `VITE_SITE_URL` | Canonical / sitemap host (use live public URL) |

---

## 7. Planted problems (audit ground truth)

| Problem type | Practice | Dry-run |
|--------------|----------|---------|
| `js_only_content` | `storm-200` | `thunderstrike-450` |
| `tabs_not_in_html` | `storm-390` | `phantom-500` |
| `conflicting_price` | `zenith-450-scrambler` on `/offers` | `phantom-350` on `/motorcycles` |
| `stale_page` | `thunderstrike-650` → `…/thunderstrike-650-2025` | `storm-200` → `…/storm-200-2025` |
| `missing_jsonld` | `phantom-500`, `storm-125`, `voyager-450` | `nightfall-350`, `zenith-350-scrambler` |
| `robots_block_dealers` | On (`GPTBot`, `OAI-SearchBot`) | Off |
| `intentional_account_block` | `/account`, `/login` | Same |
| `price_only_in_pdf` | `voyager-650` | `thunderstrike-650-rally` |
| `image_only_specs` | `zenith-650-scrambler` | Disabled |
| `finance_not_on_site` | `nightfall-650` | `storm-160` |
| `firewall_block` | `/finance` + Perplexity | `/offers` + ClaudeBot |
| `offer_terms_conflict` | Enabled | Disabled |

Details: `sample-website/src/config/problems_*.json`, `sample-website/README.md`.

---

## 8. Verification tooling

```bash
node scripts/check-site.mjs https://omegax-hackathon.onrender.com
node scripts/check-site.mjs http://localhost:4173
```

Fetches sitemap URLs without JS (GPTBot vs Chrome); checks `.price`, Product JSON-LD, status codes.

---

## 9. Key files

| File | Why |
|------|-----|
| `sample-website/src/data/catalogue.json` | Product ground truth |
| `sample-website/src/data/catalogue.js` | Scenario helpers |
| `sample-website/server.js` | Render production + `/health` + firewall |
| `sample-website/scripts/prerender.mjs` | Static HTML for bots |
| `sample-website/src/config/siteUrl.js` | `VITE_SITE_URL` |
| `tools/traffic-dashboard/server.js` | Dashboard API + static UI |
| `tools/traffic-dashboard/lib/classify-traffic.js` | Human vs AI bot UA rules |
| `docs/ALTERNATE_TESTING.md` | When LLMs hit 503 |

---

## 10. Teammate onboarding (~10 min)

1. Clone → `sample-website` → `npm install` → `npm run build` → `npm run preview` → **:4173**
2. Read this file + one `problems_practice.json`
3. Run `check-site.mjs` on localhost or Render URL
4. `tools/traffic-dashboard`: copy `.env.example` → `.env`, `npm start` → **:3456**
5. For **live LLM demos** if Render 503: use **tunnel** or **ALTERNATE_TESTING.md**

---

## 11. Open items

- Audit **agent** code / rubric may live outside this repo
- `dist/` is gitignored — Render/Netlify must run `npm run build`
- Rotate **Render API key** if ever shared in chat; never commit `.env`
- Keep root `config/` in sync with `sample-website/src/config/` when scenarios change

---

*Last updated: 2026-10-25 — Render URL, traffic dashboard AI page, 503 alternates, /health.*
