"""Post-process extracted Human View content into primary vs related products.

Does not crawl or re-render. Uses only fields already captured by human_view.py.
No motorcycle names or prices are hardcoded.
"""

from __future__ import annotations

import re
from typing import Any

PRICE_RE = re.compile(r"(?:₹|Rs\.?\s*|INR\s*|USD\s*|€|£)\s*[\d,]+(?:\.\d+)?", re.I)
EX_SHOWROOM_NEAR_RE = re.compile(
    r"((?:₹|Rs\.?\s*|INR\s*|€|£)\s*[\d,]+(?:\.\d+)?)\s*(?:onwards\s*)?(?:\(?\s*ex[-\s]?showroom)",
    re.I,
)
ON_ROAD_HINT_RE = re.compile(r"on[-\s]?road", re.I)
EMI_HINT_RE = re.compile(r"\bemi\b|/\s*month|per\s*month", re.I)
VARIANT_BLOCK_RE = re.compile(
    r"available variants(.{0,1200}?)(?:you might also like|born to ride|explore more|$)",
    re.I | re.S,
)
VARIANT_NAME_RE = re.compile(r"([A-Za-z][A-Za-z0-9+\-]*(?:\s*\+)?)\s*$")


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip().casefold()


def _heading_text(item: Any) -> str:
    if isinstance(item, dict):
        return str(item.get("text") or "")
    return str(item or "")


def _h1(content: dict[str, Any]) -> str:
    for item in content.get("headings") or []:
        if isinstance(item, dict) and int(item.get("level") or 0) == 1:
            text = _heading_text(item)
            if text:
                return text
    return ""


def _spec_label(spec: dict[str, Any]) -> str:
    return str(spec.get("label") or "")


def _spec_value(spec: dict[str, Any]) -> str:
    return str(spec.get("value") or "")


def _spec_product(spec: dict[str, Any]) -> str:
    return str(spec.get("product") or "")


