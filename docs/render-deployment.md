# Apex Moto on Render (primary hosting)

This team uses **Render** only (`sample-website/server.js` + pre-rendered `dist/`). Ignore Vercel URLs and `middleware.ts` / `api/` for production behavior on Render.

## Render web service

| Setting | Value |
|---------|--------|
| **Build command** | `npm install && VITE_SITE_URL=$RENDER_EXTERNAL_URL npm run build` |
| **Start command** | `npm start` (runs `node server.js`) |
| **Env** | `VITE_SCENARIO` = `practice` or `dryrun` (optional) |
| **Public URL** | Render dashboard → your service → URL (`*.onrender.com`) |

`RENDER_EXTERNAL_URL` is set automatically by Render; passing it into the build keeps `sitemap.xml`, `robots.txt`, canonicals, and JSON-LD aligned with the live host.

**Root directory:** must be `sample-website` (not the repo root), unless you change paths.

**Health check:** in Render → Settings → set **Health Check Path** to `/health` (returns `200 OK`).

---

## Fix: “503 Service Unavailable” (especially when LLMs fetch your site)

Your Express app does **not** intentionally return 503 for normal pages. A **503** usually means **Render’s edge** could not get a healthy response from your app.

| Cause | What happens | Fix |
|--------|----------------|-----|
| **Free tier asleep** | Service spins down after ~15 min idle. First request (e.g. ChatGPT/Perplexity fetch) wakes it; slow wake-up or LLM timeout → user sees **503** | Use **paid** instance, or ping `/health` every 10–14 min (UptimeRobot, cron-job.org, etc.) |
| **Wrong Root Directory** | `npm start` runs without `dist/` → app serves 503 with build hint | Render → **Root Directory** = `sample-website` |
| **Missing build step** | `dist/` not created on deploy (`dist` is gitignored) | **Build command** must include `npm run build` (see table above) |
| **Failed deploy** | Process crashed on boot | Render → **Logs** → fix error, **Manual Deploy** |
| **403 (not 503)** | `firewall_block` in practice scenario blocks some bots on `/finance` | Expected for PS6; LLMs asking about finance may hit **403** on that path |

### Quick checks

1. Open your `https://….onrender.com/health` in a browser → should show `OK`.
2. Open the homepage → should load HTML (may take **30–60s** first time on free tier).
3. Render dashboard → service **not** “Suspended” / deploy **Live**.

### After changing settings

Trigger **Clear build cache & deploy** once if builds looked wrong.

---

## Storing Render logs locally

Render keeps logs in the cloud; you **copy them to your machine** for evidence (e.g. `docs/evidence/`).

### Option A — Dashboard (what you did)

1. Render → Service → **Logs**
2. Copy or export → save as `docs/evidence/render-logs-YYYY-MM-DD.txt` (or PDF)

### Option B — Render CLI (repeatable)

```bash
npm i -g @render/cli
render login
# Service ID from dashboard URL (srv-...)
npm run logs:save --prefix sample-website -- <service-id>
```

Writes under `docs/evidence/render-logs-<date>.txt`.

### Option C — Local Express file log (dev / self-host only)

When running `node server.js` on your PC:

```bash
set ACCESS_LOG_FILE=logs/access.log
npm start
```

`logs/` is gitignored; copy important snippets into `docs/evidence/` when you need to commit them.

**Note:** On Render’s servers the filesystem is ephemeral—file logs there are not durable. Use stdout (default morgan → Render log stream) plus Options A or B for local archives.

## Live traffic dashboard (recommended)

Automatic bot vs human split — no manual copy/paste:

```bash
cd tools/traffic-dashboard
cp .env.example .env   # RENDER_API_KEY + RENDER_SERVICE_ID
npm install
npm start
```

Open **http://localhost:3456**. See [tools/traffic-dashboard/README.md](../tools/traffic-dashboard/README.md).
