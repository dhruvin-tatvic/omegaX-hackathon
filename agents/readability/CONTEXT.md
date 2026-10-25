# Human View Collector — context for future chats

**Module:** Playwright Human View Collector  
**Agent:** OmegaX Agent 2 (Readability)  
**Working branch:** `feature/playwright-human-view`  
**Last updated:** 2026-10-25 (structured facts + dashboard V2)

---

## Project overview

OmegaX compares information **AI assistants can retrieve** with information **human visitors can read** on a website.

High-level architecture (other teammates own most of these):

| Piece | Role | This module? |
| --- | --- | --- |
| Agent 1: Traffic Lens | AI crawler / log visibility | No |
| Agent 2: Readability | AI View (no JS) vs Human View (rendered) | **Human View only** |
| Agent 3: Accuracy | Score AI answers against evidence | No |
| Fix Engine | Propose / apply demo fixes | No |
| Dashboard | Streamlit / existing checker UI | No |

The JavaScript checker under `checker/` is a separate product. **Do not modify it** from this module.

---

## Our responsibility

Implement **only** the Playwright-based Human View Collector:

1. Open a URL in headless Chromium.
2. Let JavaScript render.
3. Extract human-visible content.
4. Save JSON + full-page screenshot + rendered HTML.

Do **not** implement AI View (httpx/raw HTML), Accuracy, Traffic Lens, Fix Engine, dashboard, or LLM calls.

---

## Demo website

Primary test target (configurable, not hardcoded in extraction logic):

https://omegax-hackathon.onrender.com/

Validated targets: homepage, Thunderstrike 650 product page, then automatic crawl of all reachable internal HTML pages.

Do not crawl unrelated websites. Do not modify `sample-website/`.

---

## Technology stack

- Python 3.11+ (this machine ran 3.12.3; syntax stays 3.11-compatible)
- Playwright for Python (`playwright==1.64.1` at first install)
- Chromium, headless
- JSON files (no database)
- Standard library elsewhere
- No extra web frameworks

---

## Architecture

```
Homepage URL
        │
        ▼
site_crawler.py  (queue, normalize, robots, depth/page limits)
        │
        ├── capture_human_view(url)  [human_view.py, unchanged extraction]
        │         │
        │         ▼
        │   Playwright Chromium (1366×768, headless)
        │         │
        │         ▼
        │   scroll → read-only role=tab clicks → extract → classify products
        │         │
        │         ├── out/human-view-<timestamp>.json
        │         ├── out/screenshots/<slug>-<timestamp>.png
        │         └── out/rendered_html/<slug>-<timestamp>.html
        │
        └── enqueue internal links from rendered content.links
                  │
                  ▼
         out/site-human-view-<timestamp>.json
```

---

## Implementation details

### Main functions (`human_view.py`)

| Function | Purpose |
| --- | --- |
| `capture_human_view(url) -> dict` | Public API: render, extract, save, return payload |
| `load_config()` | Read `config.json` |
| `bounded_scroll()` | Finite scroll to trigger lazy content, then return to top |
| `reveal_tab_panels()` | Clicks in-page `role=tab` buttons only; merges panel text |
| `merge_extracted()` | Dedupes headings/specs/tables and appends new tab text |
| `main()` | CLI wrapper (`--url`, `--config`, `--output-dir`) |

### Site crawler (`site_crawler.py`)

| Function | Purpose |
| --- | --- |
| `crawl_site(url) -> dict` | BFS from homepage; calls `capture_human_view` per page |
| `normalize_url()` | Drop fragments, collapse trailing slashes, keep meaningful query params |
| `classify_skip_reason()` | External, mailto/tel/javascript, binary, logout |
| `robots_path_allowed()` | Honor robots.txt Allow/Disallow |
| `main()` | CLI (`--url`, `--max-pages`, `--max-depth`) |

Crawl is sequential with a polite delay (`crawl.delay_ms`, default 800). `max_concurrency` stays at 1 so Render is not hammered and each page still gets a full Playwright capture.

Sitemap handling: skip off-host `Sitemap:` URLs (`external_sitemap`), fetch `{origin}/sitemap.xml` when present, and enqueue only same-host `<loc>` entries. Robots Allow/Disallow still apply to those URLs.

