# LLM access test — Render deployment (2026-10-25)

## Setup

- **Host:** Render (Express `node server.js`, static `dist/`)
- **Prompt:** Same question posed to ChatGPT, Perplexity, and Gemini about the site
- **Observation:** ChatGPT and Perplexity could answer; Gemini reported it could not access the website

## Log conclusion (confirmed)

The Render logs are **consistent with that observation**:

| Visitor | IP | Path | Status | User-Agent |
|---------|-----|------|--------|------------|
| Human / browser | `14.102.161.74` | `/`, assets | 200 / 304 | Chrome (Windows & Linux) |
| **OpenAI browse** | `9.205.25.138` | `/` | **200** | `ChatGPT-User/1.0` |
| **Exa crawler** | `31.58.151.131` | `/` | **200** | `ExaUser/1.0` (used by several AI search stacks) |
| **Exa crawler** | `31.58.151.132` | `/robots.txt` | **200** | `ExaUser/1.0` |
| **Google / Gemini** | — | — | — | **No requests** in this log export |

So for this test window, the site **did not block** ChatGPT or Exa at the HTTP layer (all **200**). Gemini (or `Googlebot` / `Google-Extended` / similar) **never hit this Render URL**, which explains why Gemini could not use live page content—absence of traffic, not a 403 from your app.

## Not a `robots.txt` block on Google

Practice `robots.txt` only disallows `/account` and `/login` for `*`, and `/dealers` for `GPTBot` / `OAI-SearchBot`. There is **no** rule blocking Google crawlers on `/`.

Production uses **Render + `server.js`** only (includes `firewall_block` from scenario JSON).

## Caveats

1. **Perplexity** may not always send `PerplexityBot`; retrieval can go through partners (e.g. Exa)—the Exa lines likely correspond to Perplexity’s fetch path.
2. **Gemini** may answer from Google Search index, training, or a separate browse tool; if it does not fetch your URL, you will see **no log line**.
3. Logs are a **snapshot**—store dated exports under `docs/evidence/` when you rerun tests (`npm run logs:save` or dashboard copy).

## Raw log

[render-llm-access-logs-2026-10-25.txt](./render-llm-access-logs-2026-10-25.txt)
