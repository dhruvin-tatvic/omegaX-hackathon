# Render traffic dashboard

Local UI that **pulls logs from the Render API** (no copy/paste), classifies **human vs bot** traffic from Morgan access lines, and refreshes automatically.

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

| Page | URL |
|------|-----|
| Traffic overview | http://localhost:3456/ |
| **AI crawlers & fetch detail** | http://localhost:3456/ai-crawlers.html |
| Connection status | http://localhost:3456/status.html |

The AI crawlers page groups bot traffic by provider (OpenAI, Perplexity, Exa, etc.), lists **which URLs** each crawler fetched, and recent hits. Chat **prompts are not in HTTP logs** — only User-Agent + path + time.

Default view: **last 24 hours** of Render app logs (paginated on startup and when you click **Refresh now**). Optional env: `LOG_WINDOW_HOURS=24`.

`RENDER_OWNER_ID` is optional; the server tries to auto-detect your workspace.

## How classification works

Parses lines like:

`14.102.161.74 - GET / 200 - "Mozilla/5.0 …"`

| Kind | Examples |
|------|----------|
| **Bot** | ChatGPT-User, GPTBot, ExaUser, PerplexityBot, Googlebot, `*bot*` / `crawler` |
| **Human** | Normal Chrome / Firefox / Safari user agents |
| **Unknown** | Everything else |

## Security

- Run **on your machine only** — the API key must not be deployed publicly.
- The dashboard never sends your API key to the browser.

## API (optional)

- `GET /api/stats` — counts + bot breakdown  
- `GET /api/logs?filter=human|bot|all`  
- `POST /api/refresh` — force pull from Render  
- `GET /api/events` — SSE live updates  
