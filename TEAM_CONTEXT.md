# OmegaX Hackathon — Team Context (as of 2026-10-25)

Share this file with teammates for a quick picture of what exists in the repo, how it runs, and what it is for.

**GitHub:** https://github.com/dhruvin-tatvic/omegaX-hackathon

---

## 1. What this repo is

| Item | Detail |
|------|--------|
| **Repo** | `omegaX-hackathon` |
| **Hackathon focus** | Tatvic hackathon — **Problem Statement 6 (PS6)**: build an **AI-readability audit** capability against a realistic motorcycle brand website |
| **What is in git today** | **`sample-website/`** (Apex Moto audit target) · **`tools/traffic-dashboard/`** (Render logs: human vs bot) · **`tools/comparison-dashboard/`** (LLM vs facts UI) · **`scripts/`** (facts scrape, Groq compare, sheet import) · **`data/`** (facts JSON, LLM sheet, comparison history) · **`docs/`** |
| **Audit automation in repo** | **Ground-truth scrape** (`apex-moto-facts`), **Groq comparison** (`llm-facts-compare`), **comparison dashboard** with historical runs. Full audit **agent/rubric** may still live outside this tree. |
| **Live deployment (Render)** | **https://omegax-hackathon.onrender.com** — service `srv-dbe892a9lscs73a8o5vg` ([dashboard](https://dashboard.render.com/web/srv-dbe892a9lscs73a8o5vg)) |
| **Health check** | `GET /health` → plain text `OK` |
| **Data** | **Simulated** catalogue on the site (`catalogue.json` includes `data_label: SIMULATED`). **`data/apex_moto_facts.json`** is scraped **live** site content via Firecrawl (reference ground truth for comparisons). |

**Site URL in builds:** set `VITE_SITE_URL` to the public URL (or `RENDER_EXTERNAL_URL` on Render). See [docs/render-deployment.md](./docs/render-deployment.md).

---

## 2. Repository layout

```
omegaX-hackathon/
├── README.md
├── TEAM_CONTEXT.md              # This file
├── config/                      # Reference scenario JSON
├── data/
│   ├── catalogue.json           # Reference copy
│   ├── apex_moto_facts.json     # Firecrawl scrape of live site (ground truth)
│   ├── apex_moto_sheet.json     # LLM Q&A rows (from sheet CSV)
│   ├── llm_comparison_report.json   # Latest Groq comparison output
│   ├── comparison_history.json      # Append-only history of comparison runs
│   └── snapshots/               # Dated facts snapshots (from facts scraper)
├── docs/                        # LOCAL_TESTING, render-deployment, ALTERNATE_TESTING, evidence/
├── scripts/
│   ├── apex-moto-facts/         # Firecrawl scrape + parsers (Apps Script compatible)
│   ├── llm-facts-compare/       # Groq: compare sheet vs facts
│   ├── fetch-google-sheet.mjs   # CSV → JSON (or public sheet export)
│   ├── start-comparison-dashboard.ps1
│   ├── start-local-preview.ps1
│   ├── start-traffic-dashboard.ps1
│   └── tunnel-preview.ps1
├── tools/
│   ├── shared/tatvic/           # Design tokens + brand CSS (Figtree, purple/cyan)
│   ├── traffic-dashboard/       # :3456 Render logs UI (Tatvic-themed)
│   └── comparison-dashboard/    # :3457 LLM vs facts UI (Tatvic-themed)
└── sample-website/              # Apex Moto — React/Vite, Render production
```

**Source of truth for bikes/dealers/finance (site code):** `sample-website/src/data/catalogue.json`  
**Source of truth for “what the live site says now” (audit comparisons):** `data/apex_moto_facts.json`  
**Scenario switches:** `sample-website/src/config/problems_practice.json` and `problems_dryrun.json`

---

## 3. Product: Apex Moto website

**Brand:** Apex Moto — dark-themed motorcycle marketing site (unchanged; not Tatvic-branded).

### Routes, catalogue, tech stack

Same as before: 18 models, React 19 + Vite 8, pre-rendered `dist/`, Render `server.js`, optional Netlify static deploy.

See sections in prior docs: [sample-website/README.md](./sample-website/README.md).

### Production server (Render)

| Piece | Behavior |
|-------|----------|
| `server.js` | Serves `dist/`; **`GET /health`**; **firewall_block** from scenario JSON; Morgan logs → Render |
| **Render settings** | Root: **`sample-website`** · Build: `npm install && VITE_SITE_URL=$RENDER_EXTERNAL_URL npm run build` · Start: `npm start` |

---

## 4. Ground truth: Apex Moto facts (`scripts/apex-moto-facts`)

