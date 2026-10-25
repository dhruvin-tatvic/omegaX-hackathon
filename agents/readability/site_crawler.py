#!/usr/bin/env python3
"""Discover internal pages and capture a Human View for each one.

Starts from a homepage URL. Discovers links from rendered pages (not a hardcoded
catalogue). Reuses capture_human_view() for extraction.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse
from urllib.request import Request, urlopen
from xml.etree import ElementTree

MODULE_DIR = Path(__file__).resolve().parent
REPO_ROOT = MODULE_DIR.parents[1]
DEFAULT_CONFIG_PATH = MODULE_DIR / "config.json"

if __package__ in {None, ""}:
    if str(MODULE_DIR) not in sys.path:
        sys.path.insert(0, str(MODULE_DIR))
    from human_view import capture_human_view, load_config, relative_to_repo, resolve_output_dir
else:
    from .human_view import capture_human_view, load_config, relative_to_repo, resolve_output_dir

SKIP_SCHEMES = {"mailto", "tel", "javascript", "data", "blob", "file"}
BINARY_EXTENSIONS = {
    ".pdf",
    ".zip",
    ".gz",
    ".tar",
    ".7z",
    ".rar",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".bmp",
    ".mp4",
    ".webm",
    ".mp3",
    ".wav",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".css",
    ".js",
    ".map",
    ".json",
    ".xml",
    ".csv",
    ".xls",
    ".xlsx",
    ".doc",
    ".docx",
}
SKIP_PATH_TOKENS = {"logout", "log-out", "signout", "sign-out", "sign_out"}
DEFAULT_DROP_QUERY = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def isoformat_z(moment: datetime) -> str:
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def timestamp_slug(moment: datetime) -> str:
    return moment.strftime("%Y%m%d-%H%M%S")


def strip_www(host: str) -> str:
    host = (host or "").lower().rstrip(".")
    return host[4:] if host.startswith("www.") else host


def same_site(url: str, base_url: str) -> bool:
    left = urlparse(url)
    right = urlparse(base_url)
    if left.scheme not in {"http", "https"}:
        return False
    if strip_www(left.hostname or "") != strip_www(right.hostname or ""):
        return False
    left_port = left.port or (443 if left.scheme == "https" else 80)
    right_port = right.port or (443 if right.scheme == "https" else 80)
    return left_port == right_port


def path_extension(path: str) -> str:
    name = (path or "").rsplit("/", 1)[-1]
    if "." not in name:
        return ""
    return "." + name.rsplit(".", 1)[-1].lower()


def classify_skip_reason(url: str, base_url: str, drop_query: set[str]) -> str | None:
    raw = (url or "").strip()
    if not raw or raw == "#":
        return "empty_or_fragment"
    parsed = urlparse(urljoin(base_url, raw))
    scheme = (parsed.scheme or "").lower()
    if scheme in SKIP_SCHEMES:
        return f"non_page_scheme:{scheme or 'unknown'}"
    if scheme not in {"http", "https"}:
        return "non_http"
    if not same_site(parsed.geturl(), base_url):
        return "external"
    path = parsed.path or "/"
    tokens = {part.lower() for part in path.split("/") if part}
    if tokens & SKIP_PATH_TOKENS:
        return "logout_or_session"
    ext = path_extension(path)
    if ext in BINARY_EXTENSIONS:
        return f"binary_asset:{ext}"
    _ = drop_query
    return None


def normalize_url(url: str, base_url: str, drop_query: set[str]) -> str | None:
    joined = urljoin(base_url, url)
    parsed = urlparse(joined)
    if parsed.scheme not in {"http", "https"}:
        return None
    path = parsed.path or "/"
    path = "/" + "/".join(part for part in path.split("/") if part != "")
    if parsed.path.endswith("/") and path != "/":
        # Collapse duplicate slashes but keep a single trailing slash only for root.
        path = path
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    pairs = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=False)
        if key.lower() not in drop_query
    ]
    pairs.sort()
    netloc = parsed.netloc.lower()
    return urlunparse((parsed.scheme.lower(), netloc, path, "", urlencode(pairs), ""))


def fetch_text(url: str, user_agent: str, timeout: int = 15) -> tuple[str | None, str | None]:
    request = Request(url, headers={"User-Agent": user_agent})
    try:
        with urlopen(request, timeout=timeout) as response:
            charset = response.headers.get_content_charset() or "utf-8"
            return response.read().decode(charset, errors="replace"), None
    except HTTPError as exc:
        return None, f"HTTP {exc.code} fetching {url}"
    except (URLError, TimeoutError, OSError) as exc:
        return None, f"Could not fetch {url}: {exc}"


def parse_robots(text: str) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    current: dict[str, Any] = {"agents": [], "rules": [], "sitemaps": []}
    sitemaps: list[str] = []
    for raw_line in StringIO_lines(text):
        line = raw_line.split("#", 1)[0].strip()
        if not line:
            continue
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip().lower()
        value = value.strip()
        if key == "user-agent":
            if current["rules"] or (current["agents"] and current["agents"] != [value.lower()]):
                groups.append(current)
                current = {"agents": [value.lower()], "rules": [], "sitemaps": []}
            else:
                current["agents"].append(value.lower())
        elif key in {"allow", "disallow"}:
            current["rules"].append({"type": key, "path": value or "/"})
        elif key == "sitemap" and value:
            sitemaps.append(value)
    if current["agents"] or current["rules"]:
        groups.append(current)
    for group in groups:
        group["sitemaps"] = sitemaps
    if not groups:
        return [{"agents": ["*"], "rules": [], "sitemaps": sitemaps}]
    return groups


def StringIO_lines(text: str) -> list[str]:
    return str(text or "").splitlines()


def robots_path_allowed(pathname: str, robots_text: str | None, user_agent: str) -> bool:
    if not robots_text:
        return True
    groups = parse_robots(robots_text)
    ua = user_agent.lower()
    matching = next((group for group in groups if any(agent != "*" and agent in ua for agent in group["agents"])), None)
    if matching is None:
        matching = next((group for group in groups if "*" in group["agents"]), None)
    if matching is None:
        return True
    path = pathname or "/"
    matches: list[tuple[int, str]] = []
    for rule in matching["rules"]:
        rule_path = rule.get("path") or ""
        if not rule_path:
            continue
        if path.startswith(rule_path):
            matches.append((len(rule_path), rule["type"]))
    if not matches:
        return True
    matches.sort(key=lambda item: (item[0], 0 if item[1] == "allow" else 1), reverse=True)
    return matches[0][1] == "allow"


COVERAGE_NOTE = (
    "coverage_complete is true only when stopped_reason is queue_exhausted and "
    "every captured page succeeded. It is not a claim of complete website coverage. "
    "Use stopped_reason as the primary completion signal. Skipped robots paths, "
    "PDFs, external URLs, and sitemap warnings are out of scope."
)


def sitemap_locs(xml_text: str) -> list[str]:
    locs: list[str] = []
    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError:
        return locs
    for node in root.iter():
        tag = node.tag.lower()
        if tag.endswith("loc") and node.text:
            locs.append(node.text.strip())
    return locs


def write_json(payload: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def finalize_report(report: dict[str, Any], report_path: Path, config: dict[str, Any] | None = None) -> dict[str, Any]:
    """Persist the site report, then embed artifacts into one JSON file."""
    write_json(report, report_path)
    report["report_path"] = relative_to_repo(report_path)
    try:
        if __package__ in {None, ""}:
            from consolidate_report import write_consolidated_from_report
        else:
            from .consolidate_report import write_consolidated_from_report
        consolidated = write_consolidated_from_report(report, report_path, config=config)
        report["consolidated_json_path"] = relative_to_repo(consolidated)
        print(f"Consolidated JSON: {report['consolidated_json_path']}")
    except Exception as exc:  # noqa: BLE001 — crawl results already written
        print(f"Consolidation skipped: {exc}", file=sys.stderr)
    return report


def page_summary(result: dict[str, Any]) -> dict[str, Any]:
    content = result.get("content") or {}
    primary = content.get("primary_product")
    return {
        "url": result.get("url"),
        "final_url": result.get("final_url"),
        "status": result.get("status"),
        "http_status": result.get("http_status"),
        "page_title": result.get("page_title"),
        "json_path": result.get("json_path"),
        "screenshot_path": result.get("screenshot_path"),
        "rendered_html_path": result.get("rendered_html_path"),
        "product_names": content.get("product_names") or [],
        "primary_product": (primary or {}).get("name") if isinstance(primary, dict) else None,
        "errors": result.get("errors") or [],
    }


def crawl_site(
    url: str,
    config: dict[str, Any] | None = None,
    output_dir: str | Path | None = None,
    max_pages: int | None = None,
    max_depth: int | None = None,
) -> dict[str, Any]:
    cfg = config or load_config()
    crawl_cfg = cfg.get("crawl") or {}
    user_agent = cfg.get("user_agent") or "OmegaXHumanViewCollector/0.1"
    drop_query = {item.lower() for item in (crawl_cfg.get("drop_query_params") or list(DEFAULT_DROP_QUERY))}
    page_limit = int(max_pages if max_pages is not None else crawl_cfg.get("max_pages", 100))
    depth_limit = int(max_depth if max_depth is not None else crawl_cfg.get("max_depth", 5))
    delay_ms = int(crawl_cfg.get("delay_ms", 800))
    respect_robots = bool(crawl_cfg.get("respect_robots", True))

    started = utc_now()
    dirs = resolve_output_dir(cfg, str(output_dir) if output_dir else None)
    dirs.mkdir(parents=True, exist_ok=True)
    report_path = dirs / f"site-human-view-{timestamp_slug(started)}.json"

    seed = normalize_url(url, url, drop_query)
    report: dict[str, Any] = {
        "base_url": seed or url,
        "started_at": isoformat_z(started),
        "finished_at": None,
        "capture_method": "playwright_chromium",
        "max_pages": page_limit,
        "max_depth": depth_limit,
        "stopped_reason": None,
        "total_pages_discovered": 0,
        "total_pages_captured": 0,
        "total_pages_failed": 0,
        "pages": [],
        "skipped": [],
        "warnings": [],
        "errors": [],
        "coverage_complete": False,
        "coverage_note": COVERAGE_NOTE,
    }
    if not seed:
        report["errors"].append("Start URL could not be normalized.")
        report["stopped_reason"] = "invalid_start_url"
        report["finished_at"] = isoformat_z(utc_now())
        return finalize_report(report, report_path, cfg)

    robots_text = None
    sitemap_candidates: list[str] = []
    if respect_robots:
        robots_url = urljoin(seed, "/robots.txt")
        robots_text, robots_error = fetch_text(robots_url, user_agent)
        if robots_error:
            report["errors"].append(robots_error)
        if robots_text:
            groups = parse_robots(robots_text)
            seen_maps: set[str] = set()
            for group in groups:
                for sitemap in group.get("sitemaps") or []:
                    if sitemap in seen_maps:
                        continue
                    seen_maps.add(sitemap)
                    sitemap_candidates.append(sitemap)

    origin_sitemap = urljoin(seed, "/sitemap.xml")
    if origin_sitemap not in sitemap_candidates:
        sitemap_candidates.append(origin_sitemap)

    queue: deque[tuple[str, int]] = deque()
    queued: set[str] = set()
    visited: set[str] = set()
    discovered: set[str] = set()
    skipped_keys: set[tuple[str, str]] = set()

    def remember_skip(target: str, reason: str, depth: int | None = None) -> None:
        key = (target, reason)
        if key in skipped_keys:
            return
        skipped_keys.add(key)
        report["skipped"].append({"url": target, "reason": reason, "depth": depth})

    def enqueue(candidate: str, depth: int, _source: str) -> None:
        skip = classify_skip_reason(candidate, seed, drop_query)
        if skip:
            remember_skip(candidate, skip, depth)
            return
        normalized = normalize_url(candidate, seed, drop_query)
        if not normalized:
            remember_skip(candidate, "unnormalizable", depth)
            return
        discovered.add(normalized)
        if normalized in queued or normalized in visited:
            return
        if depth > depth_limit:
            remember_skip(normalized, "max_depth", depth)
            return
        parsed = urlparse(normalized)
        if respect_robots and not robots_path_allowed(parsed.path or "/", robots_text, user_agent):
            remember_skip(normalized, "robots_disallow", depth)
            return
        queued.add(normalized)
        queue.append((normalized, depth))

    sitemap_urls: list[str] = []
    for sitemap in sitemap_candidates:
        if not same_site(sitemap, seed):
            remember_skip(sitemap, "external_sitemap", 1)
            report["warnings"].append(f"Skipped external sitemap: {sitemap}")
            continue
        xml, sitemap_error = fetch_text(sitemap, user_agent)
        if sitemap_error:
            remember_skip(sitemap, "sitemap_unavailable", 1)
            report["warnings"].append(sitemap_error)
            continue
        if not xml:
            remember_skip(sitemap, "sitemap_unavailable", 1)
            report["warnings"].append(f"Empty sitemap: {sitemap}")
            continue
        for loc in sitemap_locs(xml):
            if not same_site(loc, seed):
                remember_skip(loc, "external", 1)
                continue
            sitemap_urls.append(loc)

    enqueue(seed, 0, "start")
    for sitemap_url in sitemap_urls:
        enqueue(sitemap_url, 1, "sitemap")

    captured = 0
    while queue:
        if captured >= page_limit:
            report["stopped_reason"] = "page_limit"
            while queue:
                leftover, leftover_depth = queue.popleft()
                remember_skip(leftover, "page_limit", leftover_depth)
            break
        current, depth = queue.popleft()
        if current in visited:
            remember_skip(current, "duplicate", depth)
            continue
        visited.add(current)

        if captured:
            time.sleep(max(0, delay_ms) / 1000.0)

        print(f"[{captured + 1}/{page_limit}] depth={depth} {current}")
        try:
            result = capture_human_view(current, config=cfg, output_dir=dirs)
        except Exception as exc:  # noqa: BLE001
            result = {
                "url": current,
                "final_url": current,
                "status": "error",
                "errors": [f"Collector raised: {exc}"],
                "json_path": None,
                "screenshot_path": None,
                "rendered_html_path": None,
                "content": {},
            }

        summary = page_summary(result)
        summary["depth"] = depth
        report["pages"].append(summary)
        captured += 1
        status = result.get("status")
        if status == "success":
            report["total_pages_captured"] += 1
        else:
            report["total_pages_failed"] += 1
            for item in result.get("errors") or []:
                report["errors"].append(f"{current}: {item}")

        final_url = result.get("final_url") or current
        final_norm = normalize_url(final_url, seed, drop_query)
        if final_norm:
            visited.add(final_norm)
            discovered.add(final_norm)

        if depth < depth_limit:
            for link in (result.get("content") or {}).get("links") or []:
                href = link.get("href") if isinstance(link, dict) else None
                if href:
                    enqueue(str(href), depth + 1, current)

    if report["stopped_reason"] is None:
        report["stopped_reason"] = "queue_exhausted"

    report["total_pages_discovered"] = len(discovered)
    report["finished_at"] = isoformat_z(utc_now())
    report["coverage_complete"] = report["stopped_reason"] == "queue_exhausted" and report["total_pages_failed"] == 0
    report["coverage_note"] = COVERAGE_NOTE
    return finalize_report(report, report_path, cfg)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Discover internal pages from a homepage and capture a Human View for each."
    )
    parser.add_argument("--url", default=None, help="Homepage URL (defaults to config.json default_url).")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG_PATH), help="Path to JSON config file.")
    parser.add_argument("--output-dir", default=None, help="Directory for per-page artifacts and the site report.")
    parser.add_argument("--max-pages", type=int, default=None, help="Safety limit on pages to capture.")
    parser.add_argument("--max-depth", type=int, default=None, help="Safety limit on link-follow depth from the start URL.")
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

    print(f"Crawling human view from: {url}")
    report = crawl_site(
        url,
        config=config,
        output_dir=args.output_dir,
        max_pages=args.max_pages,
        max_depth=args.max_depth,
    )
    print(f"Stopped (primary): {report.get('stopped_reason')}")
    print(f"Discovered: {report.get('total_pages_discovered')}")
    print(f"Captured successfully: {report.get('total_pages_captured')}")
    print(f"Failed page captures: {report.get('total_pages_failed')}")
    print(f"Skipped entries: {len(report.get('skipped') or [])}")
    print(f"Warnings: {len(report.get('warnings') or [])}")
    print(
        "Queue-empty and captures succeeded "
        f"(not full-site coverage): {report.get('coverage_complete')}"
    )
    for warning in report.get("warnings") or []:
        print(f"  warning: {warning}")
    if report.get("report_path"):
        print(f"Report: {report['report_path']}")
    return 0 if report.get("total_pages_captured") else 1


if __name__ == "__main__":
    sys.exit(main())
