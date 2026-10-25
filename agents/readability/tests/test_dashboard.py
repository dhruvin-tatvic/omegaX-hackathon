from __future__ import annotations

import json
import threading
import unittest
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import urlopen

from page_classify import filter_pages
from tests.helpers import DERIVED_REPORT, MODULE_DIR, REPO_ROOT, load_json

DASHBOARD_DIR = MODULE_DIR / "review_dashboard"


class _RepoHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(REPO_ROOT), **kwargs)

    def log_message(self, format, *args):  # noqa: A003
        return


class DashboardContractTests(unittest.TestCase):
    def test_markup_has_v2_regions(self) -> None:
        html = (DASHBOARD_DIR / "index.html").read_text(encoding="utf-8")
        for token in (
            'id="kpi-grid"',
            'id="category-chart"',
            'id="search"',
            'id="type-filter"',
            'id="status-filter"',
            'data-tab="overview"',
            'data-tab="facts"',
            'data-tab="screenshot"',
            'id="export-facts"',
            'id="dev-details"',
            'id="tab-json"',
            'id="tab-html"',
        ):
            self.assertIn(token, html)

    def test_js_filters_mirror_python(self) -> None:
        app_js = (DASHBOARD_DIR / "app.js").read_text(encoding="utf-8")
        self.assertIn("page_type", app_js)
        self.assertIn("structured_facts", app_js)
        self.assertIn("export", app_js.lower())
        derived = load_json(DERIVED_REPORT)
        matches = filter_pages(derived["pages"], query="finance", page_type="finance", status="success")
        self.assertEqual(len(matches), 1)

    def test_manifest_points_at_derived_report(self) -> None:
        manifest = json.loads((DASHBOARD_DIR / "manifest.json").read_text(encoding="utf-8"))
        self.assertIn("derived", manifest.get("report_path") or "")
        self.assertTrue((REPO_ROOT / manifest["report_path"]).is_file())


class DashboardHttpSmokeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), _RepoHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, kwargs={"poll_interval": 0.1}, daemon=True)
        cls.thread.start()
        cls.origin = f"http://127.0.0.1:{cls.server.server_address[1]}"

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()

    def _get(self, path: str) -> str:
        with urlopen(self.origin + path, timeout=5) as response:
            return response.read().decode("utf-8", errors="replace")

    def test_dashboard_and_derived_json_served(self) -> None:
        html = self._get("/agents/readability/review_dashboard/")
        self.assertIn("Structured Facts", html)
        manifest = json.loads(self._get("/agents/readability/review_dashboard/manifest.json"))
        report = json.loads(self._get("/" + manifest["report_path"]))
        self.assertEqual(len(report["pages"]), 45)
        self.assertIn("page_type_counts", report)
        page = next(item for item in report["pages"] if item.get("canonical_path") == "/motorcycles/thunderstrike-650")
        self.assertTrue(any(fact.get("value") == 420000 for fact in page["structured_facts"]["facts"]))


if __name__ == "__main__":
    unittest.main()