### Product classification (`product_classify.py`)

Runs **after** extraction. Does not change `EXTRACT_PAGE_JS`.

On pages where the visible H1 matches a captured product name and ex-showroom/specs are present:

- `content.primary_product`: name, ex-showroom price, engine/power/torque/mileage, features, variants
- `content.related_products`: other product cards on the same page

Listing, home, FAQ, and form pages leave `primary_product` as `null`. Motorcycle names and prices are not hardcoded.

### Browser configuration

- Headless Chromium
- Viewport 1366×768
- `page.goto(..., wait_until="domcontentloaded")`
- Additional `load` wait with its own timeout (does **not** rely on `networkidle`)
- Short render wait after load
- Up to 3 navigation retries on HTTP 502/503/504 or a Render “Application loading” page
- Browser closed after capture

### Visibility

Human-readable text requires:

- Not `script` / `style` / `template` / `noscript`
- Not `hidden`, `display:none`, `visibility:hidden`, zero opacity
- Not inside `aria-hidden="true"`

Image metadata uses **layout** visibility so photos inside decorative `aria-hidden` wrappers (duplicate card links) are still recorded. Alt text is **not** merged into `visible_text`.

### Scrolling

Scrolls in configured pixel steps up to `scroll.max_scrolls`. Stops at document bottom or when height/position is stable. Never infinite.

After scrolling, the collector clicks visible `[role=tab]` **buttons** (not links or form controls) so Features / Specs / Variants panels become readable. It does not click Book a Test Ride, Enquire, Download, or other CTAs. The first tab is restored before the screenshot.

### Extraction (generic heuristics)

- Headings: visible `h1`–`h6`
- Products: visible titles inside `article` / class names containing `product`, plus nearby descriptions
- Prices: currency-like patterns in visible text and elements whose class contains `price`
- Specs: visible `dl`, tables, and label/value pairs inside product containers
- Links, images, tables

No motorcycle names, prices, or slugs are hardcoded.

### Error handling

Failures are recorded on `errors` and `status` is `success` | `partial` | `error`. JSON is still written when possible. Success is not claimed if visible text is empty.

---

## File structure

```
agents/readability/
  __init__.py          # exports capture_human_view, crawl_site
  human_view.py        # single-page collector + CLI
  site_crawler.py      # internal-link discovery + site report
  product_classify.py  # primary vs related product post-process
  config.json          # default URL, viewport, timeouts, crawl limits
  requirements.txt     # playwright
  README.md            # how to run
  CONTEXT.md           # this file
out/                   # created at runtime (gitignored contents)
  human-view-*.json
  site-human-view-*.json
  screenshots/
  rendered_html/
```

Root `.gitignore` excludes `out/` artifacts, `.venv/`, and Python cache.

---

## Output schema

| Field | Meaning |
| --- | --- |
| `url` | Requested URL |
| `final_url` | Browser URL after redirects |
| `captured_at` | UTC ISO-8601 |
| `capture_method` | Always `playwright_chromium` |
| `viewport` | Width/height used |
| `page_title` | `document.title` |
| `status` | `success`, `partial`, or `error` |
| `errors` | List of strings (empty on full success) |
| `screenshot_path` | Repo-relative PNG path |
| `rendered_html_path` | Repo-relative HTML from `page.content()` |
| `content.visible_text` | Original visible text, not rewritten |
| `content.headings` | `{level, text}` |
| `content.product_names` | Heuristic product titles |
| `content.prices` | Currency-like visible strings |
| `content.product_descriptions` | Nearby card/paragraph text |
| `content.specifications` | `{label, value}` |
| `content.links` | `{text, href}` |
| `content.images` | `{src, alt}` (alt separate from visible_text) |
| `content.tables` | Caption, headers, rows |
| `content.primary_product` | Detail-page object or `null` |
| `content.related_products` | Other product cards on a detail page |
| `limitations` | Known capture limits for consumers |

Site report fields: `base_url`, `total_pages_discovered`, `total_pages_captured`, `total_pages_failed`, `pages[]`, `skipped[]`, `warnings[]`, `errors[]`, `stopped_reason`, `coverage_complete`, `coverage_note`.

