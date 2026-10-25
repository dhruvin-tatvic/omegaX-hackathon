# Alternate ways to test (when Render returns 503)

LLMs fetch your URL **once**, with a **short timeout**. Render **free** services **sleep** when idle; wake-up often looks like **503** to the bot even when your site works in a browser later.

Use one or more of these approaches for hackathon / PS6 testing.

---

## Option 1 — Local site + public tunnel (best for live LLM tests)

Your machine serves the real built site; a tunnel gives a **stable public URL** while the tunnel runs (no Render sleep).

### Steps

```cmd
cd /d D:\Hackathon\omegaX-hackathon\sample-website
npm install
npm run build
npm run preview
```

Preview runs at **http://localhost:4173** (leave this window open).

**Second terminal** — expose it (pick one tool):

| Tool | Install | Command |
|------|---------|---------|
| [ngrok](https://ngrok.com/) | `ngrok config add-authtoken …` | `ngrok http 4173` |
| [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) | `cloudflared` | `cloudflared tunnel --url http://localhost:4173` |
| localtunnel | `npm i -g localtunnel` | `lt --port 4173` |

Copy the **https://….** URL from the tunnel output. Ask ChatGPT / Perplexity:

> “What is the ex-showroom price of Storm 200 on https://YOUR-TUNNEL-URL/motorcycles/storm-200 ?”

**Pros:** Same pre-rendered HTML as production audit; works immediately.  
**Cons:** URL changes each tunnel session (ngrok free); PC must stay on; `firewall_block` in `server.js` does **not** apply (use `npm start` on port 10000 + tunnel that port if you need Express/firewall).

### Express + tunnel (firewall / Morgan logs like Render)

```cmd
npm run build
npm start
```

Tunnel **port 10000** instead of 4173.

---

## Option 2 — Static host (always on, no 503 spin-down)

Deploy only the **`dist/`** folder to a static host. No Node process to sleep.

**Build:**

```cmd
cd sample-website
set VITE_SITE_URL=https://YOUR-STATIC-URL
npm run build
```

### Netlify (example)

1. Connect GitHub repo → site root **`sample-website`**
2. Build: `npm run build`  
3. Publish directory: **`dist`**
4. Env: `VITE_SITE_URL` = your Netlify URL (or use Netlify’s URL in build env)

`sample-website/netlify.toml` in this repo configures publish = `dist`.

### Cloudflare Pages

Same idea: build command `npm run build`, output directory `dist`, set `VITE_SITE_URL` to the Pages URL.

**Pros:** No cold start 503; good for LLM and `check-site.mjs`.  
**Cons:** No `server.js` — planted **`firewall_block`** and Express Morgan logs won’t run on the host (use Render or local Express for those).

---

## Option 3 — Keep Render but reduce 503

On [your Render service](https://dashboard.render.com/web/srv-dbe892a9lscs73a8o5vg):

1. **Health check path:** `/health`
2. **Root directory:** `sample-website`
3. **Build:** `npm install && VITE_SITE_URL=$RENDER_EXTERNAL_URL npm run build`
4. **Ping** `https://omegax-hackathon.onrender.com/health` every **10–14 min** ([UptimeRobot](https://uptimerobot.com) free tier), **or** upgrade to a **paid** plan (no spin-down).

Warm the site in a browser **before** asking an LLM.

---

## Option 4 — Test without any live LLM (audit script)

Simulates what GPTBot sees (no JavaScript):

```cmd
cd sample-website
npm run build
npm run preview
node scripts/check-site.mjs http://localhost:4173
```

Against Render (when it’s awake):

```cmd
node scripts/check-site.mjs https://omegax-hackathon.onrender.com
```

**Pros:** Repeatable; no ChatGPT account needed.  
**Cons:** Does not test “what ChatGPT answers,” only HTTP/HTML.

---

## Option 5 — Manual / copy-paste LLM test

1. Open a bike page locally: `http://localhost:4173/motorcycles/storm-200`
2. **View page source** (Ctrl+U) — copy the HTML snippet with `.price` / `.specs`
3. Paste into the LLM: “Given this HTML, what is the ex-showroom price?”

**Pros:** Zero hosting; good for debugging planted bugs (`js_only_content`, etc.).  
**Cons:** Not a real crawl test.

---

## Option 6 — Traffic dashboard without fixing Render 503

The dashboard reads **Render logs**, not live LLM answers. If bots sometimes get 503, you may still see **200** lines when they retry or when humans visit.

For **local** Morgan logs:

```cmd
set ACCESS_LOG_FILE=logs/access.log
npm start
```

Hit `http://localhost:10000` and use tunnel + LLM; parse logs locally (dashboard today is Render-API only).

---

## Recommended combo for your hackathon demo

| Goal | Use |
|------|-----|
| LLM can read the site live | **Tunnel + `npm run preview`** or **Netlify/Cloudflare Pages** |
| Bot vs human dashboard | Keep **Render** + dashboard `.env` (works when service is up) |
| Scoring / audit agent | **`check-site.mjs`** on `localhost:4173` or static URL |
| Planted `firewall_block` | **Render** or **local `npm start` + tunnel :10000** |

---

## Quick reference — your Render service

- **Service ID:** `srv-dbe892a9lscs73a8o5vg`
- **Likely public URL:** `https://omegax-hackathon.onrender.com` (confirm in Render dashboard)
- **Dashboard:** https://dashboard.render.com/web/srv-dbe892a9lscs73a8o5vg
