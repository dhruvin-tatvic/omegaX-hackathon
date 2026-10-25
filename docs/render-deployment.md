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
