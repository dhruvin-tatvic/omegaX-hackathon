# Human View Collector (Agent 2 — Readability)

Captures what a **human visitor can read** after a page is fully rendered in Chromium.

This module does not crawl extra domains, does not submit forms, and does not depend on the JavaScript checker.

## Purpose

Render pages with Playwright, extract visible text and structure, then save:

- JSON under `out/`
- Full-page screenshot under `out/screenshots/`
- Rendered HTML (`page.content()`) under `out/rendered_html/`
- For a full-site run: a consolidated report `out/site-human-view-<timestamp>.json`

## Prerequisites

- Python 3.11+ (3.11 preferred; 3.12 works)
- Network access to the target URL (default: the deployed Apex Moto demo site)

## Installation

From the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r agents/readability/requirements.txt
python -m playwright install chromium
```

## Single-page collection

Default URL comes from `agents/readability/config.json`.

```bash
python agents/readability/human_view.py --url https://omegax-hackathon.onrender.com/
python agents/readability/human_view.py --url https://omegax-hackathon.onrender.com/motorcycles/thunderstrike-650
```

Or rely on the configured default:

```bash
python agents/readability/human_view.py
```

Optional flags:

```bash
python agents/readability/human_view.py --url https://omegax-hackathon.onrender.com/ --config agents/readability/config.json --output-dir out
```

## Full-site collection

The crawler starts at the homepage you provide. It discovers **internal links from rendered pages**, plus same-host URLs from `{origin}/sitemap.xml` and any same-host `Sitemap:` listed in `robots.txt`. Off-host sitemap documents (for example a stale Vercel URL) are skipped. There is no hardcoded catalogue of motorcycle URLs.

```bash
python agents/readability/site_crawler.py --url https://omegax-hackathon.onrender.com/
```

Safety limits (defaults in `config.json`, override on the CLI):

```bash
python agents/readability/site_crawler.py --url https://omegax-hackathon.onrender.com/ --max-pages 100 --max-depth 5
```

A small discovery test:

```bash
python agents/readability/site_crawler.py --url https://omegax-hackathon.onrender.com/ --max-pages 5 --max-depth 5
```

## Structured facts (no recrawl)

Normalize the saved crawl into entity-based facts and page categories. Original capture JSON is left untouched.

```bash
python agents/readability/enrich_report.py --report out/site-human-view-20261025-061336.json
python -m unittest discover -s agents/readability -t agents/readability -v
```

Schema: `agents/readability/STRUCTURED_FACTS.md`. Derived report: `out/derived/site-human-view-structured-20261025-061336.json`.

## Consolidated crawl JSON

Embeds the site report, per-page capture JSON, rendered HTML, screenshots (base64), and dashboard structured facts into one file. Does not recrawl.

```bash
python3 agents/readability/consolidate_report.py --report out/site-human-view-20261025-061336.json --output out/playwright-crawl-complete.json
```

Future `site_crawler.py` runs write `playwright-crawl-complete-<stamp>.json` (and `playwright-crawl-complete.json`) next to that crawl’s site report.

## Internal review dashboard

A static HTML viewer for existing `out/` reports (does not crawl):

```bash
python agents/readability/review_dashboard/generate_manifest.py
python -m http.server 8000
```

Open http://localhost:8000/agents/readability/review_dashboard/

`--max-pages` and `--max-depth` are safety controls, not assumptions about how large the site is. **`stopped_reason` is the primary completion signal** (`queue_exhausted`, `page_limit`, `max_depth`, or `invalid_start_url`). `coverage_complete` is only a convenience flag: queue emptied and every captured page succeeded. It does **not** mean the entire website was covered.

## How URL discovery works

1. Read `robots.txt` (restrictions still apply to every queued path).
2. Fetch same-host sitemap documents only. Skip external `Sitemap:` URLs (`external_sitemap` in `skipped`, plus a `warnings` entry). Also try `{origin}/sitemap.xml`.
3. Enqueue only same-host `<loc>` values; external locs are skipped, not crawled.
4. Capture the start URL with `capture_human_view()`, then follow `content.links`.
5. Keep http(s) links on the same host; drop fragments; strip trailing slashes except `/`.
6. Keep query parameters that identify different pages (for example `?bike=...`). Drop tracking parameters (`utm_*`, `gclid`, `fbclid`).
7. Skip `mailto:`, `tel:`, `javascript:`, logout paths, and binary assets (`.pdf`, images, archives).
8. Recurse until the queue is empty or a safety limit is hit.
9. A failure on one page is recorded; the rest of the crawl continues. Sitemap fetch problems are `warnings`, not page-capture failures.

Tab clicks are **not** treated as extra URLs. Features / Specs / Variants stay inside one page capture.

## Output locations

| Artifact | Path |
| --- | --- |
| Per-page JSON | `out/human-view-<timestamp>.json` |
| Screenshot | `out/screenshots/<page-slug>-<timestamp>.png` |
| Rendered HTML | `out/rendered_html/<page-slug>-<timestamp>.html` |
| Site report | `out/site-human-view-<timestamp>.json` |

## Example JSON structure

```json
{
  "url": "https://omegax-hackathon.onrender.com/",
  "final_url": "https://omegax-hackathon.onrender.com/",
  "captured_at": "2026-10-25T10:00:00Z",
  "capture_method": "playwright_chromium",
  "viewport": { "width": 1366, "height": 768 },
  "page_title": "Apex Moto — Born to Ride. Built to Last.",
  "status": "success",
  "errors": [],
  "screenshot_path": "out/screenshots/homepage-20261025-100000.png",
  "rendered_html_path": "out/rendered_html/homepage-20261025-100000.html",
  "content": {
    "headings": [{ "level": 1, "text": "Born to Ride. Built to Last." }],
    "visible_text": "...",
    "product_names": [],
    "prices": [],
    "product_descriptions": [],
    "specifications": [],
    "links": [],
    "images": [],
    "tables": [],
    "primary_product": null,
    "related_products": []
  }
}
```

On motorcycle **detail** pages, `primary_product` is filled from the H1 plus visible ex-showroom price, specs, features, and variants. Related cards become `related_products`. Existing fields stay as they were.

Reusable API:

```python
from agents.readability.human_view import capture_human_view
from agents.readability.site_crawler import crawl_site

result = capture_human_view("https://omegax-hackathon.onrender.com/")
report = crawl_site("https://omegax-hackathon.onrender.com/", max_pages=100, max_depth=5)
```

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| `Playwright is not installed` | Activate the venv and `pip install -r agents/readability/requirements.txt` |
| Browser launch failed / missing Chromium | `python -m playwright install chromium` |
| Navigation timeout | Render free-tier sites can be cold. Re-run; increase `timeouts.navigation_ms` in `config.json` |
| `status: partial` | Read `errors` in the JSON. Extraction ran but a wait, screenshot, or empty-field check failed |
| Empty `visible_text` | Confirm the URL loads in a desktop browser. Check `out/rendered_html/` for a JS shell |
| Crawl stopped early | Check `stopped_reason` in the site report (`page_limit`, `max_depth`, `queue_exhausted`) |
| Permission / file write errors | Ensure the process can create `out/` at the repo root |

## Limits (intentional)

- Internal pages only (same host as the start URL)
- No form submits, bookings, or purchases
- No OCR of text that exists only inside images
- PDFs and other binary assets are skipped, not downloaded
- `robots.txt` blocked paths are skipped
- Closed accordions that are not `role=tab` are not opened
- Screenshot filenames use the URL path, not query strings (timestamps still make files unique)
