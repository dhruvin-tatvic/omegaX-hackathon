"""Build a derived structured-facts report from a saved Human View crawl.

Does not recrawl and does not overwrite original out/human-view-*.json files.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MODULE_DIR = Path(__file__).resolve().parent
REPO_ROOT = MODULE_DIR.parents[1]

if __package__ in {None, ""}:
    if str(MODULE_DIR) not in sys.path:
        sys.path.insert(0, str(MODULE_DIR))
    from page_classify import classify_url, human_stop_reason
    from structured_facts import SCHEMA_VERSION, extract_structured_facts
else:
    from .page_classify import classify_url, human_stop_reason
    from .structured_facts import SCHEMA_VERSION, extract_structured_facts


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def resolve_repo_path(rel: str | None) -> Path | None:
    if not rel:
        return None
    path = Path(rel)
    if not path.is_absolute():
        path = REPO_ROOT / path
    return path


def latest_site_report() -> Path | None:
    reports = sorted((REPO_ROOT / "out").glob("site-human-view-*.json"))
    reports = [path for path in reports if "structured" not in path.name]
    if not reports:
        return None
    return reports[-1]


def enrich_page(page: dict[str, Any], original_payload: dict[str, Any] | None, html: str | None) -> dict[str, Any]:
    identity = classify_url(page.get("url") or "", page.get("final_url"))
    structured = {
        "schema_version": SCHEMA_VERSION,
        "entities": [],
        "facts": [],
        "page_type": identity["page_type"],
        "limitations": ["Rendered HTML was missing; no facts extracted."],
    }
    if html:
        structured = extract_structured_facts(
            html,
            url=page.get("url") or "",
            final_url=page.get("final_url"),
            page_type=identity["page_type"],
        )
    enriched = dict(page)
    enriched.update(
        {
            "page_type": identity["page_type"],
            "page_type_reason": identity["page_type_reason"],
            "canonical_path": identity["canonical_path"],
            "canonical_url": identity["canonical_url"],
            "query": identity["query"],
            "structured_facts": structured,
            "original_json_path": page.get("json_path"),
            "original_content_preserved": bool(original_payload and "content" in original_payload),
        }
    )
    return enriched


def enrich_report(report: dict[str, Any], report_path: Path) -> dict[str, Any]:
    pages = []
    html_missing = []
    for page in report.get("pages") or []:
        json_path = resolve_repo_path(page.get("json_path"))
        html_path = resolve_repo_path(page.get("rendered_html_path"))
        original = load_json(json_path) if json_path and json_path.is_file() else None
        html = html_path.read_text(encoding="utf-8") if html_path and html_path.is_file() else None
        if html is None:
            html_missing.append(page.get("url"))
        pages.append(enrich_page(page, original, html))

    counts = Counter(str(page.get("page_type") or "other") for page in pages)
    warnings = list(report.get("warnings") or [])
    if html_missing:
        warnings.append(f"Rendered HTML missing for {len(html_missing)} page(s); facts skipped.")
    derived = {
        "schema_version": SCHEMA_VERSION,
        "derived_from": report_path.relative_to(REPO_ROOT).as_posix() if report_path.is_relative_to(REPO_ROOT) else str(report_path),
        "generated_at": utc_now(),
        "base_url": report.get("base_url"),
        "started_at": report.get("started_at"),
        "finished_at": report.get("finished_at"),
        "capture_method": report.get("capture_method"),
        "max_pages": report.get("max_pages"),
        "max_depth": report.get("max_depth"),
        "stopped_reason": report.get("stopped_reason"),
        "stopped_reason_label": human_stop_reason(report.get("stopped_reason")),
        "coverage_complete": report.get("coverage_complete"),
        "coverage_note": report.get("coverage_note")
        or "Queue exhaustion is not a claim of complete website coverage.",
        "total_pages_discovered": report.get("total_pages_discovered"),
        "total_pages_captured": report.get("total_pages_captured"),
        "total_pages_failed": report.get("total_pages_failed"),
        "page_type_counts": dict(counts),
        "pages": pages,
        "skipped": report.get("skipped") or [],
        "warnings": warnings,
        "errors": report.get("errors") or [],
        "limitations": [
            "This file is derived from saved rendered HTML. Original capture JSON was not overwritten.",
            "Robots-blocked, PDF, and external URLs remain in skipped[] and are not captured pages.",
            "Structured facts are evidence-backed; ambiguous associations are labelled, not guessed.",
        ],
    }
    return derived


def write_derived(derived: dict[str, Any], source_report: Path) -> Path:
    out_dir = REPO_ROOT / "out" / "derived"
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = source_report.stem.replace("site-human-view-", "")
    dest = out_dir / f"site-human-view-structured-{stamp}.json"
    dest.write_text(json.dumps(derived, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    pages_dir = out_dir / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    for page in derived["pages"]:
        slug = (page.get("canonical_path") or "/").strip("/").replace("/", "-") or "homepage"
        query = page.get("query") or {}
        if query.get("bike"):
            slug = f"{slug}-{query['bike']}"
        page_path = pages_dir / f"{slug}.json"
        export = {
            "schema_version": SCHEMA_VERSION,
            "url": page.get("url"),
            "final_url": page.get("final_url"),
            "page_type": page.get("page_type"),
            "page_type_reason": page.get("page_type_reason"),
            "canonical_path": page.get("canonical_path"),
            "canonical_url": page.get("canonical_url"),
            "query": page.get("query"),
            "original_json_path": page.get("original_json_path"),
            "screenshot_path": page.get("screenshot_path"),
            "rendered_html_path": page.get("rendered_html_path"),
            "structured_facts": page.get("structured_facts"),
        }
        page_path.write_text(json.dumps(export, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        page["derived_json_path"] = page_path.relative_to(REPO_ROOT).as_posix()
    dest.write_text(json.dumps(derived, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return dest


def main() -> int:
    parser = argparse.ArgumentParser(description="Enrich a saved Human View site report with structured facts.")
    parser.add_argument("--report", default=None, help="Path to site-human-view-*.json (default: latest in out/)")
    args = parser.parse_args()
    report_path = Path(args.report) if args.report else latest_site_report()
    if report_path is None:
        print("No site-human-view-*.json found under out/", file=sys.stderr)
        return 1
    if not report_path.is_absolute():
        report_path = (Path.cwd() / report_path).resolve()
    report = load_json(report_path)
    derived = enrich_report(report, report_path)
    dest = write_derived(derived, report_path)
    print(dest.relative_to(REPO_ROOT).as_posix())
    print(json.dumps(derived.get("page_type_counts"), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