Scrapes **https://omegax-hackathon.onrender.com** with **Firecrawl**, parses markdown into structured JSON (models, finance, offers, dealers, FAQ, etc.).

| Item | Detail |
|------|--------|
| **Apps Script** | Copy `scripts/apex-moto-facts/apex-moto-facts.js` to Google Apps Script; property `FIRECRAWL_API_KEY`; optional weekly trigger |
| **Local run** | `node scripts/apex-moto-facts/run.mjs` |
| **Env** | `scripts/apex-moto-facts/.env` — `FIRECRAWL_API_KEY` (gitignored). Optional: `FIRECRAWL_BATCH_SIZE`, `FIRECRAWL_MAX_RETRIES`, `BASE_URL` |
| **Outputs** | `data/apex_moto_facts.json`, `data/snapshots/apex_moto_facts_YYYY-MM-DD.json`, `data/apex_moto_changes.json` |
| **Notes** | Free Firecrawl tier may **429** on many model pages; runner uses slower batching/retries |

---

## 5. LLM responses dataset (`data/apex_moto_sheet.json`)

Rows: **AI Tool**, **Input**, **Output** — questions asked of ChatGPT, Gemini, Claude, Perplexity about the live site.

| Item | Detail |
|------|--------|
| **Source** | Exported from team sheet → `data/LLM Response Sheet - Sheet1.csv` |
| **Regenerate JSON** | `node scripts/fetch-google-sheet.mjs --csv "data/LLM Response Sheet - Sheet1.csv" --out data/apex_moto_sheet.json` |
| **Public sheet** | `node scripts/fetch-google-sheet.mjs "<google-sheet-url>"` (requires link-shared Viewer or API key) |

---

## 6. OmegaX Comparison LLM (`scripts/llm-facts-compare`)

**Core of PS6:** maps each row in **`apex_moto_sheet.json`** to authoritative **`apex_moto_facts.json`** via Groq, with deterministic pre-processing so the model compares the right models, cities, and catalogue fields.

| Stage | Module | Role |
|-------|--------|------|
| Ground truth | `ground-truth.js` | Question intent, city extraction, model alias matching (e.g. Zenith 450 → Scrambler), compact fact bundles per intent |
| Row audit | `prompts.js` → `ROW_SYSTEM` | Claim-by-claim mapping (`mapped_comparisons`), rubric score, `primary_gap`, `site_fix_hint` |
| Synthesis | `prompts.js` → `SYNTHESIS_SYSTEM` | Executive summary, themes, `top_factual_gaps`, prioritized `site_recommendations` tied to observed tool failures |

| Item | Detail |
|------|--------|
| **Run** | `node scripts/llm-facts-compare/run.mjs` |
| **Env** | `GROQ_API_KEY` in `scripts/apex-moto-facts/.env` (gitignored); optional `GROQ_MODEL`, `GROQ_COMPARE_TEMPERATURE`, `GROQ_ROW_DELAY_MS` |
| **Latest report** | `data/llm_comparison_report.json` — `meta.pipeline`: `omegax-comparison-llm-v2.1` |
| **Gap page only** | `node scripts/llm-facts-compare/run.mjs --synthesis-only` rebuilds `gap_analysis` from existing row audits (`gap-synthesis.js`) |
| **History** | Each run appends to `data/comparison_history.json` (deduped by `generated_at`) |

---

## 7. Comparison dashboard (`tools/comparison-dashboard`)

Local UI for **historical** LLM vs facts results. **Tatvic-inspired** design (Figtree, purple/cyan, light default + dark toggle).

| Page | URL |
|------|-----|
| **Overview** | http://localhost:3457/ |
| **Gap analysis & recommendations** | http://localhost:3457/recommendations.html |
| **Run history** | http://localhost:3457/runs.html |