**`stopped_reason` is the primary completion signal.** `coverage_complete` is true only when the queue emptied and every captured page succeeded. It is not a claim of complete website coverage. Sitemap issues go in `warnings` / `skipped`, not `total_pages_failed`.

---

## Execution instructions

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r agents/readability/requirements.txt
python -m playwright install chromium
python agents/readability/human_view.py --url https://omegax-hackathon.onrender.com/
python agents/readability/human_view.py --url https://omegax-hackathon.onrender.com/motorcycles/thunderstrike-650
python agents/readability/site_crawler.py --url https://omegax-hackathon.onrender.com/ --max-pages 5
python agents/readability/site_crawler.py --url https://omegax-hackathon.onrender.com/ --max-pages 100 --max-depth 5
```

---

## Testing results

### Homepage

**Website tested:** https://omegax-hackathon.onrender.com/  
**Test date:** 2026-10-25  
**Collector status:** `success` (HTTP 200)  
**Validated against:** full-page screenshot + rendered HTML + visible JSON fields (not assumed from exit code)

Latest successful artifacts (post product-page extractor fixes; homepage still 6 bikes / 6 prices):

- `out/human-view-20261025-052012.json`
- `out/screenshots/homepage-20261025-052012.png`
- `out/rendered_html/homepage-20261025-052012.html`

Page title: `Apex Moto — Born to Ride. Built to Last.`  
Visible text: 2560 characters (matches nav, hero, six featured cards, pillars, footer). Hero CSS `aria-label` is stored on the image object, not mixed into `visible_text`.

### Featured motorcycles vs screenshot

| Name | Price | Tagline (description) |
| --- | --- | --- |
| Thunderstrike 650 | ₹4,20,000 | Command the Horizon |
| Phantom 350 | ₹2,15,000 | Classic Soul. Modern Heart. |
| Storm 200 | ₹1,45,000 | City. Conquered. |
| Zenith 450 Scrambler | ₹3,35,000 | Paved Roads Optional. |
| Thunderstrike 450 | ₹2,89,000 | Adventure, Unlocked. |
| Thunderstrike 650 Rally | ₹5,29,000 | Built for the Dakar in You. |

Storm 200’s price and 199cc / 25 bhp specs appear after Chromium JS render (they are present in the screenshot and JSON). A no-JS fetch of the same homepage can omit that price — that gap is why Human View exists.

Specs: 18 rows (Engine / Power / Starting* per featured bike), including duplicate 648cc values distinguished by `product`.  
Images: 8 (logo, six card photos, hero). Thunderstrike 450 and Rally reuse the Thunderstrike photo URL; they are kept as separate image records because alt text differs.  
Tables: none on the homepage (expected).

### Extraction issues found during homepage validation

1. First pass treated footer/pillar headings as product names (`MOTORCYCLES`, `Designed to Inspire`). Fixed by requiring a product-like container and skipping `nav`/`header`/`footer`.
2. BEM class `product-card__name` was mistaken for the card container, which dropped all product names. Fixed by matching class **tokens** (`product-card`, not `__` elements) and walking from the **parent**.
3. Duplicate `src` collapsed three Thunderstrike photos into one image. Fixed by deduping on `src|alt`.

### Product detail: Thunderstrike 650

**URL (from homepage links):** https://omegax-hackathon.onrender.com/motorcycles/thunderstrike-650  
**Test date:** 2026-10-25  
**Collector status:** `success` (HTTP 200, `final_url` adds a trailing slash)  
**Compared to:** live screenshot of the default Overview tab plus tab-revealed Features / Specs / Variants text

Artifacts:

- `out/human-view-20261025-051926.json`
- `out/screenshots/motorcycles-thunderstrike-650-20261025-051926.png`
- `out/rendered_html/motorcycles-thunderstrike-650-20261025-051926.html`

| Need | Extracted | Notes |
| --- | --- | --- |
| Product name | `THUNDERSTRIKE 650` (H1) | Related cards Phantom 350 and Thunderstrike 450 also listed |
| Price | ₹4,20,000 ex-showroom | On-road city prices, EMI ₹42,000 / ₹9,585, related starting prices, Adventure+ ₹4,75,000 also listed as visible currency |
| Description | Tagline `Command the Horizon` | Longer “Designed and built by Apex Moto…” copy is in `visible_text` and under heading Command The Road |
| Features | Key Features tab: Single seat, Basic instrument cluster, Alloy wheels | Matches the visible Features panel (first variant), not a hardcoded feature list |
| Engine / quick specs | 648cc, 47 bhp, 52 Nm, 24 km/l | Present in both the always-visible strip and the Specs table |
| Technical specs | 19-row `.specs` table | engine through mileage_kmpl |
| Variants | Standard ₹4,20,000 and Adventure+ ₹4,75,000 | In `visible_text` after tab reveal |
| Colours / stock | Blazing Orange, Glacier White; In stock | In `visible_text` |
| Tables | On-road (8 cities), finance EMI, specs | Specs table has empty `headers` because cells are `<td>`, not `<th>` |

First product-page pass (before fixes) was incomplete: Features/Specs/Variants were `hidden` tabs; finance heading was classified as a product; only one quick spec was captured; the 4-column EMI table was flattened into a fake spec. Fixed in `human_view.py` (tab reveal, H1 + product-card names only, leaf spec pairs, 2-column tables only). Homepage capture was re-run after those fixes and still matches six featured bikes.

A 503 Render wake-up page was recorded on the first attempt (`out/human-view-20261025-051522.json`). Navigation now retries transient 502/503/504 / “Application loading”.

### Known limitations

- Screenshot is the **Overview** tab (first tab restored). JSON `visible_text` / headings / specs **include** Features, Specs, and Variants after read-only tab clicks
- Related “You Might Also Like” cards appear in `product_names` and `prices`; they are also listed under `related_products` on detail pages
- Finance down-payment and EMI amounts remain in `prices` because they are visible currency strings; `primary_product.ex_showroom_price` is the classified ex-showroom amount
- On-road city amounts are in both `tables` and `specifications` (2-column table promotion)
- Hero banner is CSS `background-image`; product photo is still captured as an `<img>`
- No OCR; no accordion widgets that lack `role=tab`
- Cold starts: first request can still be 503 if all retries fail
- Each `capture_human_view` launches its own Chromium session (polite but slow for large crawls)
- Screenshot slugs ignore query strings; `book-test-ride?bike=...` files share a path slug and differ by timestamp

### Site crawl validation (2026-10-25)

Target: https://omegax-hackathon.onrender.com/

**5-page safety test** (`--max-pages 5`): `out/site-human-view-20261025-060250.json`

- Discovered 47 unique internal URLs
- Captured 5 unique pages (home, `/motorcycles`, `/offers`, `/finance`, `/dealers`), all `success`, all on the demo host
- No duplicate captures; JSON + screenshot + rendered HTML present
- `stopped_reason: page_limit` (primary). `coverage_complete: false` (expected; not full-site coverage)
- `errors: []`. Warning: skipped external Vercel sitemap. Origin `/sitemap.xml` locs on `apex-moto-one.vercel.app` recorded as `external`, not crawled

**Full crawl** (`--max-pages 100 --max-depth 5`): `out/site-human-view-20261025-061336.json`

| Metric | Count |
| --- | --- |
| Unique internal URLs seen | 47 |
| Eligible HTML pages captured | 45 (all `success`, 0 failed) |
| Motorcycle detail pages | 18 |
| `robots.txt` skipped | 2 (`/account`, `/login`) |
| PDF brochures skipped | 18 |
| External sitemap / locs | Vercel `Sitemap:` + Vercel `<loc>` values; none crawled |
| tel/mailto skipped | 16 unique numbers/addresses |
| `stopped_reason` | `queue_exhausted` |
| `errors` | `[]` |
| `warnings` | skipped external sitemap `https://apex-moto-one.vercel.app/sitemap.xml` |

