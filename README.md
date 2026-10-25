# omegaX-hackathon

Repository for the **OmegaX / Tatvic PS6** hackathon: **Apex Moto** test site (AI-readability audit target) plus tooling for Render hosting and traffic monitoring.

**Team handoff:** [TEAM_CONTEXT.md](./TEAM_CONTEXT.md)  
**Local testing (Windows CMD tips):** [docs/LOCAL_TESTING.md](./docs/LOCAL_TESTING.md)  
**Render deploy:** [docs/render-deployment.md](./docs/render-deployment.md)

---

## Repository contents

| Path | Purpose |
|------|---------|
| [`sample-website/`](./sample-website) | **Apex Moto** — React + Vite, pre-rendered `dist/`, planted audit scenarios |
| [`tools/traffic-dashboard/`](./tools/traffic-dashboard) | **Local dashboard** — last 24h Render logs, human vs bot/AI traffic ([README](./tools/traffic-dashboard/README.md)) |
| [`docs/evidence/`](./docs/evidence) | Saved Render log exports & LLM access test notes |
| [`config/`](./config), [`data/`](./data) | Reference copies of scenario JSON and catalogue |

**Production hosting:** [Render](./docs/render-deployment.md) only — `sample-website/server.js` (`npm start`).

---

## Quick start — website (local)

**Windows CMD:** use `cd /d D:\...\sample-website` so `npm` runs in the project folder.

```bash
cd sample-website
npm install
npm run build
npm run preview
```

Open **http://localhost:4173** (pre-rendered, audit-like). Dev mode: `npm run dev` → **http://localhost:5173**.

On Render, build with:

`VITE_SITE_URL=$RENDER_EXTERNAL_URL npm run build`

---

## Quick start — traffic dashboard (bot vs human)

Requires a [Render API key](https://dashboard.render.com/u/settings#api-keys) and web service id (`srv-…`).

```bash
cd tools/traffic-dashboard
copy .env.example .env
# edit .env — RENDER_API_KEY, RENDER_SERVICE_ID (not usr-...)
npm install
npm start
```

Open **http://localhost:3456** · Status page: **http://localhost:3456/status.html**

If you see “Not configured”, stop old processes and run `restart-dashboard.cmd` in that folder, then `npm start` again.

Default window: **last 24 hours** (`LOG_WINDOW_HOURS`). Click **Refresh now** for a full sync from Render.

---

## Audit check script

```bash
cd sample-website
node scripts/check-site.mjs https://your-service.onrender.com
node scripts/check-site.mjs http://localhost:4173
```

---

## Docs index

- [TEAM_CONTEXT.md](./TEAM_CONTEXT.md) — architecture, planted problems, file map  
- [sample-website/README.md](./sample-website/README.md) — build pipeline & scenario table  
- [docs/LOCAL_TESTING.md](./docs/LOCAL_TESTING.md) — URLs, use cases, troubleshooting  
- [docs/render-deployment.md](./docs/render-deployment.md) — Render env vars & log export  
