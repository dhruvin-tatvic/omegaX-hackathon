from __future__ import annotations

import json
import sys
from pathlib import Path

MODULE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = MODULE_DIR.parents[1]
if str(MODULE_DIR) not in sys.path:
    sys.path.insert(0, str(MODULE_DIR))

SAVED_REPORT = REPO_ROOT / "out" / "site-human-view-20261025-061336.json"
DERIVED_REPORT = REPO_ROOT / "out" / "derived" / "site-human-view-structured-20261025-061336.json"


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def load_html(rel: str) -> str:
    return (REPO_ROOT / rel).read_text(encoding="utf-8")


def page_by_type(report: dict, page_type: str) -> dict:
    return next(page for page in report["pages"] if page.get("page_type") == page_type)


def page_by_path(report: dict, path: str, bike: str | None = None) -> dict:
    for page in report["pages"]:
        if page.get("canonical_path") != path:
            continue
        if bike is None and not (page.get("query") or {}).get("bike"):
            return page
        if bike is not None and (page.get("query") or {}).get("bike") == bike:
            return page
    raise KeyError(path)


def facts(page: dict, **kwargs):
    rows = (page.get("structured_facts") or {}).get("facts") or []
    out = []
    for fact in rows:
        ok = True
        for key, value in kwargs.items():
            if fact.get(key) != value:
                ok = False
                break
        if ok:
            out.append(fact)
    return out