def _label_key(label: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", label.lower()).strip()


def _is_product_detail(content: dict[str, Any]) -> bool:
    h1 = _h1(content)
    names = [str(n) for n in (content.get("product_names") or []) if n]
    if not h1 or not names:
        return False
    if not any(_norm(name) == _norm(h1) for name in names):
        return False
    text = str(content.get("visible_text") or "")
    has_ex = "ex-showroom" in text.casefold() or "ex showroom" in text.casefold()
    has_specs = bool(content.get("specifications"))
    return has_ex or has_specs


def _price_kind(price: str, visible_text: str) -> str:
    """Classify a visible currency string from nearby words. Heuristic only."""
    text = visible_text or ""
    idx = text.find(price)
    window = text[max(0, idx - 80) : idx + len(price) + 80] if idx >= 0 else text
    window_l = window.casefold()
    if EMI_HINT_RE.search(window) or "down payment" in window_l:
        return "emi_or_finance"
    if ON_ROAD_HINT_RE.search(window) and "ex-showroom" not in window_l:
        return "on_road"
    if "ex-showroom" in window_l or "ex showroom" in window_l:
        return "ex_showroom"
    if "starting" in window_l:
        return "starting"
    if "variant" in window_l:
        return "variant"
    return "other"


def _ex_showroom_price(content: dict[str, Any], primary_name: str) -> str | None:
    text = str(content.get("visible_text") or "")
    match = EX_SHOWROOM_NEAR_RE.search(text)
    if match:
        return match.group(1).strip()
    for spec in content.get("specifications") or []:
        if not isinstance(spec, dict):
            continue
        label = _label_key(_spec_label(spec))
        product = _spec_product(spec)
        if product and _norm(product) != _norm(primary_name):
            continue
        if "starting" in label and PRICE_RE.search(_spec_value(spec) or ""):
            return _spec_value(spec)
    for price in content.get("prices") or []:
        if _price_kind(str(price), text) == "ex_showroom":
            return str(price)
    return None


def _pick_spec(content: dict[str, Any], primary_name: str, predicates: list[Any]) -> str | None:
    specs = [s for s in (content.get("specifications") or []) if isinstance(s, dict)]
    owned = [s for s in specs if _norm(_spec_product(s)) == _norm(primary_name)]
    page_level = [s for s in specs if not _spec_product(s)]
    search_order = owned + page_level + specs
    best: str | None = None
    for spec in search_order:
        label = _label_key(_spec_label(spec))
        value = _spec_value(spec)
        if not label or not value:
            continue
        for pred in predicates:
            if pred(label) and not PRICE_RE.search(value):
                if best is None or len(value) > len(best):
                    best = value
    return best


def _engine(label: str) -> bool:
    return ("engine" in label or "displacement" in label) and "rpm" not in label


def _power(label: str) -> bool:
    return ("power" in label or label.endswith("bhp")) and "rpm" not in label


def _torque(label: str) -> bool:
    return ("torque" in label or "nm" in label.split()) and "rpm" not in label


def _mileage(label: str) -> bool:
    return "mileage" in label or "kmpl" in label or "km l" in label


def _features(content: dict[str, Any]) -> list[str]:
    headings = content.get("headings") or []
    collecting = False
    features: list[str] = []
    for item in headings:
        if not isinstance(item, dict):
            continue
        level = int(item.get("level") or 0)
        text = _heading_text(item)
        key = _norm(text)
        if key in {"key features", "features"}:
            collecting = True
            continue
        if collecting and level <= 2:
            break
        if collecting and level == 3 and text and text not in features:
            features.append(text)
    return features


def _variants(content: dict[str, Any], primary_price: str | None) -> list[dict[str, str]]:
    text = str(content.get("visible_text") or "")
    block_match = VARIANT_BLOCK_RE.search(text)
    if not block_match:
        return []
    block = block_match.group(1)
    variants: list[dict[str, str]] = []
    seen: set[str] = set()
    for match in PRICE_RE.finditer(block):
        price = match.group(0).strip()
        before = block[max(0, match.start() - 48) : match.start()]
        name_match = VARIANT_NAME_RE.search(before)
        if not name_match:
            continue
        clean_name = re.sub(r"\s+", " ", name_match.group(1)).strip(" •-\t")
        if _norm(clean_name) in {"city", "indicative", "emi", "down"}:
            continue
        if len(clean_name) < 2 or len(clean_name) > 40:
            continue
        key = f"{_norm(clean_name)}|{price}"
        if key in seen:
            continue
        seen.add(key)
        compact_primary = (primary_price or "").replace(" ", "")
        kind = "ex_showroom" if compact_primary and price.replace(" ", "") == compact_primary else "variant"
        variants.append({"name": clean_name, "price": price, "price_kind": kind})
    return variants


def _related_products(content: dict[str, Any], primary_name: str) -> list[dict[str, Any]]:
    related: list[dict[str, Any]] = []
    seen: set[str] = set()
    for name in content.get("product_names") or []:
        text = str(name)
        if not text or _norm(text) == _norm(primary_name):
            continue
        if _norm(text) in seen:
            continue
        seen.add(_norm(text))
        price = None
        for spec in content.get("specifications") or []:
            if not isinstance(spec, dict):
                continue
            if _norm(_spec_product(spec)) != _norm(text):
                continue
            if PRICE_RE.search(_spec_value(spec) or ""):
                price = _spec_value(spec)
                break
        related.append({"name": text, "price": price, "price_kind": "starting" if price else None})
    return related


def classify_content(content: dict[str, Any] | None) -> dict[str, Any]:
    """Return primary_product / related_products without removing existing fields."""
    payload = content if isinstance(content, dict) else {}
    if not _is_product_detail(payload):
        return {"primary_product": None, "related_products": []}

    name = _h1(payload)
    ex_showroom = _ex_showroom_price(payload, name)
    primary = {
        "name": name,
        "ex_showroom_price": ex_showroom,
        "engine": _pick_spec(payload, name, [_engine]),
        "power": _pick_spec(payload, name, [_power]),
        "torque": _pick_spec(payload, name, [_torque]),
        "mileage": _pick_spec(payload, name, [_mileage]),
        "features": _features(payload),
        "variants": _variants(payload, ex_showroom),
    }
    return {
        "primary_product": primary,
        "related_products": _related_products(payload, name),
    }


def attach_classification(content: dict[str, Any] | None) -> dict[str, Any]:
    result = content if isinstance(content, dict) else {}
    classified = classify_content(result)
    result["primary_product"] = classified["primary_product"]
    result["related_products"] = classified["related_products"]
    return result
