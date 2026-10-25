"""Build one JSON file that embeds a completed Human View crawl.

Does not recrawl and does not change extraction or page-classification logic.
Reads the site report plus per-page JSON, rendered HTML, screenshots, and
(when present) the derived structured-facts report used by the dashboard.
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

MODULE_DIR = Path(__file__).resolve().parent
REPO_ROOT = MODULE_DIR.parents[1]
DEFAULT_CONFIG_PATH = MODULE_DIR / "config.json"

if __package__ in {None, ""}:
    if str(MODULE_DIR) not in sys.path:
        sys.path.insert(0, str(MODULE_DIR))
    from page_classify import classify_url, human_stop_reason
    from structured_facts import SCHEMA_VERSION, extract_structured_facts
else:
    from .page_classify import classify_url, human_stop_reason
    from .structured_facts import SCHEMA_VERSION, extract_structured_facts

UNAVAILABLE_FIELDS = [
    {
        "field": "meta_description",
        "reason": "The collector never stored HTML <meta name=description>.",
    },
    {
        "field": "html_canonical_link",
        "reason": "The collector never parsed <link rel=canonical>; canonical_path is from the captured URL only.",
    },
    {
        "field": "robots_meta",
        "reason": "Per-page robots meta directives were not extracted. robots.txt was applied during crawl but the file body was not saved.",
    },
    {
        "field": "http_content_type",
        "reason": "Playwright capture records HTTP status, not Content-Type.",
    },
    {
        "field": "paragraphs_array",
        "reason": "Paragraphs are not a separate field; full visible text is in content.visible_text.",
    },
    {
        "field": "frozen_timeout_config",
        "reason": "The site report stores max_pages/max_depth only. Timeout/scroll/tab settings are included from config.json at consolidation time.",
    },
]


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.strptime(str(value).replace("Z", ""), "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def duration_seconds(started: str | None, finished: str | None) -> float | None:
    start = parse_iso(started)
    end = parse_iso(finished)
    if not start or not end:
        return None
    return round((end - start).total_seconds(), 3)


def resolve_repo_path(rel: str | None) -> Path | None:
    if not rel:
        return None
    path = Path(rel)
    if not path.is_absolute():
        path = REPO_ROOT / path
    return path


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def load_config(path: Path | None = None) -> dict[str, Any]:
    config_path = path or DEFAULT_CONFIG_PATH
    if not config_path.is_file():
        return {}
    return json.loads(config_path.read_text(encoding="utf-8"))


def latest_site_report() -> Path | None:
    reports = sorted((REPO_ROOT / "out").glob("site-human-view-*.json"))
    reports = [path for path in reports if "structured" not in path.name]
    if not reports:
        return None
    return reports[-1]


def matching_derived_report(site_report_path: Path) -> Path | None:
    stamp = site_report_path.stem.replace("site-human-view-", "")
    candidate = REPO_ROOT / "out" / "derived" / f"site-human-view-structured-{stamp}.json"
    if candidate.is_file():
        return candidate
    return None


def read_text_artifact(rel: str | None) -> tuple[str | None, str | None]:
    path = resolve_repo_path(rel)
    if path is None:
        return None, "no_path"
    if not path.is_file():
        return None, f"missing_file:{rel}"
    return path.read_text(encoding="utf-8", errors="replace"), None


def read_binary_artifact(rel: str | None) -> tuple[dict[str, Any] | None, str | None]:
    path = resolve_repo_path(rel)
    if path is None:
        return None, "no_path"
    if not path.is_file():
        return None, f"missing_file:{rel}"
    data = path.read_bytes()
    media_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    return {
        "path": rel,
        "media_type": media_type,
        "encoding": "base64",
        "byte_length": len(data),
        "data": base64.b64encode(data).decode("ascii"),
    }, None


def derived_page_index(derived: dict[str, Any] | None) -> dict[tuple[str, str], dict[str, Any]]:
    index: dict[tuple[str, str], dict[str, Any]] = {}
    if not derived:
        return index
    for page in derived.get("pages") or []:
        key = (str(page.get("url") or ""), str(page.get("final_url") or ""))
        index[key] = page
    return index


def structured_for_page(page: dict[str, Any], html: str | None, derived_page: dict[str, Any] | None) -> dict[str, Any]:
    identity = classify_url(page.get("url") or "", page.get("final_url"))
    if derived_page and isinstance(derived_page.get("structured_facts"), dict):
        payload = dict(derived_page["structured_facts"])
        payload.setdefault("page_type", derived_page.get("page_type") or identity["page_type"])
        return payload
    if html:
        return extract_structured_facts(
            html,
            url=page.get("url") or "",
            final_url=page.get("final_url"),
            page_type=identity["page_type"],
        )
    return {
        "schema_version": SCHEMA_VERSION,
        "entities": [],
        "facts": [],
        "page_type": identity["page_type"],
        "limitations": ["Rendered HTML was missing; no facts extracted."],
    }


def build_page_record(
    page: dict[str, Any],
    *,
    original: dict[str, Any] | None,
    html: str | None,
    html_error: str | None,
    screenshot: dict[str, Any] | None,
    screenshot_error: str | None,
    derived_page: dict[str, Any] | None,
) -> dict[str, Any]:
    identity = classify_url(page.get("url") or "", page.get("final_url"))
    if derived_page:
        identity["page_type"] = derived_page.get("page_type") or identity["page_type"]
        identity["page_type_reason"] = derived_page.get("page_type_reason") or identity["page_type_reason"]
        identity["canonical_path"] = derived_page.get("canonical_path") or identity["canonical_path"]
        identity["canonical_url"] = derived_page.get("canonical_url") or identity["canonical_url"]
        identity["query"] = derived_page.get("query") if derived_page.get("query") is not None else identity["query"]

    capture = original or {}
    content = capture.get("content") if isinstance(capture.get("content"), dict) else {}
    requested = page.get("url") or capture.get("url")
    final = page.get("final_url") or capture.get("final_url") or requested
    facts_payload = structured_for_page(page, html, derived_page)
    artifact_notes = []
    if html_error:
        artifact_notes.append(f"rendered_html:{html_error}")
    if screenshot_error:
        artifact_notes.append(f"screenshot:{screenshot_error}")
    if original is None and page.get("json_path"):
        artifact_notes.append(f"original_json:missing_file:{page.get('json_path')}")

    return {
        "url": requested,
        "final_url": final,
        "status": page.get("status") or capture.get("status"),
        "depth": page.get("depth"),
        "http": {
            "status": page.get("http_status") if page.get("http_status") is not None else capture.get("http_status"),
            "redirected": bool(requested and final and str(requested).rstrip("/") != str(final).rstrip("/")),
            "requested_url": requested,
            "final_url": final,
        },
        "metadata": {
            "page_title": page.get("page_title") or capture.get("page_title"),
            "captured_at": capture.get("captured_at"),
            "capture_method": capture.get("capture_method") or page.get("capture_method"),
            "viewport": capture.get("viewport"),
            "page_type": identity["page_type"],
            "page_type_reason": identity["page_type_reason"],
            "canonical_path": identity["canonical_path"],
            "canonical_url": identity["canonical_url"],
            "query": identity["query"],
        },
        "content": content,
        "headings": content.get("headings") or [],
        "links": content.get("links") or [],
        "images": content.get("images") or [],
        "tables": content.get("tables") or [],
        "product_data": {
            "product_names": content.get("product_names") or page.get("product_names") or [],
            "prices": content.get("prices") or [],
            "product_descriptions": content.get("product_descriptions") or [],
            "specifications": content.get("specifications") or [],
            "primary_product": content.get("primary_product"),
            "related_products": content.get("related_products") or [],
        },
        "structured_data": facts_payload.get("entities") or [],
        "structured_facts": facts_payload,
        "readability": {
            "visible_text": content.get("visible_text") or "",
            "visible_text_characters": len(str(content.get("visible_text") or "")),
            "headings": content.get("headings") or [],
            "limitations": capture.get("limitations") or [],
            "page_type": identity["page_type"],
            "page_type_reason": identity["page_type_reason"],
            "dashboard_fields": {
                "page_title": page.get("page_title") or capture.get("page_title"),
                "url": requested,
                "final_url": final,
                "status": page.get("status") or capture.get("status"),
                "screenshot_path": page.get("screenshot_path") or capture.get("screenshot_path"),
                "rendered_html_path": page.get("rendered_html_path") or capture.get("rendered_html_path"),
                "json_path": page.get("json_path") or capture.get("json_path"),
            },
        },
        "rendered_html": html,
        "screenshot": screenshot,
        "original_capture": capture,
        "source_paths": {
            "json_path": page.get("json_path") or capture.get("json_path"),
            "screenshot_path": page.get("screenshot_path") or capture.get("screenshot_path"),
            "rendered_html_path": page.get("rendered_html_path") or capture.get("rendered_html_path"),
        },
        "errors": page.get("errors") or capture.get("errors") or [],
        "warnings": artifact_notes,
        "artifact_notes": artifact_notes,
    }


def consolidate(
    report: dict[str, Any],
    report_path: Path,
    *,
    config: dict[str, Any] | None = None,
    derived: dict[str, Any] | None = None,
) -> dict[str, Any]:
    cfg = config if config is not None else load_config()
    derived_index = derived_page_index(derived)
    pages_out: list[dict[str, Any]] = []
    missing: list[str] = []

    for page in report.get("pages") or []:
        json_path = resolve_repo_path(page.get("json_path"))
        original = None
        if json_path and json_path.is_file():
            original = load_json(json_path)
        html, html_error = read_text_artifact(page.get("rendered_html_path"))
        screenshot, screenshot_error = read_binary_artifact(page.get("screenshot_path"))
        if html_error:
            missing.append(f"{page.get('url')}: {html_error}")
        if screenshot_error:
            missing.append(f"{page.get('url')}: {screenshot_error}")
        if original is None and page.get("json_path"):
            missing.append(f"{page.get('url')}: missing {page.get('json_path')}")
        derived_page = derived_index.get((str(page.get("url") or ""), str(page.get("final_url") or "")))
        pages_out.append(
            build_page_record(
                page,
                original=original,
                html=html,
                html_error=html_error,
                screenshot=screenshot,
                screenshot_error=screenshot_error,
                derived_page=derived_page,
            )
        )

    successful = [page for page in pages_out if page.get("status") == "success"]
    failed = [page for page in pages_out if page.get("status") != "success"]
    skipped = list(report.get("skipped") or [])
    discovered = []
    seen_disc: set[str] = set()
    for page in report.get("pages") or []:
        for key in ("url", "final_url"):
            value = page.get(key)
            if value and value not in seen_disc:
                seen_disc.add(value)
                discovered.append(value)
    for item in skipped:
        value = item.get("url") if isinstance(item, dict) else None
        if value and value not in seen_disc:
            seen_disc.add(value)
            discovered.append(value)

    page_type_counts = (derived or {}).get("page_type_counts")
    if not page_type_counts:
        counts: dict[str, int] = {}
        for page in pages_out:
            key = str((page.get("metadata") or {}).get("page_type") or "other")
            counts[key] = counts.get(key, 0) + 1
        page_type_counts = counts

    rel_report = report_path.relative_to(REPO_ROOT).as_posix() if report_path.is_relative_to(REPO_ROOT) else str(report_path)
    payload = {
        "schema_version": "1.0",
        "generated_at": utc_now(),
        "generator": "agents/readability/consolidate_report.py",
        "crawl_metadata": {
            "base_url": report.get("base_url"),
            "started_at": report.get("started_at"),
            "finished_at": report.get("finished_at"),
            "duration_seconds": duration_seconds(report.get("started_at"), report.get("finished_at")),
            "capture_method": report.get("capture_method"),
            "source_site_report": rel_report,
            "source_derived_report": None,
            "execution_status": report.get("stopped_reason"),
        },
        "crawl_configuration": {
            "recorded_in_report": {
                "max_pages": report.get("max_pages"),
                "max_depth": report.get("max_depth"),
                "capture_method": report.get("capture_method"),
            },
            "config_file_at_generation": cfg,
            "note": "Timeout, scroll, and tab settings were not stored inside the site report. config_file_at_generation is the current agents/readability/config.json.",
        },
        "crawl_summary": {
            "total_pages_discovered": report.get("total_pages_discovered"),
            "total_pages_captured": report.get("total_pages_captured"),
            "total_pages_failed": report.get("total_pages_failed"),
            "pages_in_report": len(report.get("pages") or []),
            "skipped_entries": len(skipped),
            "page_records_exported": len(pages_out),
            "successful_pages": len(successful),
            "failed_pages": len(failed),
            "stopped_reason": report.get("stopped_reason"),
            "stopped_reason_label": human_stop_reason(report.get("stopped_reason")),
        },
        "coverage": {
            "stopped_reason": report.get("stopped_reason"),
            "stopped_reason_label": human_stop_reason(report.get("stopped_reason")),
            "coverage_complete": report.get("coverage_complete"),
            "coverage_note": report.get("coverage_note"),
            "max_pages": report.get("max_pages"),
            "max_depth": report.get("max_depth"),
            "page_limit_reached": report.get("stopped_reason") == "page_limit",
            "queue_exhausted": report.get("stopped_reason") == "queue_exhausted",
            "full_site_coverage_claimed": False,
            "page_type_counts": page_type_counts,
        },
        "discovered_urls": discovered,
        "visited_urls": [page.get("url") for page in report.get("pages") or []],
        "pages": pages_out,
        "skipped_urls": skipped,
        "failed_urls": [
            {
                "url": page.get("url"),
                "final_url": page.get("final_url"),
                "status": page.get("status"),
                "errors": page.get("errors") or [],
            }
            for page in failed
        ],
        "global_errors": report.get("errors") or [],
        "global_warnings": report.get("warnings") or [],
        "additional_crawler_data": {
            "unavailable_fields": UNAVAILABLE_FIELDS,
            "missing_artifacts": missing,
            "original_site_report_fields": {
                "base_url": report.get("base_url"),
                "started_at": report.get("started_at"),
                "finished_at": report.get("finished_at"),
                "capture_method": report.get("capture_method"),
                "max_pages": report.get("max_pages"),
                "max_depth": report.get("max_depth"),
                "stopped_reason": report.get("stopped_reason"),
                "total_pages_discovered": report.get("total_pages_discovered"),
                "total_pages_captured": report.get("total_pages_captured"),
                "total_pages_failed": report.get("total_pages_failed"),
                "coverage_complete": report.get("coverage_complete"),
                "coverage_note": report.get("coverage_note"),
            },
            "dashboard_source": {
                "review_dashboard": "agents/readability/review_dashboard/",
                "manifest_typically": "agents/readability/review_dashboard/manifest.json",
                "derived_report_used": None,
            },
        },
    }
    if derived:
        derived_path = matching_derived_report(report_path)
        rel_derived = None
        if derived_path:
            rel_derived = derived_path.relative_to(REPO_ROOT).as_posix()
        payload["crawl_metadata"]["source_derived_report"] = rel_derived
        payload["additional_crawler_data"]["dashboard_source"]["derived_report_used"] = rel_derived
        payload["additional_crawler_data"]["derived_report_summary"] = {
            "schema_version": derived.get("schema_version"),
            "generated_at": derived.get("generated_at"),
            "page_type_counts": derived.get("page_type_counts"),
            "warnings": derived.get("warnings"),
            "limitations": derived.get("limitations"),
        }
    return payload


def default_output_path(report_path: Path) -> Path:
    stamp = report_path.stem.replace("site-human-view-", "")
    return report_path.parent / f"playwright-crawl-complete-{stamp}.json"


def write_consolidated(
    report_path: Path,
    output_path: Path | None = None,
    *,
    config: dict[str, Any] | None = None,
) -> Path:
    report = load_json(report_path)
    derived_path = matching_derived_report(report_path)
    derived = load_json(derived_path) if derived_path else None
    payload = consolidate(report, report_path, config=config, derived=derived)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    stamped = default_output_path(report_path)
    stamped.parent.mkdir(parents=True, exist_ok=True)
    stamped.write_text(text, encoding="utf-8")
    alias = stamped.parent / "playwright-crawl-complete.json"
    if alias.resolve() != stamped.resolve():
        alias.write_text(text, encoding="utf-8")
    if output_path:
        dest = output_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        if dest.resolve() != stamped.resolve() and dest.resolve() != alias.resolve():
            dest.write_text(text, encoding="utf-8")
        return dest
    return stamped


def write_consolidated_from_report(
    report: dict[str, Any],
    report_path: Path,
    *,
    config: dict[str, Any] | None = None,
) -> Path:
    derived_path = matching_derived_report(report_path)
    derived = load_json(derived_path) if derived_path else None
    payload = consolidate(report, report_path, config=config, derived=derived)
    dest = default_output_path(report_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    dest.write_text(text, encoding="utf-8")
    alias = dest.parent / "playwright-crawl-complete.json"
    if dest.resolve() != alias.resolve():
        alias.write_text(text, encoding="utf-8")
    return dest


def main() -> int:
    parser = argparse.ArgumentParser(description="Embed a completed Human View crawl into one JSON file.")
    parser.add_argument("--report", default=None, help="Path to site-human-view-*.json (default: latest under out/)")
    parser.add_argument("--output", default=None, help="Output JSON path")
    args = parser.parse_args()
    report_path = Path(args.report) if args.report else latest_site_report()
    if report_path is None:
        print("No site-human-view-*.json found.", file=sys.stderr)
        return 1
    if not report_path.is_absolute():
        report_path = (Path.cwd() / report_path).resolve()
    output = Path(args.output) if args.output else None
    if output and not output.is_absolute():
        output = (Path.cwd() / output).resolve()
    dest = write_consolidated(report_path, output)
    print(dest.relative_to(REPO_ROOT).as_posix() if dest.is_relative_to(REPO_ROOT) else str(dest))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
