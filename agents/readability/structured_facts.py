"""Entity-based structured facts from saved rendered HTML.

Raw Human View arrays are left untouched. Facts are derived from semantic
containers (cards, tables, labelled benefits). Product names and prices are
never paired by array index.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

MODULE_DIR = Path(__file__).resolve().parent
if __package__ in {None, ""}:
    if str(MODULE_DIR) not in sys.path:
        sys.path.insert(0, str(MODULE_DIR))
    from html_dom import Node, parse_html, script_jsonld_texts, table_matrix
    from page_classify import classify_url
else:
    from .html_dom import Node, parse_html, script_jsonld_texts, table_matrix
    from .page_classify import classify_url

SCHEMA_VERSION = "1.0"

ENTITY_TYPES = (
    "product",
    "offer",
    "financing_plan",
    "bank",
    "dealer",
    "faq",
    "organization",
    "unknown",
)

FACT_TYPES = (
    "ex_showroom_price",
    "on_road_price",
    "starting_price",
    "original_price",
    "discounted_price",
    "cash_discount",
    "cashback",
    "accessories_value",
    "down_payment",
    "monthly_emi",
    "insurance_cost",
    "registration_cost",
    "processing_fee",
    "annual_interest_rate_pct",
    "loan_tenure_months",
    "financing_partner",
    "offer_valid_until",
    "variant_name",
    "engine",
    "power",
    "torque",
    "mileage",
    "specification",
    "feature",
    "tagline",
    "question",
    "answer",
    "phone",
    "email",
    "address",
    "city",
    "hours",
    "name",
    "offer_term",
)

INR_RE = re.compile(r"(?:₹|Rs\.?\s*|INR\s*)\s*([\d,]+(?:\.\d+)?)", re.I)
PCT_RE = re.compile(r"(\d+(?:\.\d+)?)\s*%")
MONTHS_RE = re.compile(r"(\d+)\s*(?:months?|mo)\b", re.I)
SLUG_RE = re.compile(r"/motorcycles/([a-z0-9-]+)", re.I)
ON_PRODUCT_RE = re.compile(r"\bon\s+([A-Z][A-Za-z0-9+ \-]{1,40})$")

MONEY_TYPE_HINTS = (
    ("cash discount", "cash_discount"),
    ("cashback", "cashback"),
    ("cash back", "cashback"),
    ("accessories", "accessories_value"),
    ("accessory", "accessories_value"),
    ("down payment", "down_payment"),
    ("emi", "monthly_emi"),
    ("per month", "monthly_emi"),
    ("/month", "monthly_emi"),
    ("insurance", "insurance_cost"),
    ("registration", "registration_cost"),
    ("rto", "registration_cost"),
    ("processing fee", "processing_fee"),
    ("on-road", "on_road_price"),
    ("on road", "on_road_price"),
    ("ex-showroom", "ex_showroom_price"),
    ("ex showroom", "ex_showroom_price"),
    ("starting", "starting_price"),
)


def slugify(text: str) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", "-", (text or "").casefold()).strip("-")
    return cleaned or "item"


def parse_inr(text: str) -> tuple[float | int | None, str | None]:
    match = INR_RE.search(text or "")
    if not match:
        return None, None
    raw = match.group(0).strip()
    number = match.group(1).replace(",", "")
    value: float | int
    if "." in number:
        value = float(number)
    else:
        value = int(number)
    return value, raw


def parse_percent(text: str) -> float | None:
    match = PCT_RE.search(text or "")
    if not match:
        return None
    return float(match.group(1))


def parse_months(text: str) -> int | None:
    match = MONTHS_RE.search(text or "")
    if not match:
        return None
    return int(match.group(1))


def collapse(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def title_case_name(text: str) -> str:
    return collapse(text)


def money_type_from_text(text: str) -> str | None:
    lowered = (text or "").casefold()
    for needle, fact_type in MONEY_TYPE_HINTS:
        if needle in lowered:
            return fact_type
    return None


class FactBuilder:
    def __init__(self, source_url: str) -> None:
        self.source_url = source_url
        self.entities: dict[str, dict[str, Any]] = {}
        self.facts: list[dict[str, Any]] = []
        self._seen: set[str] = set()

    def entity(
        self,
        entity_type: str,
        name: str,
        slug: str | None = None,
        extra: dict[str, Any] | None = None,
    ) -> str:
        ident_slug = slug or slugify(name)
        entity_id = f"{entity_type}:{ident_slug}"
        if entity_id not in self.entities:
            payload = {
                "id": entity_id,
                "type": entity_type,
                "name": title_case_name(name),
                "slug": ident_slug,
            }
            if extra:
                payload.update(extra)
            self.entities[entity_id] = payload
        elif extra:
            for key, value in extra.items():
                self.entities[entity_id].setdefault(key, value)
        return entity_id

    def add_fact(
        self,
        *,
        entity_id: str | None,
        entity_name: str | None,
        entity_type: str | None,
        fact_type: str,
        value: Any,
        value_text: str,
        evidence: str,
        extraction_method: str,
        status: str = "verified",
        unit: str | None = None,
        currency: str | None = None,
        qualifier: dict[str, Any] | None = None,
        related_entity_id: str | None = None,
    ) -> None:
        if value is None and not value_text:
            return
        key = "|".join(
            [
                str(entity_id or ""),
                fact_type,
                json.dumps(qualifier or {}, sort_keys=True),
                str(value),
                self.source_url,
                extraction_method,
            ]
        )
        if key in self._seen:
            return
        self._seen.add(key)
        fact: dict[str, Any] = {
            "id": f"fact:{len(self.facts) + 1}",
            "entity_id": entity_id,
            "entity_name": entity_name,
            "entity_type": entity_type,
            "fact_type": fact_type,
            "value": value,
            "value_text": value_text,
            "unit": unit,
            "currency": currency,
            "qualifier": qualifier or {},
            "evidence": collapse(evidence)[:400],
            "source_url": self.source_url,
            "extraction_method": extraction_method,
            "status": status,
        }
        if related_entity_id:
            fact["related_entity_id"] = related_entity_id
        self.facts.append(fact)

    def add_money(
        self,
        *,
        entity_id: str | None,
        entity_name: str | None,
        entity_type: str | None,
        fact_type: str,
        text: str,
        evidence: str,
        extraction_method: str,
        status: str = "verified",
        qualifier: dict[str, Any] | None = None,
        related_entity_id: str | None = None,
    ) -> None:
        amount, raw = parse_inr(text)
        if amount is None:
            return
        self.add_fact(
            entity_id=entity_id,
            entity_name=entity_name,
            entity_type=entity_type,
            fact_type=fact_type,
            value=amount,
            value_text=raw or collapse(text),
            unit="INR",
            currency="INR",
            evidence=evidence,
            extraction_method=extraction_method,
            status=status,
            qualifier=qualifier,
            related_entity_id=related_entity_id,
        )

    def payload(self) -> dict[str, Any]:
        return {
            "schema_version": SCHEMA_VERSION,
            "entities": list(self.entities.values()),
            "facts": self.facts,
        }


def product_slug_from(node: Node, fallback_name: str | None = None) -> str | None:
    data_slug = node.get("data-slug")
    if data_slug:
        return data_slug.strip()
    for descendant in node.walk():
        href = descendant.get("href") if descendant.tag == "a" else None
        if href:
            match = SLUG_RE.search(href)
            if match:
                return match.group(1).strip().lower()
        data_slug = descendant.get("data-slug")
        if data_slug:
            return data_slug.strip()
    if fallback_name:
        return slugify(fallback_name)
    return None


def _norm_header(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (text or "").casefold()).strip()


def _finance_header_map(headers: list[str]) -> dict[int, str]:
    mapping: dict[int, str] = {}
    for index, header in enumerate(headers):
        key = _norm_header(header)
        if "down" in key and "payment" in key:
            mapping[index] = "down_payment"
        elif "interest" in key or key.endswith("rate") or "p a" in key:
            mapping[index] = "annual_interest_rate_pct"
        elif "tenure" in key or key in {"months", "mo"}:
            mapping[index] = "loan_tenure_months"
        elif "emi" in key:
            mapping[index] = "monthly_emi"
    return mapping


def extract_finance_table(
    builder: FactBuilder,
    table: Node,
    *,
    product_id: str,
    product_name: str,
    plan_id: str,
    evidence_prefix: str,
    qualifier: dict[str, Any] | None = None,
) -> None:
    headers, rows = table_matrix(table)
    header_map = _finance_header_map(headers)
    if not header_map or not rows:
        return
    row = rows[0]
    for index, fact_type in header_map.items():
        if index >= len(row):
            continue
        cell = row[index]
        evidence = f"{evidence_prefix} {headers[index] if index < len(headers) else fact_type}: {cell}"
        if fact_type in {"down_payment", "monthly_emi"}:
            builder.add_money(
                entity_id=plan_id,
                entity_name=f"{product_name} finance plan",
                entity_type="financing_plan",
                fact_type=fact_type,
                text=cell,
                evidence=evidence,
                extraction_method="html.table.finance",
                qualifier=qualifier,
                related_entity_id=product_id,
            )
            builder.add_money(
                entity_id=product_id,
                entity_name=product_name,
                entity_type="product",
                fact_type=fact_type,
                text=cell,
                evidence=evidence,
                extraction_method="html.table.finance",
                qualifier=qualifier,
                related_entity_id=plan_id,
            )
        elif fact_type == "annual_interest_rate_pct":
            pct = parse_percent(cell)
            if pct is None:
                continue
            builder.add_fact(
                entity_id=plan_id,
                entity_name=f"{product_name} finance plan",
                entity_type="financing_plan",
                fact_type=fact_type,
                value=pct,
                value_text=collapse(cell),
                unit="percent",
                evidence=evidence,
                extraction_method="html.table.finance",
                qualifier=qualifier,
                related_entity_id=product_id,
            )
            builder.add_fact(
                entity_id=product_id,
                entity_name=product_name,
                entity_type="product",
                fact_type=fact_type,
                value=pct,
                value_text=collapse(cell),
                unit="percent",
                evidence=evidence,
                extraction_method="html.table.finance",
                qualifier=qualifier,
                related_entity_id=plan_id,
            )
        elif fact_type == "loan_tenure_months":
            months = parse_months(cell) or parse_months(evidence_prefix)
            if months is None:
                digits = re.search(r"\d+", cell)
                months = int(digits.group(0)) if digits else None
            if months is None:
                continue
            builder.add_fact(
                entity_id=plan_id,
                entity_name=f"{product_name} finance plan",
                entity_type="financing_plan",
                fact_type=fact_type,
                value=months,
                value_text=collapse(cell),
                unit="months",
                evidence=evidence,
                extraction_method="html.table.finance",
                qualifier=qualifier,
                related_entity_id=product_id,
            )
            builder.add_fact(
                entity_id=product_id,
                entity_name=product_name,
                entity_type="product",
                fact_type=fact_type,
                value=months,
                value_text=collapse(cell),
                unit="months",
                evidence=evidence,
                extraction_method="html.table.finance",
                qualifier=qualifier,
                related_entity_id=plan_id,
            )


def extract_product_cards(builder: FactBuilder, root: Node, *, related: bool = False) -> None:
    for card in root.find_all(class_name="product-card"):
        if card.closest_class("navbar") or card.closest_class("footer"):
            continue
        name_node = next((node for node in card.find_all(class_name="product-card__name")), None)
        name = name_node.collapsed_text() if name_node else ""
        if not name:
            continue
        slug = product_slug_from(card, name)
        product_id = builder.entity("product", name, slug)
        tagline = next((node for node in card.find_all(class_name="product-card__tagline")), None)
        if tagline and tagline.collapsed_text():
            builder.add_fact(
                entity_id=product_id,
                entity_name=name,
                entity_type="product",
                fact_type="tagline",
                value=tagline.collapsed_text(),
                value_text=tagline.collapsed_text(),
                evidence=tagline.collapsed_text(),
                extraction_method="html.css:.product-card__tagline",
            )
        price_node = next((node for node in card.find_all(class_name="price")), None)
        if price_node:
            note = card.collapsed_text()
            fact_type = "starting_price"
            if "ex-showroom" in note.casefold() or "ex showroom" in note.casefold():
                fact_type = "ex_showroom_price"
            qualifier = {"role": "related_card"} if related else None
            builder.add_money(
                entity_id=product_id,
                entity_name=name,
                entity_type="product",
                fact_type=fact_type,
                text=price_node.collapsed_text(),
                evidence=f"{name} {price_node.collapsed_text()} {note[note.casefold().find('ex-showroom')-12 if 'ex-showroom' in note.casefold() else 0:][:80]}",
                extraction_method="html.css:.product-card .price",
                qualifier=qualifier,
            )
        for spec in card.find_all(class_name="product-card__spec"):
            label = next((node for node in spec.find_all(class_name="product-card__spec-label")), None)
            value = next((node for node in spec.find_all(class_name="product-card__spec-value")), None)
            if not label or not value:
                continue
            label_text = label.collapsed_text()
            value_text = value.collapsed_text()
            fact_type = "specification"
            key = label_text.casefold()
            if "engine" in key:
                fact_type = "engine"
            elif "power" in key:
                fact_type = "power"
            elif "torque" in key:
                fact_type = "torque"
            elif "mileage" in key:
                fact_type = "mileage"
            builder.add_fact(
                entity_id=product_id,
                entity_name=name,
                entity_type="product",
                fact_type=fact_type,
                value=value_text,
                value_text=value_text,
                evidence=f"{name} {label_text}: {value_text}",
                extraction_method="html.css:.product-card__spec",
            )


def extract_product_detail(builder: FactBuilder, root: Node) -> None:
    title = next((node for node in root.find_all(class_name="moto-detail__hero-title")), None)
    if not title:
        h1 = next((node for node in root.find_all("h1")), None)
        name = h1.collapsed_text() if h1 else ""
    else:
        name = title.collapsed_text()
    if not name:
        extract_product_cards(builder, root)
        return
    slug = product_slug_from(root, name)
    product_id = builder.entity("product", name, slug)

    price_node = next((node for node in root.find_all(class_name="moto-detail__price")), None)
    note = next((node for node in root.find_all(class_name="moto-detail__price-note")), None)
    if price_node:
        note_text = note.collapsed_text() if note else ""
        fact_type = "ex_showroom_price" if "ex-showroom" in note_text.casefold() or "ex showroom" in note_text.casefold() else "starting_price"
        if "onwards" in note_text.casefold() and fact_type == "ex_showroom_price":
            builder.add_money(
                entity_id=product_id,
                entity_name=name,
                entity_type="product",
                fact_type="starting_price",
                text=price_node.collapsed_text(),
                evidence=f"{name} {price_node.collapsed_text()} {note_text}",
                extraction_method="html.css:.moto-detail__price",
                qualifier={"label": note_text} if note_text else None,
            )
        builder.add_money(
            entity_id=product_id,
            entity_name=name,
            entity_type="product",
            fact_type=fact_type,
            text=price_node.collapsed_text(),
            evidence=f"{name} {price_node.collapsed_text()} {note_text}".strip(),
            extraction_method="html.css:.moto-detail__price",
            qualifier={"label": note_text} if note_text else None,
        )

    tagline = next((node for node in root.find_all(class_name="moto-detail__hero-tagline")), None)
    if tagline and tagline.collapsed_text():
        builder.add_fact(
            entity_id=product_id,
            entity_name=name,
            entity_type="product",
            fact_type="tagline",
            value=tagline.collapsed_text(),
            value_text=tagline.collapsed_text(),
            evidence=tagline.collapsed_text(),
            extraction_method="html.css:.moto-detail__hero-tagline",
        )

    for spec in root.find_all(class_name="moto-detail__quick-spec"):
        label = next((node for node in spec.find_all(class_name="moto-detail__quick-spec-label")), None)
        value = next((node for node in spec.find_all(class_name="moto-detail__quick-spec-value")), None)
        if not label or not value:
            continue
        label_text = label.collapsed_text()
        value_text = value.collapsed_text()
        key = label_text.casefold()
        fact_type = "specification"
        if "engine" in key or "powertrain" in key:
            fact_type = "engine"
        elif "power" in key:
            fact_type = "power"
        elif "torque" in key:
            fact_type = "torque"
        elif "mileage" in key:
            fact_type = "mileage"
        builder.add_fact(
            entity_id=product_id,
            entity_name=name,
            entity_type="product",
            fact_type=fact_type,
            value=value_text,
            value_text=value_text,
            evidence=f"{label_text}: {value_text}",
            extraction_method="html.css:.moto-detail__quick-spec",
        )

    for table in root.find_all("table"):
        if table.has_class("specs"):
            _headers, rows = table_matrix(table)
            for row in rows:
                if len(row) < 2:
                    continue
                builder.add_fact(
                    entity_id=product_id,
                    entity_name=name,
                    entity_type="product",
                    fact_type="specification",
                    value=row[1],
                    value_text=row[1],
                    evidence=f"{row[0]}: {row[1]}",
                    extraction_method="html.table.specs",
                    qualifier={"spec_label": row[0]},
                )
        elif table.has_class("onroad"):
            headers, rows = table_matrix(table)
            for row in rows:
                if len(row) < 2:
                    continue
                city, price_text = row[0], row[1]
                builder.add_money(
                    entity_id=product_id,
                    entity_name=name,
                    entity_type="product",
                    fact_type="on_road_price",
                    text=price_text,
                    evidence=f"On-road {city}: {price_text}",
                    extraction_method="html.table.onroad",
                    qualifier={"city": city, "variant": "base"},
                )
        elif table.has_class("finance"):
            plan_id = builder.entity(
                "financing_plan",
                f"{name} estimated EMI",
                f"{slug or slugify(name)}-detail-emi",
            )
            extract_finance_table(
                builder,
                table,
                product_id=product_id,
                product_name=name,
                plan_id=plan_id,
                evidence_prefix=f"{name} estimated finance",
                qualifier={"basis": "base variant"},
            )

    for item in root.find_all(class_name="variant-name"):
        row = item.parent
        variant_name = item.collapsed_text()
        if not variant_name or row is None:
            continue
        price_node = next((node for node in row.find_all(class_name="price")), None)
        variant_id = builder.entity(
            "product",
            f"{name} {variant_name}",
            f"{slug or slugify(name)}-variant-{slugify(variant_name)}",
            extra={"variant_of": product_id, "variant_name": variant_name},
        )
        builder.add_fact(
            entity_id=variant_id,
            entity_name=f"{name} {variant_name}",
            entity_type="product",
            fact_type="variant_name",
            value=variant_name,
            value_text=variant_name,
            evidence=f"Variant {variant_name}",
            extraction_method="html.css:.variant-name",
            related_entity_id=product_id,
        )
        if price_node:
            fact_type = "ex_showroom_price" if variant_name.casefold() in {"standard", "base"} else "ex_showroom_price"
            builder.add_money(
                entity_id=variant_id,
                entity_name=f"{name} {variant_name}",
                entity_type="product",
                fact_type=fact_type,
                text=price_node.collapsed_text(),
                evidence=f"Variant {variant_name} {price_node.collapsed_text()}",
                extraction_method="html.css:.variant-name+.price",
                qualifier={"variant": variant_name, "parent_product": name},
                related_entity_id=product_id,
            )

    related_grid = next((node for node in root.find_all(class_name="home-featured__grid")), None)
    if related_grid:
        extract_product_cards(builder, related_grid, related=True)

    for pill in root.find_all(class_name="moto-detail__dealer-pill"):
        dealer_name = next((node for node in pill.find_all(class_name="moto-detail__dealer-pill-name")), None)
        if not dealer_name:
            continue
        city_node = next((node for node in pill.find_all(class_name="moto-detail__dealer-pill-city")), None)
        dealer_id = builder.entity("dealer", dealer_name.collapsed_text())
        if city_node:
            city_text = city_node.collapsed_text().split("•")[0].strip()
            builder.add_fact(
                entity_id=dealer_id,
                entity_name=dealer_name.collapsed_text(),
                entity_type="dealer",
                fact_type="city",
                value=city_text,
                value_text=city_text,
                evidence=city_node.collapsed_text(),
                extraction_method="html.css:.moto-detail__dealer-pill",
            )


def extract_offers(builder: FactBuilder, root: Node) -> None:
    for card in root.find_all(class_name="offer-card"):
        title_node = next((node for node in card.find_all(class_name="offer-card__title")), None)
        if not title_node:
            continue
        title = title_node.collapsed_text()
        offer_id = builder.entity("offer", title)
        subtitle = next((node for node in card.find_all(class_name="offer-card__subtitle")), None)
        desc = next((node for node in card.find_all(class_name="offer-card__desc")), None)
        validity = next((node for node in card.find_all(class_name="offer-card__validity-date")), None)
        if validity and validity.collapsed_text():
            builder.add_fact(
                entity_id=offer_id,
                entity_name=title,
                entity_type="offer",
                fact_type="offer_valid_until",
                value=validity.collapsed_text(),
                value_text=validity.collapsed_text(),
                evidence=f"{title} valid till {validity.collapsed_text()}",
                extraction_method="html.css:.offer-card__validity-date",
            )
        if subtitle and parse_inr(subtitle.collapsed_text())[0] is not None:
            builder.add_money(
                entity_id=offer_id,
                entity_name=title,
                entity_type="offer",
                fact_type="cash_discount",
                text=subtitle.collapsed_text(),
                evidence=f"{title}: {subtitle.collapsed_text()}",
                extraction_method="html.css:.offer-card__subtitle",
                qualifier={"scope": "up_to"} if "up to" in subtitle.collapsed_text().casefold() else None,
            )

        tagged_products: list[tuple[str, str, str]] = []
        for tag in card.find_all(class_name="offer-card__model-tag"):
            tag_text = tag.collapsed_text()
            slug = product_slug_from(tag)
            name = collapse(re.split(r"•", tag_text)[0])
            if not name:
                continue
            product_id = builder.entity("product", name, slug)
            tagged_products.append((product_id, name, tag.collapsed_text()))
            price_node = next((node for node in tag.find_all(class_name="price")), None)
            if price_node:
                builder.add_money(
                    entity_id=product_id,
                    entity_name=name,
                    entity_type="product",
                    fact_type="starting_price",
                    text=price_node.collapsed_text(),
                    evidence=f"{title} model tag {name} starting {price_node.collapsed_text()}",
                    extraction_method="html.css:.offer-card__model-tag .price",
                    related_entity_id=offer_id,
                    qualifier={"context": "offer_model_tag"},
                )

        for benefit in card.find_all(class_name="offer-card__benefit"):
            text = benefit.collapsed_text()
            if not text:
                continue
            fact_type = money_type_from_text(text) or "offer_term"
            amount, raw = parse_inr(text)
            product_id = None
            product_name = None
            on_match = ON_PRODUCT_RE.search(text)
            if on_match:
                candidate = collapse(on_match.group(1))
                for pid, pname, _tag in tagged_products:
                    if pname.casefold() == candidate.casefold() or candidate.casefold() in pname.casefold():
                        product_id, product_name = pid, pname
                        break
                if product_id is None:
                    product_id = builder.entity("product", candidate)
                    product_name = candidate
            elif len(tagged_products) == 1 and amount is not None and fact_type != "offer_term":
                product_id, product_name, _tag = tagged_products[0]

            status = "verified"
            entity_id = offer_id
            entity_name = title
            entity_type = "offer"
            related = None
            typed_money = fact_type in {
                "cash_discount",
                "cashback",
                "accessories_value",
                "monthly_emi",
                "down_payment",
                "insurance_cost",
            }
            if amount is not None and typed_money:
                if product_id:
                    entity_id, entity_name, entity_type = product_id, product_name, "product"
                    related = offer_id
                elif len(tagged_products) > 1:
                    status = "ambiguous"
                    entity_id, entity_name, entity_type = offer_id, title, "offer"
                builder.add_money(
                    entity_id=entity_id,
                    entity_name=entity_name,
                    entity_type=entity_type,
                    fact_type=fact_type,
                    text=text,
                    evidence=f"{title}: {text}",
                    extraction_method="html.css:.offer-card__benefit",
                    status=status,
                    related_entity_id=related,
                    qualifier={"offer": title},
                )
            elif amount is not None:
                builder.add_money(
                    entity_id=offer_id,
                    entity_name=title,
                    entity_type="offer",
                    fact_type="offer_term",
                    text=text,
                    evidence=f"{title}: {text}",
                    extraction_method="html.css:.offer-card__benefit",
                    status="ambiguous",
                    qualifier={"offer": title, "untyped_amount": True},
                )
            else:
                builder.add_fact(
                    entity_id=offer_id,
                    entity_name=title,
                    entity_type="offer",
                    fact_type="offer_term",
                    value=text,
                    value_text=text,
                    evidence=f"{title}: {text}",
                    extraction_method="html.css:.offer-card__benefit",
                )

        if desc and desc.collapsed_text():
            builder.add_fact(
                entity_id=offer_id,
                entity_name=title,
                entity_type="offer",
                fact_type="offer_term",
                value=desc.collapsed_text(),
                value_text=desc.collapsed_text(),
                evidence=desc.collapsed_text(),
                extraction_method="html.css:.offer-card__desc",
            )

    for row in root.find_all(class_name="offers-financing__row"):
        bank_node = next((node for node in row.find_all(class_name="offers-financing__bank")), None)
        if not bank_node:
            continue
        bank_name = bank_node.collapsed_text()
        bank_id = builder.entity("bank", bank_name)
        texts = [node.collapsed_text() for node in row.children if node.tag != "#text" and node.collapsed_text()]
        if len(texts) >= 2:
            pct = parse_percent(texts[1])
            if pct is not None:
                builder.add_fact(
                    entity_id=bank_id,
                    entity_name=bank_name,
                    entity_type="bank",
                    fact_type="annual_interest_rate_pct",
                    value=pct,
                    value_text=texts[1],
                    unit="percent",
                    evidence=f"{bank_name} {texts[1]}",
                    extraction_method="html.css:.offers-financing__row",
                )
                builder.add_fact(
                    entity_id=bank_id,
                    entity_name=bank_name,
                    entity_type="bank",
                    fact_type="financing_partner",
                    value=bank_name,
                    value_text=bank_name,
                    evidence=f"Partner bank {bank_name}",
                    extraction_method="html.css:.offers-financing__bank",
                )
        if len(texts) >= 3:
            months = parse_months(texts[2])
            if months is not None:
                builder.add_fact(
                    entity_id=bank_id,
                    entity_name=bank_name,
                    entity_type="bank",
                    fact_type="loan_tenure_months",
                    value=months,
                    value_text=texts[2],
                    unit="months",
                    evidence=f"{bank_name} max tenure {texts[2]}",
                    extraction_method="html.css:.offers-financing__row",
                    qualifier={"scope": "max"},
                )


def extract_finance_page(builder: FactBuilder, root: Node) -> None:
    for card in root.find_all(class_name="finance-bike-card"):
        name_node = next((node for node in card.find_all(class_name="finance-bike-name")), None)
        if not name_node:
            continue
        name = name_node.collapsed_text()
        slug = product_slug_from(card, name)
        product_id = builder.entity("product", name, slug)
        plan_id = builder.entity("financing_plan", f"{name} finance plan", f"{slug or slugify(name)}-finance")
        price_node = next((node for node in card.find_all(class_name="price")), None)
        if price_node:
            builder.add_money(
                entity_id=product_id,
                entity_name=name,
                entity_type="product",
                fact_type="ex_showroom_price",
                text=price_node.collapsed_text(),
                evidence=f"{name} Ex-showroom: {price_node.collapsed_text()}",
                extraction_method="html.css:.finance-bike-card .price",
                related_entity_id=plan_id,
            )
        table = next((node for node in card.find_all("table") if node.has_class("finance")), None)
        if table:
            extract_finance_table(
                builder,
                table,
                product_id=product_id,
                product_name=name,
                plan_id=plan_id,
                evidence_prefix=f"{name} finance card",
                qualifier={"basis": "base variant", "page": "finance"},
            )


def extract_dealers(builder: FactBuilder, root: Node) -> None:
    for card in root.find_all(class_name="dealer-card"):
        name_node = next((node for node in card.find_all(class_name="dealer-card__name")), None)
        if not name_node:
            continue
        name = name_node.collapsed_text()
        dealer_id = builder.entity("dealer", name)
        city = next((node for node in card.find_all(class_name="dealer-card__city")), None)
        if city:
            builder.add_fact(
                entity_id=dealer_id,
                entity_name=name,
                entity_type="dealer",
                fact_type="city",
                value=city.collapsed_text(),
                value_text=city.collapsed_text(),
                evidence=city.collapsed_text(),
                extraction_method="html.css:.dealer-card__city",
            )
        for detail in card.find_all(class_name="dealer-card__detail"):
            text = detail.collapsed_text()
            href_nodes = [node for node in detail.find_all("a")]
            href = href_nodes[0].get("href") if href_nodes else ""
            if href and href.startswith("tel:"):
                builder.add_fact(
                    entity_id=dealer_id,
                    entity_name=name,
                    entity_type="dealer",
                    fact_type="phone",
                    value=href_nodes[0].collapsed_text(),
                    value_text=href_nodes[0].collapsed_text(),
                    evidence=text,
                    extraction_method="html.css:.dealer-card a[href^=tel]",
                )
            elif href and href.startswith("mailto:"):
                builder.add_fact(
                    entity_id=dealer_id,
                    entity_name=name,
                    entity_type="dealer",
                    fact_type="email",
                    value=href_nodes[0].collapsed_text(),
                    value_text=href_nodes[0].collapsed_text(),
                    evidence=text,
                    extraction_method="html.css:.dealer-card a[href^=mailto]",
                )
            elif "AM" in text or "PM" in text or "Mon" in text:
                builder.add_fact(
                    entity_id=dealer_id,
                    entity_name=name,
                    entity_type="dealer",
                    fact_type="hours",
                    value=text,
                    value_text=text,
                    evidence=text,
                    extraction_method="html.css:.dealer-card__detail",
                )
            elif text:
                builder.add_fact(
                    entity_id=dealer_id,
                    entity_name=name,
                    entity_type="dealer",
                    fact_type="address",
                    value=text,
                    value_text=text,
                    evidence=text,
                    extraction_method="html.css:.dealer-card__detail",
                    status="verified" if any(ch.isdigit() for ch in text) else "ambiguous",
                )


def extract_faqs(builder: FactBuilder, root: Node) -> None:
    for index, item in enumerate(root.find_all(class_name="faq-item"), start=1):
        question_node = next((node for node in item.find_all(class_name="faq-question")), None)
        answer_node = next((node for node in item.find_all(class_name="faq-answer")), None)
        if not question_node:
            continue
        question = re.sub(r"^#\s*\d+\s*", "", question_node.collapsed_text()).strip()
        faq_id = builder.entity("faq", question, f"faq-{index}")
        builder.add_fact(
            entity_id=faq_id,
            entity_name=question,
            entity_type="faq",
            fact_type="question",
            value=question,
            value_text=question,
            evidence=question,
            extraction_method="html.css:.faq-question",
        )
        if answer_node:
            answer = answer_node.collapsed_text()
            builder.add_fact(
                entity_id=faq_id,
                entity_name=question,
                entity_type="faq",
                fact_type="answer",
                value=answer,
                value_text=answer,
                evidence=answer,
                extraction_method="html.css:.faq-answer",
            )


def extract_organization(builder: FactBuilder, root: Node, page_type: str) -> None:
    org_id = builder.entity("organization", "Apex Moto", "apex-moto")
    if page_type == "contact":
        for card in root.find_all(class_name="contact-info-card"):
            label = next((node for node in card.find_all(class_name="contact-info-card__label")), None)
            value = next((node for node in card.find_all(class_name="contact-info-card__value")), None)
            if not label or not value:
                continue
            label_text = label.collapsed_text().casefold()
            value_text = value.collapsed_text()
            fact_type = "offer_term"
            if "email" in label_text:
                fact_type = "email"
            elif "support" in label_text or "phone" in label_text:
                fact_type = "phone"
            elif "office" in label_text or "address" in label_text:
                fact_type = "address"
            builder.add_fact(
                entity_id=org_id,
                entity_name="Apex Moto",
                entity_type="organization",
                fact_type=fact_type,
                value=value_text,
                value_text=value_text,
                evidence=f"{label.collapsed_text()}: {value_text}",
                extraction_method="html.css:.contact-info-card",
            )
    if page_type == "about":
        h1 = next((node for node in root.find_all("h1")), None)
        if h1:
            builder.add_fact(
                entity_id=org_id,
                entity_name="Apex Moto",
                entity_type="organization",
                fact_type="tagline",
                value=h1.collapsed_text(),
                value_text=h1.collapsed_text(),
                evidence=h1.collapsed_text(),
                extraction_method="html.h1",
            )


def extract_booking(builder: FactBuilder, root: Node, query: dict[str, str]) -> None:
    bike = (query or {}).get("bike")
    if bike:
        name = bike.replace("-", " ").title()
        builder.entity("product", name, bike)
        builder.add_fact(
            entity_id=f"product:{bike}",
            entity_name=name,
            entity_type="product",
            fact_type="name",
            value=name,
            value_text=name,
            evidence=f"booking query bike={bike}",
            extraction_method="url.query.bike",
            status="verified",
            qualifier={"context": "booking_query"},
        )
    select = next((node for node in root.find_all("select") if node.get("name") == "motorcycle" or node.get("id") == "enq-moto"), None)
    # booking form motorcycle select may use name/id variants
    for node in root.find_all("select"):
        ident = (node.get("name") or "") + (node.get("id") or "")
        if "moto" in ident.casefold() or "bike" in ident.casefold() or "motorcycle" in ident.casefold():
            selected = None
            for option in node.find_all("option"):
                if option.get("selected") is not None and option.get("value"):
                    selected = option.get("value") or option.collapsed_text()
            if selected:
                slug = slugify(selected)
                builder.entity("product", selected, slug)


def maybe_jsonld_product(builder: FactBuilder, root: Node) -> None:
    for raw in script_jsonld_texts(root):
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        blocks = data if isinstance(data, list) else [data]
        for block in blocks:
            if not isinstance(block, dict):
                continue
            if block.get("@type") != "Product":
                continue
            name = str(block.get("name") or "")
            if not name:
                continue
            sku = str(block.get("sku") or slugify(name))
            product_id = builder.entity("product", name, sku)
            offers = block.get("offers") or {}
            price = offers.get("price") if isinstance(offers, dict) else None
            currency = offers.get("priceCurrency") if isinstance(offers, dict) else None
            if price is None:
                continue
            already = any(
                fact["entity_id"] == product_id
                and fact["fact_type"] in {"ex_showroom_price", "starting_price"}
                and fact.get("currency") == "INR"
                for fact in builder.facts
            )
            if already:
                continue
            builder.add_fact(
                entity_id=product_id,
                entity_name=name,
                entity_type="product",
                fact_type="ex_showroom_price",
                value=int(price) if float(price).is_integer() else float(price),
                value_text=str(price),
                unit=currency,
                currency=currency,
                evidence=raw[:240],
                extraction_method="jsonld.Product.offers",
                status="verified",
            )


def extract_structured_facts(
    html: str,
    *,
    url: str,
    final_url: str | None = None,
    page_type: str | None = None,
) -> dict[str, Any]:
    identity = classify_url(url, final_url)
    resolved_type = page_type or identity["page_type"]
    root = parse_html(html or "")
    builder = FactBuilder(identity["final_url"] or url)

    if resolved_type in {"homepage", "product_listing"}:
        extract_product_cards(builder, root)
        extract_organization(builder, root, resolved_type)
    elif resolved_type == "product_detail":
        extract_product_detail(builder, root)
        maybe_jsonld_product(builder, root)
    elif resolved_type == "offers":
        extract_offers(builder, root)
    elif resolved_type == "finance":
        extract_finance_page(builder, root)
    elif resolved_type in {"dealer_listing", "dealer_detail"}:
        extract_dealers(builder, root)
    elif resolved_type == "faq":
        extract_faqs(builder, root)
    elif resolved_type in {"about", "contact"}:
        extract_organization(builder, root, resolved_type)
    elif resolved_type == "booking":
        extract_booking(builder, root, identity["query"])
    else:
        extract_product_cards(builder, root)

    payload = builder.payload()
    payload["page_type"] = resolved_type
    payload["limitations"] = [
        "Facts come from semantic HTML containers on the saved rendered snapshot, not from pairing disconnected arrays.",
        "Amounts without a typed label or a unique enclosing entity are marked ambiguous or omitted.",
        "Derived discounts are never calculated.",
        "JSON-LD is used only when HTML did not already provide the same product price.",
    ]
    return payload


def facts_for(
    payload: dict[str, Any],
    *,
    entity_name: str | None = None,
    fact_type: str | None = None,
    value: Any = None,
    status: str | None = None,
) -> list[dict[str, Any]]:
    rows = payload.get("facts") or []
    out = []
    for fact in rows:
        if entity_name and str(fact.get("entity_name") or "").casefold() != entity_name.casefold():
            # allow variant / plan names that contain the product
            if entity_name.casefold() not in str(fact.get("entity_name") or "").casefold():
                if fact.get("related_entity_id") and entity_name.casefold().replace(" ", "-") not in str(fact.get("entity_id") or ""):
                    continue
        if fact_type and fact.get("fact_type") != fact_type:
            continue
        if value is not None and fact.get("value") != value:
            continue
        if status and fact.get("status") != status:
            continue
        out.append(fact)
    return out