| Item | Detail |
|------|--------|
| **Start** | `cd tools/comparison-dashboard` → `node server.js` or `scripts/start-comparison-dashboard.ps1` |
| **Port** | `COMPARISON_DASHBOARD_PORT` (default **3457**) |
| **Data** | Reads `data/comparison_history.json`; **Import latest report** pulls `data/llm_comparison_report.json` without re-running Groq |
| **Logo** | Single asset: [tatvic-dark-logo.svg](https://tatvic.com/wp-content/themes/tatvic-digital-analytics/assets/img/logo/tatvic-dark-logo.svg) (white pill behind logo in dark theme for contrast) |
| **Shared UI** | `public/comparison-ui.css`, `public/gap-analysis.css`, `public/tatvic/` (tokens + brand) |

---

## 8. Traffic dashboard (`tools/traffic-dashboard`)

Local tool — pulls **Render Logs API** (not the comparison tool).

| Item | Detail |
|------|--------|
| **Overview** | http://localhost:3456 — **AI Traffic Lens** (overview-only Tatvic UI): human vs bot traffic, log table, live refresh |
| **`.env`** | `RENDER_API_KEY`, `RENDER_SERVICE_ID=srv-dbe892a9lscs73a8o5vg` |
| **Start** | `cd tools/traffic-dashboard` → `npm start` or `restart-dashboard.cmd` |
| **Window** | Last **24h** (`LOG_WINDOW_HOURS`); **Refresh now** = full paginated sync |
| **API** | `GET /api/status`, `/api/logs`, `/api/events`, `POST /api/refresh` |
| **Note** | Separate from **`tools/comparison-dashboard/`** (:3457) for LLM vs facts |

**Limitation:** HTTP logs show **User-Agent + URL + time**, not chat prompts.

---

## 9. LLM testing & 503 errors

Unchanged — see [docs/ALTERNATE_TESTING.md](./docs/ALTERNATE_TESTING.md) (tunnel, Netlify, `check-site.mjs`). Evidence: [docs/evidence/](./docs/evidence/).

---

## 10. Build pipeline (sample-website)

```bash
cd sample-website
npm install
npm run build
npm run preview   # :4173
npm start         # :10000 — same as Render
```

| Env var | Effect |
|---------|--------|
| `VITE_SCENARIO` | `practice` (default) or `dryrun` |
| `VITE_SITE_URL` | Canonical / sitemap host |

---

## 11. Planted problems (audit ground truth)

Same scenario table as `problems_practice.json` / `problems_dryrun.json` — see [sample-website/README.md](./sample-website/README.md).

**Comparison insight (example):** LLMs that only read **homepage featured cards** may miss **Storm 125** (lowest ex-showroom in full catalogue) or fail to fetch model pages (Claude fetch failures in sheet tests). Groq gap analysis in `llm_comparison_report.json` summarizes themes and site recommendations (JSON-LD, robots, price list page, etc.).

---

## 12. Verification tooling

```bash
node sample-website/scripts/check-site.mjs https://omegax-hackathon.onrender.com
node scripts/llm-facts-compare/run.mjs          # after .env keys set
node scripts/apex-moto-facts/run.mjs          # refresh facts
```

---

## 13. Key files

| File | Why |
|------|-----|
| `data/apex_moto_facts.json` | Scraped ground truth for comparisons |
| `data/apex_moto_sheet.json` | LLM prompt/response test cases |
| `data/comparison_history.json` | All comparison dashboard runs |
| `data/llm_comparison_report.json` | Latest Groq comparison + gap analysis |
| `scripts/apex-moto-facts/apex-moto-facts.js` | Parsers + Apps Script scrape logic |
| `scripts/llm-facts-compare/run.mjs` | Groq batch compare + synthesis |
| `tools/comparison-dashboard/server.js` | Static UI + `/api/overview`, `/api/runs` |
| `tools/shared/tatvic/tokens.css` | Brand colour + typography tokens |
| `sample-website/server.js` | Render production + `/health` |
| `tools/traffic-dashboard/lib/classify-traffic.js` | Human vs AI bot UA rules |

---

## 14. Teammate onboarding (~15 min)

1. Clone → `sample-website` → `npm install` → `npm run build` → `npm run preview` → **:4173**
2. Read this file + one `problems_practice.json`
3. `node sample-website/scripts/check-site.mjs` on Render or localhost
4. **Traffic:** `tools/traffic-dashboard` → `.env` → `npm start` → **:3456**
5. **Facts:** add `FIRECRAWL_API_KEY` → `node scripts/apex-moto-facts/run.mjs`
6. **Compare:** add `GROQ_API_KEY` → `node scripts/llm-facts-compare/run.mjs`
7. **Comparison UI:** `node tools/comparison-dashboard/server.js` → **:3457**
8. Live LLM demos if Render 503: [docs/ALTERNATE_TESTING.md](./docs/ALTERNATE_TESTING.md)

---

## 15. Secrets & open items

- **Never commit** `.env` (Firecrawl, Groq, Render keys). Use `.env.example` as templates.
- **Rotate** API keys if shared in chat or screenshots.
- `dist/` is gitignored — Render/Netlify must run `npm run build`.
- Keep root `config/` in sync with `sample-website/src/config/` when scenarios change.
- Large JSON under `data/` may be committed for team handoff; refresh facts before demos if the site changed.
- Re-sync `tools/shared/tatvic/` → `tools/*/public/tatvic/` after token/brand edits.

---

*Last updated: 2026-10-25 — Firecrawl facts pipeline, Groq LLM comparison, comparison dashboard (Tatvic UI), historical runs, sheet/CSV import.*
