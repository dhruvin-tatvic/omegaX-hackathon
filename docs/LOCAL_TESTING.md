# Local testing guide (Windows)

URLs like `http://localhost:3456` **do nothing until you start the server** in a terminal and **leave that terminal open**.

---

## Quick start (two terminals)

**Windows CMD:** use `cd /d D:\...` so npm runs in the project folder (not `C:\Users\You`).

### Terminal 1 — Apex Moto website (preview)

```powershell
cd D:\Hackathon\omegaX-hackathon\sample-website
npm install
npm run preview
```

Open: **http://localhost:4173**

(First time only, if preview fails: `npm run build` then `npm run preview` again.)

### Terminal 2 — Bot vs human dashboard

```powershell
cd D:\Hackathon\omegaX-hackathon\tools\traffic-dashboard
npm install
copy .env.example .env
```

Edit `.env` and set:

- `RENDER_API_KEY` (from Render → Account → API Keys)
- `RENDER_SERVICE_ID` — **must start with `srv-`** (web service). **`usr-` is your user id, not a service.**

  Render dashboard → **Apex Moto web service** → URL looks like  
  `https://dashboard.render.com/web/srv-xxxxxxxxxxxxxxxxxxxx`  
  Copy the **`srv-…`** part into `.env`.

Then:

```powershell
npm start
```

Open: **http://localhost:3456**

Without `.env`, the dashboard **page** still loads but shows a red banner and **no live Render data**.

After editing `.env`, **stop the dashboard (Ctrl+C) and run `npm start` again** — the server only reads `.env` at startup.

---

## All local URLs (what each is for)

| URL | Start command | Folder | Purpose |
|-----|---------------|--------|---------|
| http://localhost:4173 | `npm run preview` | `sample-website` | Production-like static site (best for audit testing) |
| http://localhost:5173 | `npm run dev` | `sample-website` | Developer mode (hot reload; some planted bugs differ) |
| http://localhost:10000 | `npm start` | `sample-website` | Same as Render (`node server.js`) |
| http://localhost:3456 | `npm start` | `tools/traffic-dashboard` | **Human vs AI bot traffic** from Render logs |

If the browser says “can’t connect”, the matching command is **not running**.

---

## Use case 1 — Browse the motorcycle site locally

1. Terminal: `sample-website` → `npm run preview`
2. Open http://localhost:4173
3. Click **Motorcycles**, open a model, check prices/specs tables
4. Optional audit script:

```powershell
cd D:\Hackathon\omegaX-hackathon\sample-website
node scripts/check-site.mjs http://localhost:4173
```

---

## Use case 2 — Match Render production locally

1. `npm run build` in `sample-website` (set `VITE_SITE_URL` to your Render URL if needed)
2. `npm start` → http://localhost:10000
3. Same UI as Render; firewall rules from `server.js` apply

---

## Use case 3 — Human vs bot traffic dashboard

**Goal:** See traffic split without opening Render logs.

1. Configure `tools/traffic-dashboard/.env` (API key + service id)
2. `npm start` → http://localhost:3456
3. **Test human traffic:** browse your **live Render URL** in Chrome (not localhost)
4. Wait ~8–15 s or click **Refresh now** — **Human** count should rise
5. **Test bot traffic:** ask ChatGPT/Perplexity a question that uses your Render site URL
6. Filter tabs: **Bot** — look for `ChatGPT-User`, `ExaUser`, etc.

---

## Use case 4 — Planted audit problems (practice scenario)

1. `npm run build` (default `practice` scenario)
2. `npm run preview` → http://localhost:4173
3. Examples:
   - http://localhost:4173/motorcycles/storm-200 — JS-only price (view page source vs browser)
   - http://localhost:4173/dealers — in robots for GPTBot (check `robots.txt` after build)

---

## LLM says “503” when users ask about your site

See [render-deployment.md](./render-deployment.md#fix-503-service-unavailable-especially-when-llms-fetch-your-site). Most often: **Render free tier asleep** or **build not run** on deploy (`dist/` missing).

**Alternate testing (tunnel, static host, no LLM):** [ALTERNATE_TESTING.md](./ALTERNATE_TESTING.md) · script: `scripts/tunnel-preview.ps1`

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Connection refused | Start the server; keep the terminal open |
| Port in use | Close other terminal or change `DASHBOARD_PORT` in dashboard `.env` |
| Dashboard empty | Add `RENDER_API_KEY` + `RENDER_SERVICE_ID` to `.env`, restart |
| 4173 blank / error | Run `npm run build` in `sample-website` first |
| Wrong site on 5173 vs 4173 | Use **4173** for pre-rendered audit HTML; **5173** is dev-only |

Try **127.0.0.1** instead of **localhost** if DNS is odd: http://127.0.0.1:3456
