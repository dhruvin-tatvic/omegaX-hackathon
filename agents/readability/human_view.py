#!/usr/bin/env python3
"""Playwright Human View Collector (OmegaX Agent 2 — Readability).

Captures what a human can read after Chromium renders a page.
Does not crawl additional URLs. Does not submit forms or follow purchase CTAs.
May click in-page ``role=tab`` controls so hidden tab panels become readable.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

MODULE_DIR = Path(__file__).resolve().parent
REPO_ROOT = MODULE_DIR.parents[1]
DEFAULT_CONFIG_PATH = MODULE_DIR / "config.json"

if __package__ in {None, ""}:
    if str(MODULE_DIR) not in sys.path:
        sys.path.insert(0, str(MODULE_DIR))
    from product_classify import attach_classification
else:
    from .product_classify import attach_classification

EXTRACT_PAGE_JS = r"""
() => {
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE", "NOSCRIPT", "HEAD", "META", "LINK"]);
  const PRICE_RE = /(?:₹|Rs\.?\s*|INR\s*|USD\s*|€|£)\s*[\d,]+(?:\.\d+)?/gi;

  function classNameOf(el) {
    if (!el || !el.className) return "";
    return typeof el.className === "string" ? el.className : String(el.className);
  }

  function isSkippedTag(el) {
    return !el || el.nodeType !== 1 || SKIP_TAGS.has(el.tagName);
  }

  function hasAriaHiddenAncestor(el) {
    let node = el;
    while (node && node.nodeType === 1) {
      if (node.getAttribute && node.getAttribute("aria-hidden") === "true") return true;
      node = node.parentElement;
    }
    return false;
  }

  function isCssHidden(el) {
    if (!el || el.nodeType !== 1) return true;
    if (el.hasAttribute("hidden")) return true;
    const style = window.getComputedStyle(el);
    if (!style) return true;
    if (style.display === "none" || style.visibility === "hidden") return true;
    if (style.contentVisibility === "hidden") return true;
    if (parseFloat(style.opacity) === 0) return true;
    return false;
  }

  function isLayoutVisible(el) {
    if (isSkippedTag(el) || isCssHidden(el)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) return false;
    return true;
  }

  function isHumanReadable(el) {
    return isLayoutVisible(el) && !hasAriaHiddenAncestor(el);
  }

  function collapse(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function collectVisibleText(root) {
    const parts = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || isSkippedTag(parent) || !isHumanReadable(parent)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!collapse(node.textContent)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let current;
    while ((current = walker.nextNode())) {
      parts.push(collapse(current.textContent));
    }
    return parts.join(" ");
  }

  const headings = [];
  document.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach((el) => {
    if (!isHumanReadable(el)) return;
    const text = collapse(el.innerText);
    if (!text) return;
    headings.push({ level: Number(el.tagName.slice(1)), text });
  });

  const links = [];
  const seenLinks = new Set();
  document.querySelectorAll("a[href]").forEach((el) => {
    if (!isHumanReadable(el)) return;
    const href = el.href || el.getAttribute("href") || "";
    const text = collapse(el.innerText);
    const key = href + "|" + text;
    if (!href || seenLinks.has(key)) return;
    seenLinks.add(key);
    links.push({ text, href });
  });

  const images = [];
  const seenImages = new Set();
  function pushImage(src, alt, extra) {
    const key = (src || "") + "|" + (alt || "");
    if (!src || seenImages.has(key)) return;
    seenImages.add(key);
    const item = { src, alt: alt || "" };
    if (extra) Object.assign(item, extra);
    images.push(item);
  }
  document.querySelectorAll("img").forEach((el) => {
    if (!isLayoutVisible(el)) return;
    pushImage(el.currentSrc || el.src || el.getAttribute("src") || "", el.getAttribute("alt") || "");
  });
  document.querySelectorAll("[role='img']").forEach((el) => {
    if (!isLayoutVisible(el)) return;
    const style = window.getComputedStyle(el);
    let src = el.getAttribute("src") || "";
    const bg = style.backgroundImage || "";
    const match = bg.match(/url\(["']?(.*?)["']?\)/);
    if (!src && match) src = match[1];
    const alt = el.getAttribute("aria-label") || el.getAttribute("alt") || "";
    pushImage(src, alt, { role: "img" });
  });

  const tables = [];
  document.querySelectorAll("table").forEach((table) => {
    if (!isHumanReadable(table)) return;
    const captionEl = table.querySelector("caption");
    const headerCells = table.querySelectorAll("thead th");
    const headers = Array.from(headerCells.length ? headerCells : table.querySelectorAll("tr:first-child th")).map(
      (cell) => collapse(cell.innerText)
    );
    const rows = [];
    table.querySelectorAll("tr").forEach((tr) => {
      const cells = Array.from(tr.querySelectorAll("th,td")).map((cell) => collapse(cell.innerText));
      if (!cells.some((cell) => cell)) return;
      if (headers.length && cells.join("|") === headers.join("|")) return;
      rows.push(cells);
    });
    tables.push({
      caption: captionEl ? collapse(captionEl.innerText) : "",
      headers,
      rows,
    });
  });

  const productNames = [];
  const productDescriptions = [];
  const specifications = [];
  const seenNames = new Set();
  const seenSpecs = new Set();

  function classTokens(el) {
    try {
      return Array.from(el.classList || []);
    } catch (err) {
      return classNameOf(el).split(/\s+/).filter(Boolean);
    }
  }

  function looksLikeProductContainer(el) {
    if (!el || el === document.body) return false;
    const tokens = classTokens(el);
    const blocks = [
      "product-card",
      "product_card",
      "product-tile",
      "product-item",
      "motorcycle-card",
      "bike-card",
      "model-card",
      "catalogue-card",
      "catalog-item",
    ];
    if (tokens.some((token) => blocks.some((block) => token === block || token.startsWith(block + "--")))) {
      return true;
    }
    if (el.tagName === "ARTICLE" && tokens.some((token) => /product|motorcycle|bike|model/i.test(token) && !token.includes("__"))) {
      return true;
    }
    return false;
  }

  function containerHasPrice(el) {
    if (!el) return false;
    PRICE_RE.lastIndex = 0;
    const ok = PRICE_RE.test(el.innerText || "");
    PRICE_RE.lastIndex = 0;
    return ok;
  }

  function closestProductContainer(el) {
    let node = el.parentElement;
    while (node && node !== document.body) {
      if (looksLikeProductContainer(node)) return node;
      node = node.parentElement;
    }
    return null;
  }

  function pageProductName() {
    const h1 = document.querySelector("h1");
    if (!h1 || !isHumanReadable(h1) || inChrome(h1)) return "";
    return collapse(h1.innerText);
  }

  function productTitleOf(container) {
    if (!container) return pageProductName();
    const titleEl = container.querySelector(
      "h1,h2,h3,h4,[class*='product'][class*='name'],[class*='product-title']"
    );
    const named = titleEl ? collapse(titleEl.innerText) : "";
    return named || pageProductName();
  }

  function inChrome(el) {
    return Boolean(el.closest("nav, header, footer"));
  }

  function addProduct(el, container) {
    const text = collapse(el.innerText);
    if (!text || text.length > 80) return;
    if (seenNames.has(text.toLowerCase())) return;
    seenNames.add(text.toLowerCase());
    productNames.push(text);
    const scope = container || el.parentElement || document.body;
    const descCandidates = scope.querySelectorAll("p, [class*='tagline'], [class*='description']");
    for (const para of descCandidates) {
      if (!isHumanReadable(para) || inChrome(para)) continue;
      const desc = collapse(para.innerText);
      PRICE_RE.lastIndex = 0;
      if (!desc || desc === text || PRICE_RE.test(desc)) continue;
      PRICE_RE.lastIndex = 0;
      if (desc.length > 280) continue;
      productDescriptions.push({ product: text, text: desc });
      break;
    }
  }

  document.querySelectorAll("h1").forEach((el) => {
    if (!isHumanReadable(el) || inChrome(el)) return;
    const scope = el.closest("section, article") || el.parentElement;
    if (!containerHasPrice(scope)) return;
    addProduct(el, scope);
  });

  document.querySelectorAll("h2,h3,h4,[class*='product'][class*='name'],[class*='product-title'],[itemprop='name']").forEach((el) => {
    if (!isHumanReadable(el) || inChrome(el) || el.tagName === "H1") return;
    const container = closestProductContainer(el);
    if (!container || !containerHasPrice(container)) return;
    addProduct(el, container);
  });

  document.querySelectorAll("dl").forEach((dl) => {
    if (!isHumanReadable(dl) || inChrome(dl)) return;
    const product = productTitleOf(closestProductContainer(dl));
    const dts = Array.from(dl.querySelectorAll("dt"));
    dts.forEach((dt) => {
      const dd = dt.nextElementSibling;
      if (!dd || dd.tagName !== "DD") return;
      if (!isHumanReadable(dt) || !isHumanReadable(dd)) return;
      const label = collapse(dt.innerText);
      const value = collapse(dd.innerText);
      const key = product + "|" + label + "|" + value;
      if (!label || !value || seenSpecs.has(key)) return;
      seenSpecs.add(key);
      specifications.push({ label, value, product: product || undefined });
    });
  });

  tables.forEach((table) => {
    const headers = table.headers || [];
    const width = Math.max(headers.length, ...table.rows.map((row) => row.length), 0);
    if (width !== 2) return;
    table.rows.forEach((row) => {
      if (row.length !== 2) return;
      if (headers.length === 2 && row.join("|") === headers.join("|")) return;
      const label = row[0];
      const value = row[1];
      const key = label + "|" + value;
      if (label && value && !seenSpecs.has(key)) {
        seenSpecs.add(key);
        specifications.push({ label, value, source: "table" });
      }
    });
  });

  document.querySelectorAll("[class*='spec']").forEach((el) => {
    if (!isHumanReadable(el) || inChrome(el)) return;
    const labelEl = el.querySelector("[class*='label']");
    const valueEl = el.querySelector("[class*='value']");
    if (!labelEl || !valueEl) return;
    let nestedPairs = 0;
    Array.from(el.children || []).forEach((child) => {
      if (child.querySelector("[class*='label']") && child.querySelector("[class*='value']")) nestedPairs += 1;
    });
    if (nestedPairs >= 2) return;
    const container = closestProductContainer(el);
    const product = productTitleOf(container);
    if (labelEl && valueEl && isHumanReadable(labelEl) && isHumanReadable(valueEl)) {
      const label = collapse(labelEl.innerText);
      const value = collapse(valueEl.innerText);
      const key = product + "|" + label + "|" + value;
      if (label && value && value !== "—" && !seenSpecs.has(key)) {
        seenSpecs.add(key);
        specifications.push({ label, value, product: product || undefined });
      }
    }
  });

  const visible_text = collectVisibleText(document.body || document.documentElement);
  const prices = [];
  const seenPrices = new Set();
  const priceMatches = visible_text.match(PRICE_RE) || [];
  priceMatches.forEach((raw) => {
    const value = collapse(raw);
    if (!value || seenPrices.has(value)) return;
    seenPrices.add(value);
    prices.push(value);
  });
  document.querySelectorAll("[itemprop='price']").forEach((el) => {
    if (!isHumanReadable(el)) return;
    const value = collapse(el.innerText);
    PRICE_RE.lastIndex = 0;
    if (!value || seenPrices.has(value)) return;
    if (!PRICE_RE.test(value) && !/[\d,]/.test(value)) return;
    PRICE_RE.lastIndex = 0;
    seenPrices.add(value);
    prices.push(value);
  });
  Array.from(document.querySelectorAll("*")).forEach((el) => {
    if (!classTokens(el).includes("price") || !isHumanReadable(el)) return;
    const value = collapse(el.innerText);
    PRICE_RE.lastIndex = 0;
    if (!value || seenPrices.has(value)) return;
    if (!PRICE_RE.test(value)) return;
    PRICE_RE.lastIndex = 0;
    seenPrices.add(value);
    prices.push(value);
  });

  const activePanel = document.querySelector("[role='tabpanel']:not([hidden])");
  const active_panel_text = activePanel && isLayoutVisible(activePanel) && !hasAriaHiddenAncestor(activePanel)
    ? collectVisibleText(activePanel)
    : "";

  return {
    page_title: collapse(document.title),
    headings,
    visible_text,
    product_names: productNames,
    prices,
    _active_panel_text: active_panel_text,
    product_descriptions: productDescriptions,
    specifications,
    links,
    images,
    tables,
  };
}
"""


def load_config(path: Path | None = None) -> dict[str, Any]:
    config_path = path or DEFAULT_CONFIG_PATH
    with config_path.open(encoding="utf-8") as handle:
        return json.load(handle)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def timestamp_slug(moment: datetime) -> str:
    return moment.strftime("%Y%m%d-%H%M%S")


def isoformat_z(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def page_slug(url: str) -> str:
    parsed = urlparse(url)
    path = (parsed.path or "/").strip("/")
    if not path:
        return "homepage"
    cleaned = re.sub(r"[^a-zA-Z0-9_-]+", "-", path).strip("-").lower()
    return cleaned[:80] or "page"


def resolve_output_dir(config: dict[str, Any], override: str | None = None) -> Path:
    raw = override or config.get("output_dir") or "out"
    path = Path(raw)
    if not path.is_absolute():
        path = REPO_ROOT / path
    return path


def ensure_output_dirs(output_dir: Path) -> dict[str, Path]:
    screenshots = output_dir / "screenshots"
    rendered_html = output_dir / "rendered_html"
    screenshots.mkdir(parents=True, exist_ok=True)
    rendered_html.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    return {"root": output_dir, "screenshots": screenshots, "rendered_html": rendered_html}


def relative_to_repo(path: Path) -> str:
    try:
        return path.resolve().relative_to(REPO_ROOT).as_posix()
    except ValueError:
        return str(path)


def empty_content() -> dict[str, Any]:
    return {
        "headings": [],
        "visible_text": "",
        "product_names": [],
        "prices": [],
        "product_descriptions": [],
        "specifications": [],
        "links": [],
        "images": [],
        "tables": [],
    }


def base_result(url: str, config: dict[str, Any]) -> dict[str, Any]:
    viewport = config.get("viewport") or {"width": 1366, "height": 768}
    return {
        "url": url,
        "final_url": url,
        "captured_at": isoformat_z(utc_now()),
        "capture_method": "playwright_chromium",
        "viewport": {
            "width": int(viewport.get("width", 1366)),
            "height": int(viewport.get("height", 768)),
        },
        "page_title": "",
        "status": "error",
        "errors": [],
        "screenshot_path": None,
        "rendered_html_path": None,
        "content": empty_content(),
        "limitations": [
            "In-page role=tab controls are clicked so tabbed features/specs can be read; forms, links, and purchase CTAs are not clicked.",
            "Closed accordions without a tab role, and off-screen overflow, may still hide text.",
            "Text painted only inside images (OCR not performed) is not captured as visible_text.",
            "Overlapping or visually clipped elements can still contribute DOM text if CSS visibility checks pass.",
            "aria-hidden subtrees are excluded from visible_text even if they occupy pixels (common for duplicate image links).",
            "Lazy content beyond the configured scroll budget is not captured.",
            "Related product cards on the same page may appear in product_names alongside the primary H1.",
        ],
    }


def write_json(result: dict[str, Any], json_path: Path) -> None:
    json_path.parent.mkdir(parents=True, exist_ok=True)
    with json_path.open("w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def _unique_dicts(items: list[Any]) -> list[Any]:
    seen: set[str] = set()
    out: list[Any] = []
    for item in items:
        key = json.dumps(item, sort_keys=True, ensure_ascii=False) if isinstance(item, (dict, list)) else str(item)
        if key in seen:
            continue
        seen.add(key)
        out.append(item)
    return out


def merge_extracted(base: dict[str, Any], extra: dict[str, Any]) -> dict[str, Any]:
    merged = empty_content()
    for key in merged:
        left = base.get(key) if isinstance(base, dict) else None
        right = extra.get(key) if isinstance(extra, dict) else None
        if key == "visible_text":
            text = str(left or "")
            panel = ""
            if isinstance(extra, dict):
                panel = str(extra.get("_active_panel_text") or right or "")
            if panel and panel not in text:
                text = (text + " " + panel).strip()
            elif right and str(right) not in text:
                text = (text + " " + str(right)).strip()
            merged[key] = text
            continue
        values: list[Any] = []
        if isinstance(left, list):
            values.extend(left)
        if isinstance(right, list):
            values.extend(right)
        merged[key] = _unique_dicts(values)
    return merged


def looks_like_loading_page(page: Any, status_code: int | None) -> bool:
    if status_code in {502, 503, 504}:
        return True
    try:
        title = (page.title() or "").lower()
        snippet = (page.inner_text("body") or "")[:400].lower()
    except Exception:  # noqa: BLE001
        return False
    return "application loading" in title or ("render" in title and "loading" in snippet)


def reveal_tab_panels(page: Any, config: dict[str, Any], errors: list[str]) -> list[dict[str, Any]]:
    """Click in-page tab buttons only (no links, forms, or purchases)."""
    tabs_cfg = config.get("tabs") or {}
    max_tabs = int(tabs_cfg.get("max_tabs", 8))
    wait_ms = int(tabs_cfg.get("wait_ms", 500))
    snapshots: list[dict[str, Any]] = []
    try:
        locator = page.locator('[role="tab"]')
        count = min(locator.count(), max_tabs)
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Tab discovery failed: {exc}")
        return snapshots
    for index in range(count):
        tab = locator.nth(index)
        try:
            if not tab.is_visible():
                continue
            tag = tab.evaluate("el => el.tagName")
            href = tab.evaluate("el => el.getAttribute('href')")
            if tag in {"A", "INPUT"} or href:
                continue
            tab.click(timeout=3000)
            page.wait_for_timeout(wait_ms)
            extracted = page.evaluate(EXTRACT_PAGE_JS)
            if isinstance(extracted, dict):
                snapshots.append(extracted)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Read-only tab click failed at index {index}: {exc}")
    if count:
        try:
            locator.nth(0).click(timeout=3000)
            page.wait_for_timeout(wait_ms)
        except Exception as exc:  # noqa: BLE001
            errors.append(f"Could not restore the first tab: {exc}")
    return snapshots


def bounded_scroll(page: Any, scroll_cfg: dict[str, Any], timeouts: dict[str, Any], errors: list[str]) -> None:
    step = int(scroll_cfg.get("step_px", 700))
    max_scrolls = int(scroll_cfg.get("max_scrolls", 25))
    settle_ms = int(scroll_cfg.get("settle_ms", 350))
    lazy_wait_ms = int(timeouts.get("lazy_wait_ms", 400))
    last_height = 0
    stable_rounds = 0
    for _ in range(max_scrolls):
        metrics = page.evaluate(
            """() => ({
                y: window.scrollY,
                inner: window.innerHeight,
                height: Math.max(
                    document.body ? document.body.scrollHeight : 0,
                    document.documentElement ? document.documentElement.scrollHeight : 0
                )
            })"""
        )
        height = int(metrics["height"] or 0)
        bottom = float(metrics["y"]) + float(metrics["inner"])
        if height > 0 and bottom >= height - 2:
            break
        if height == last_height:
            stable_rounds += 1
            if stable_rounds >= 2 and bottom >= height - 2:
                break
        else:
            stable_rounds = 0
        last_height = height
        page.evaluate("(dy) => window.scrollBy(0, dy)", step)
        page.wait_for_timeout(settle_ms + lazy_wait_ms)
    try:
        page.evaluate("() => window.scrollTo(0, 0)")
        page.wait_for_timeout(200)
    except Exception as exc:  # noqa: BLE001 — keep capture going
        errors.append(f"Could not scroll back to top: {exc}")


def capture_human_view(url: str, config: dict[str, Any] | None = None, output_dir: str | Path | None = None) -> dict[str, Any]:
    """Render `url` in headless Chromium and store human-visible content.

    Always writes a JSON file. Returns the same payload. Never raises for
    expected website/browser failures; those are recorded in `errors`.
    """
    try:
        from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        result = base_result(url, config or {})
        result["errors"].append(
            "Playwright is not installed. Run: pip install -r agents/readability/requirements.txt"
        )
        result["errors"].append(str(exc))
        return result

    cfg = config or load_config()
    timeouts = cfg.get("timeouts") or {}
    scroll_cfg = cfg.get("scroll") or {}
    nav_timeout = int(timeouts.get("navigation_ms", 45000))
    load_timeout = int(timeouts.get("load_state_ms", 15000))
    render_wait_ms = int(timeouts.get("render_wait_ms", 1500))
    user_agent = cfg.get("user_agent") or "OmegaXHumanViewCollector/0.1"
    viewport = cfg.get("viewport") or {"width": 1366, "height": 768}

    result = base_result(url, cfg)
    errors: list[str] = result["errors"]
    started = utc_now()
    result["captured_at"] = isoformat_z(started)
    stamp = timestamp_slug(started)
    slug = page_slug(url)
    dirs = ensure_output_dirs(resolve_output_dir(cfg, str(output_dir) if output_dir else None))
    json_path = dirs["root"] / f"human-view-{stamp}.json"
    screenshot_path = dirs["screenshots"] / f"{slug}-{stamp}.png"
    html_path = dirs["rendered_html"] / f"{slug}-{stamp}.html"

    browser = None
    context = None
    page = None
    try:
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(headless=True)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"Browser launch failed: {exc}")
                result["status"] = "error"
                write_json(result, json_path)
                result["json_path"] = relative_to_repo(json_path)
                return result

            context = browser.new_context(
                viewport={"width": int(viewport.get("width", 1366)), "height": int(viewport.get("height", 768))},
                user_agent=user_agent,
            )
            page = context.new_page()
            page.set_default_timeout(nav_timeout)
            retry_attempts = max(1, int(timeouts.get("retry_attempts", 3)))
            retry_wait_ms = int(timeouts.get("retry_wait_ms", 5000))
            try:
                response = None
                status_code = None
                for attempt in range(retry_attempts):
                    response = page.goto(url, wait_until="domcontentloaded", timeout=nav_timeout)
                    status_code = response.status if response is not None else None
                    if not looks_like_loading_page(page, status_code):
                        break
                    if attempt < retry_attempts - 1:
                        page.wait_for_timeout(retry_wait_ms)
                if response is None:
                    errors.append("Navigation returned no response object.")
                else:
                    result["http_status"] = status_code
                    if status_code is not None and status_code >= 400:
                        errors.append(f"HTTP {status_code} when loading {url}")
            except PlaywrightTimeoutError as exc:
                errors.append(f"Navigation timeout after {nav_timeout}ms: {exc}")
            except Exception as exc:  # noqa: BLE001
                errors.append(f"Navigation failed: {exc}")

            result["final_url"] = page.url or url
            slug = page_slug(result["final_url"])
            screenshot_path = dirs["screenshots"] / f"{slug}-{stamp}.png"
            html_path = dirs["rendered_html"] / f"{slug}-{stamp}.html"

            try:
                page.wait_for_load_state("load", timeout=load_timeout)
            except PlaywrightTimeoutError:
                errors.append(
                    f"Timed out waiting for load state after {load_timeout}ms; continuing with partial render."
                )
            except Exception as exc:  # noqa: BLE001
                errors.append(f"Load-state wait failed: {exc}")

            page.wait_for_timeout(render_wait_ms)
            bounded_scroll(page, scroll_cfg, timeouts, errors)

            extracted: dict[str, Any] = {}
            try:
                extracted = page.evaluate(EXTRACT_PAGE_JS)
                if not isinstance(extracted, dict):
                    errors.append("Extraction script did not return an object.")
                    extracted = {}
            except Exception as exc:  # noqa: BLE001
                errors.append(f"Content extraction failed: {exc}")
                extracted = {}

            content = empty_content()
            for key in content:
                if key in extracted and extracted[key] is not None:
                    content[key] = extracted[key]
            for tab_snapshot in reveal_tab_panels(page, cfg, errors):
                content = merge_extracted(content, tab_snapshot)
            content = attach_classification(content)
            result["content"] = content
            result["page_title"] = extracted.get("page_title") or page.title() or ""

            try:
                html = page.content()
                html_path.write_text(html, encoding="utf-8")
                result["rendered_html_path"] = relative_to_repo(html_path)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"Rendered HTML save failed: {exc}")

            try:
                page.screenshot(path=str(screenshot_path), full_page=True)
                result["screenshot_path"] = relative_to_repo(screenshot_path)
            except Exception as exc:  # noqa: BLE001
                errors.append(f"Screenshot failed: {exc}")

            if browser:
                browser.close()
    except Exception as exc:  # noqa: BLE001
        errors.append(f"Unexpected collector failure: {exc}")
    finally:
        pass

    content = result.get("content") or empty_content()
    if "primary_product" not in content:
        content = attach_classification(content)
        result["content"] = content

    visible = content.get("visible_text") or ""
    nav_failed = any("Navigation failed" in item or "Browser launch failed" in item or "Website unavailable" in item for item in errors)
    if not visible.strip():
        errors.append("No human-visible text was extracted.")
    if nav_failed or (not visible.strip() and result.get("screenshot_path") is None):
        result["status"] = "error"
    elif errors:
        result["status"] = "partial"
    else:
        result["status"] = "success"

    result["errors"] = errors
    result["json_path"] = relative_to_repo(json_path)
    try:
        write_json(result, json_path)
    except Exception as exc:  # noqa: BLE001
        result["status"] = "error"
        result["errors"].append(f"JSON write failed: {exc}")

    return result


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Capture human-visible content from a rendered web page using Playwright Chromium."
    )
    parser.add_argument(
        "--url",
        default=None,
        help="Page URL to capture (defaults to config.json default_url).",
    )
    parser.add_argument(
        "--config",
        default=str(DEFAULT_CONFIG_PATH),
        help="Path to JSON config file.",
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory for JSON, screenshots, and rendered HTML (default: repo out/).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    try:
        config = load_config(Path(args.config))
    except Exception as exc:  # noqa: BLE001
        print(f"ERROR: could not load config: {exc}", file=sys.stderr)
        return 2
    url = args.url or config.get("default_url")
    if not url:
        print("ERROR: no URL provided and config.json has no default_url.", file=sys.stderr)
        return 2
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        print("ERROR: URL must be http or https.", file=sys.stderr)
        return 2

    print(f"Capturing human view: {url}")
    result = capture_human_view(url, config=config, output_dir=args.output_dir)
    status = result.get("status")
    json_path = result.get("json_path")
    print(f"Status: {status}")
    if json_path:
        print(f"JSON: {json_path}")
    if result.get("screenshot_path"):
        print(f"Screenshot: {result['screenshot_path']}")
    if result.get("rendered_html_path"):
        print(f"Rendered HTML: {result['rendered_html_path']}")
    if result.get("errors"):
        print("Errors:")
        for item in result["errors"]:
            print(f"  - {item}")
    content = result.get("content") or {}
    names = content.get("product_names") or []
    prices = content.get("prices") or []
    print(f"Title: {result.get('page_title')}")
    print(f"Visible text characters: {len(content.get('visible_text') or '')}")
    print(f"Product names ({len(names)}): {', '.join(names) if names else '(none)'}")
    print(f"Prices ({len(prices)}): {', '.join(prices) if prices else '(none)'}")
    return 0 if status == "success" else 1


if __name__ == "__main__":
    sys.exit(main())
