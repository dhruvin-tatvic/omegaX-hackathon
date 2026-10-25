# Human View review dashboard (internal)

Temporary browser UI for inspecting existing `out/` crawl artifacts. It does not crawl and does not call Playwright.

## Open the dashboard

From the **repository root**:

```bash
python agents/readability/enrich_report.py --report out/site-human-view-20261025-061336.json
python agents/readability/review_dashboard/generate_manifest.py
python -m http.server 8000
```

Then open:

http://localhost:8000/agents/readability/review_dashboard/

The page must be served from the repo root so `out/` resolves as `../../../out/…`.