Captured set: homepage, motorcycle catalogue, 18 model detail pages, offers, finance, dealers, FAQ, about, contact, book-test-ride, and 18 `book-test-ride?bike=` query variants.

Do **not** read `coverage_complete: true` as complete website coverage. It only means the queue emptied and captured pages succeeded. Still out of scope:

- `/account` and `/login` (`robots.txt`)
- Brochure PDFs
- Footer Privacy / Terms / Sitemap `href="#"` placeholders
- Off-host sitemap URLs (stale Vercel host in the live robots/sitemap files)

All 18 motorcycle detail pages received `primary_product`. Listing and utility pages kept `primary_product: null`.

### Pending improvements

- Accordion/`<details>` reveal if a later page needs it
- Optional reuse of one Chromium browser across crawl pages
- Commit of this module (only if requested)

### Structured facts + page categories (2026-10-25)

Derived from saved rendered HTML. Original `out/human-view-*.json` files were not overwritten.

| Piece | Path |
| --- | --- |
| Categories | `page_classify.py` |
| HTML DOM | `html_dom.py` |
| Facts | `structured_facts.py` |
| Enrich | `enrich_report.py` |
| Consolidated JSON | `consolidate_report.py` → `out/playwright-crawl-complete.json` |
| Schema | `STRUCTURED_FACTS.md` |
| Derived report | `out/derived/site-human-view-structured-20261025-061336.json` |
| Tests | `tests/` (22 unittest cases) |

