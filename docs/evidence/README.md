# Test evidence

Artifacts from manual LLM / crawler experiments against deployed Apex Moto instances.

| File | What it shows |
|------|----------------|
| [render-llm-access-logs-2026-10-25.txt](./render-llm-access-logs-2026-10-25.txt) | Render `server.js` access log: ChatGPT-User and ExaUser reached `/` (200); no Google/Gemini bot traffic in this window |

See [llm-access-test-2026-10-25.md](./llm-access-test-2026-10-25.md) for interpretation.

**Saving new logs:** [render-deployment.md](../render-deployment.md) — dashboard export or `npm run logs:save` from `sample-website/`.
