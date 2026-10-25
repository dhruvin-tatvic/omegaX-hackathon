# Render traffic dashboard

Local UI that **pulls logs from the Render API**, classifies **human vs bot** traffic from Morgan access lines, and refreshes automatically.

## Setup

1. [Create a Render API key](https://dashboard.render.com/u/settings#api-keys)
2. Copy your web service ID (`srv-…` from the service URL)
3. Configure env:

```bash
cd tools/traffic-dashboard
cp .env.example .env
# edit .env — RENDER_API_KEY, RENDER_SERVICE_ID
npm install
npm start
```

4. Open **http://localhost:3456**

Optional: `TARGET_SITE_URL` in `.env` (shown in API metadata). Default view uses `LOG_WINDOW_HOURS` (see `.env.example`).

## How classification works

Parses Morgan access lines and classifies User-Agent as human, bot, or unknown.

## Security

- Run **on your machine only** — the API key must not be deployed publicly.
- The dashboard never sends your API key to the browser.

## API

- `GET /api/status` — connection + stats (used by the UI)
- `GET /api/stats` — counts + bot breakdown
- `GET /api/logs?filter=human|bot|all`
- `POST /api/refresh` — force pull from Render
- `GET /api/events` — SSE live updates
