#!/usr/bin/env python3
"""Write manifest.json pointing at the latest site-human-view report.

Run from the repository root (or anywhere). Does not crawl. Stdlib only.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

DASHBOARD_DIR = Path(__file__).resolve().parent
REPO_ROOT = DASHBOARD_DIR.parents[2]
OUT_DIR = REPO_ROOT / "out"
MANIFEST_PATH = DASHBOARD_DIR / "manifest.json"


def latest_report() -> Path | None:
    derived = sorted((OUT_DIR / "derived").glob("site-human-view-structured-*.json"))
    if derived:
        return derived[-1]
    reports = sorted(OUT_DIR.glob("site-human-view-*.json"))
    reports = [path for path in reports if "structured" not in path.name]
    if not reports:
        return None
    return reports[-1]


def main() -> int:
    report = latest_report()
    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "out_dir": "out",
        "report_path": None,
        "error": None,
    }
    if report is None:
        payload["error"] = "No site-human-view-*.json files found under out/."
    else:
        payload["report_path"] = report.relative_to(REPO_ROOT).as_posix()
    MANIFEST_PATH.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(payload["report_path"] or payload["error"])
    return 0 if report else 1


if __name__ == "__main__":
    raise SystemExit(main())
