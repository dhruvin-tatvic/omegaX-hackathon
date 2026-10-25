# AI Answer Testing (checker)

Evaluate AI answers against **website-sourced evidence** crawled from a URL you choose. The Apex Moto site in `sample-website/` is an independent target and is not modified by this app.

## Workflow

1. Enter a public `http://` or `https://` URL (default `https://omegax-hackathon.onrender.com/`).
2. Click **Crawl website**.
3. Review pages visited, failures, and extracted facts.
4. Type any question.
5. Paste an AI answer (or use **Ask API model** if `OPENAI_API_KEY` is set).
6. Click **Evaluate answer**.
7. Optionally click **Run Readability Test** (`POST /api/readability`) to compare raw HTTP HTML with a local Chrome render and inspect robots blocks, HTTP errors, PDF/image links, missing JSON-LD, and conflicting prices.
8. Optionally use **AI Traffic Lens** to paste JSONL/CSV access logs or load the labelled `SYNTHETIC DEMO DATA` fixture (`GET /api/traffic/demo`, `POST /api/traffic/analyze`). GA4 is a separate import seam (`GET/POST /api/traffic/ga4`) and stays `not_connected` until an export is provided.
9. After tests run, review **Ranked recommendations** (`POST /api/recommendations`). Items are proposed only; they are not applied to the website. Benefits are labelled estimates.
10. Optionally use **Apply → Retest → Rollback** on the labelled **LOCAL DEMO FIXTURE** copies (`GET /api/apply-demo`, `POST /api/apply-demo/:id/apply|retest|rollback`). Patches never touch the live website. `verified_improved` is local fixture evidence only.
11. Build the **Apex question-set scorecard** (`GET/POST /api/scorecard`, `GET /api/scorecard.csv`). Missing assistant answers are **Not observed**. Then build a **4–8 week monitoring plan** (`GET/POST /api/monitoring-plan`). GA4 stays `not_connected` until a real export exists; synthetic logs stay labelled.

Extracted HTML is labelled **website-sourced evidence**, not independently verified truth. Reference values are not sent in the model prompt. Readability findings include evidence and limitations; JS-shell hints are labelled as heuristics.

Pack-based scoring (`POST /api/runs`) still exists. Default pack is Acme Pump (`CHECKER_PACK=demo`). Set `CHECKER_PACK=apex` to score against `data/reference/apex.json` and `data/questions/apex.json`. The UI crawl flow uses `POST /api/evaluate` and is separate.

## Setup

```bash
cd checker
cp .env.example .env
npm install
npm test
npm run dev
```

- UI: http://localhost:5174
- API: http://localhost:8787

## Result categories

| Category | Meaning |
| --- | --- |
| Correct | Checkable claims match crawled website text |
| Partially correct | Mix of matches and gaps or contradictions |
| Incorrect | Claims conflict with crawled website text |
| Unsupported / unverified | Website was crawled but does not mention the claim (not treated as false) |
| Insufficient evidence | Crawl found nothing relevant to the question |
| Inconclusive | Collection failed, or pages disagree |

## Deferred

Headless browser rendering (JS-only pages are detected and reported, not executed). PDF/image OCR.
