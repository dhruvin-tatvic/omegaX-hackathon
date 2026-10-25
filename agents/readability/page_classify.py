"""URL path page categories for Human View reports.

Does not crawl. Uses the requested or final URL path. Query strings do not
change the category (so /book-test-ride?bike=… stays booking).
"""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qsl, urlparse, urlunparse

SCHEMA_VERSION = "1.0"

PAGE_TYPES = (
    "homepage",
    "product_listing",
    "product_detail",
    "offers",
    "finance",
    "dealer_listing",
    "dealer_detail",
    "faq",
    "about",
    "contact",
    "booking",
    "account",
    "authentication",
    "other",
)

STOP_REASON_LABELS = {
    "queue_exhausted": "Queue emptied — not proof of full-site coverage",
    "page_limit": "Stopped at the configured page limit",
    "max_depth": "Stopped at the configured max depth",
    "invalid_start_url": "Start URL was invalid",
}


def _parts(path: str) -> list[str]:
    return [segment for segment in (path or "").split("/") if segment]


def canonical_path(url: str) -> str:
    """Path without trailing slash (except `/`) and without query/fragment."""
    parsed = urlparse(url or "")
    parts = _parts(parsed.path or "/")
    if not parts:
        return "/"
    return "/" + "/".join(parts)


def canonical_url(url: str) -> str:
    """Origin + canonical path, query stripped, trailing slash collapsed."""
    parsed = urlparse(url or "")
    path = canonical_path(url)
    return urlunparse((parsed.scheme, parsed.netloc, path, "", "", ""))


def query_params(url: str) -> dict[str, str]:
    parsed = urlparse(url or "")
    return {key: value for key, value in parse_qsl(parsed.query, keep_blank_values=True)}


def classify_page_type(url: str) -> tuple[str, str]:
    """Return (page_type, page_type_reason) for a captured or candidate URL."""
    path = canonical_path(url)
    parts = _parts(path)

    if path == "/":
        return "homepage", "path is /"
    if path == "/motorcycles":
        return "product_listing", "path is /motorcycles"
    if len(parts) == 2 and parts[0] == "motorcycles":
        return "product_detail", "path matches /motorcycles/{slug}"
    if path == "/offers":
        return "offers", "path is /offers"
    if path == "/finance":
        return "finance", "path is /finance"
    if path == "/dealers":
        return "dealer_listing", "path is /dealers"
    if len(parts) == 2 and parts[0] == "dealers":
        return "dealer_detail", "path matches /dealers/{slug}"
    if path == "/faq":
        return "faq", "path is /faq"
    if path == "/about":
        return "about", "path is /about"
    if path == "/contact":
        return "contact", "path is /contact"
    if path == "/book-test-ride":
        return "booking", "path is /book-test-ride (query ignored)"
    if path == "/account":
        return "account", "path is /account"
    if path == "/login":
        return "authentication", "path is /login"
    return "other", "unrecognized path"


def classify_url(url: str, final_url: str | None = None) -> dict[str, Any]:
    """Classify using the final URL path when present; keep original URL."""
    identity_url = final_url or url
    page_type, reason = classify_page_type(identity_url)
    return {
        "page_type": page_type,
        "page_type_reason": reason,
        "canonical_path": canonical_path(identity_url),
        "canonical_url": canonical_url(identity_url),
        "query": query_params(identity_url) or query_params(url or ""),
        "url": url,
        "final_url": final_url or url,
    }


def human_stop_reason(stopped_reason: str | None) -> str:
    key = str(stopped_reason or "").strip()
    if not key:
        return "Unknown stop reason"
    return STOP_REASON_LABELS.get(key, key.replace("_", " "))


def filter_pages(
    pages: list[dict[str, Any]],
    query: str = "",
    page_type: str = "",
    status: str = "",
) -> list[dict[str, Any]]:
    """Page-explorer filter used by tests (dashboard mirrors this in JS)."""
    needle = (query or "").strip().casefold()
    wanted_type = (page_type or "").strip()
    wanted_status = (status or "").strip()
    out: list[dict[str, Any]] = []
    for page in pages:
        if wanted_type and str(page.get("page_type") or "") != wanted_type:
            continue
        if wanted_status and str(page.get("status") or "") != wanted_status:
            continue
        if needle:
            hay = " ".join(
                [
                    str(page.get("page_title") or ""),
                    str(page.get("url") or ""),
                    str(page.get("final_url") or ""),
                    str(page.get("canonical_path") or ""),
                ]
            ).casefold()
            if needle not in hay:
                continue
        out.append(page)
    return out
