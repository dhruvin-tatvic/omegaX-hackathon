# Structured facts schema (v1.0)

Derived from saved rendered HTML. Original `out/human-view-*.json` files are not rewritten.

## Report

`out/derived/site-human-view-structured-<stamp>.json`

| Field | Meaning |
| --- | --- |
| `schema_version` | Currently `1.0` |
| `derived_from` | Original site crawl report |
| `page_type_counts` | Captured pages only |
| `pages[].page_type` | Path category |
| `pages[].page_type_reason` | Why that category was chosen |
| `pages[].canonical_path` / `canonical_url` | Identity without trailing slash or query |
| `pages[].query` | Query string kept separately so `?bike=` variants stay distinct captures |
| `pages[].structured_facts` | Entity + fact layer |
| `pages[].json_path` / `screenshot_path` / `rendered_html_path` | Original artifacts |

Per-page export: `out/derived/pages/<slug>.json`.

## Fact object

```json
{
  "id": "fact:1",
  "entity_id": "product:thunderstrike-650",
  "entity_name": "Thunderstrike 650",
  "entity_type": "product",
  "fact_type": "ex_showroom_price",
  "value": 420000,
  "value_text": "₹4,20,000",
  "unit": "INR",
  "currency": "INR",
  "qualifier": {"label": "onwards (ex-showroom)"},
  "evidence": "Thunderstrike 650 ₹4,20,000 onwards (ex-showroom)",
  "source_url": "https://omegax-hackathon.onrender.com/motorcycles/thunderstrike-650/",
  "extraction_method": "html.css:.moto-detail__price",
  "status": "verified"
}
```

`status` is `verified` when a typed container (card, table header, labelled benefit) supports the association, otherwise `ambiguous`.

Product names and prices from the raw arrays are never zipped by index. Discounts are never calculated.

## Limitations

- Only semantic HTML on the saved snapshot is used. Closed widgets without markup, PDFs, and images are out of scope.
- The live finance page snapshot contains 17 bike cards; Nightfall 650 is absent there and is not invented.
- `/account` and `/login` remain skipped (`robots.txt`), not captured.
- JSON-LD prices are used only when HTML did not already supply the same product price.