Page-type counts on the saved 45-page crawl: homepage 1, product_listing 1, product_detail 18, offers 1, finance 1, dealer_listing 1, faq 1, about 1, contact 1, booking 19.

Mandatory money checks on that snapshot: Thunderstrike 650 ₹4,20,000 ex-showroom/starting; `/offers` ₹25,000 cash discount; `/finance` ₹42,000 down payment and ₹9,585 EMI; Adventure+ ₹4,75,000 kept on the variant entity; city on-road prices typed separately.

Dashboard: `agents/readability/review_dashboard/` loads the derived report. Serve from repo root:

```bash
python agents/readability/review_dashboard/generate_manifest.py
python -m http.server 8000
```

http://localhost:8000/agents/readability/review_dashboard/

If port 8000 is already bound, use another port (verified on 8010 in this session).

---

## Integration (AI View teammate)

Prefer the consolidated report `out/site-human-view-<timestamp>.json`:

1. Iterate `pages[]`. Skip any entry whose `status` is not `success`.
2. Load each `json_path` for full Human View content.
3. Compare `content.visible_text` / headings / prices / `primary_product` with raw httpx HTML (AI View) for the same URL.
4. Use `rendered_html_path` to inspect JS-injected markup.
5. Use `screenshot_path` as human ground-truth for what was on screen.
6. Read `skipped[]` so missing PDF/account/login/external-sitemap paths are not treated as collector bugs.
7. Use `stopped_reason` as the primary completion signal. Do not treat `coverage_complete: true` as complete website coverage.
8. Read `warnings[]` for sitemap fetch/skip notes. Those are not page capture failures.
9. Do not treat `limitations` as bugs in AI View.

The collector is importable:

```python
from agents.readability.human_view import capture_human_view
from agents.readability.site_crawler import crawl_site
```

Working directory should be the repo root so `out/` paths resolve consistently.

---

## Git information

- Branch: `feature/playwright-human-view`
- Do not commit or push to `main` from this workstream unless the team agrees
- Do not force-push
- Existing uncommitted checker / sample-website files on this branch belong to other work; do not discard them

---

## Development progress

### Completed

- Branch `feature/playwright-human-view` created without discarding existing uncommitted work
- Independent Python Human View Collector (Playwright Chromium)
- Homepage capture validated on https://omegax-hackathon.onrender.com/
- Thunderstrike 650 product-page capture validated (tabs, specs table, features, variants)
- Site crawler discovers internal URLs from rendered pages (no hardcoded catalogue)
- Full-site crawl captured 45 eligible HTML pages (0 capture failures)
- Primary vs related product classification on motorcycle detail pages
- JSON, full-page screenshot, rendered HTML, and site report written under `out/`
- Root `.gitignore` updated for Python / generated `out/` files
- README + this context file
- Structured facts v1.0, path-based page categories, derived enrich export, dashboard V2, 22 unit tests

### In progress

- None for this Human View structured-facts milestone

### Pending

- AI View comparison (other teammate)
- Optional: feed structured facts into the Node checker (do not mix into this module unless asked)
- Git commit / PR (only if requested; do not push to `main`)

### Known issues

- See testing limitations above
- Python 3.11 is not installed on the current laptop; ran with system Python 3.12.3
