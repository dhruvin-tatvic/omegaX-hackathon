from __future__ import annotations

import json
import unittest

from enrich_report import enrich_report
from tests.helpers import DERIVED_REPORT, REPO_ROOT, SAVED_REPORT, load_json


class EnrichCompatTests(unittest.TestCase):
    def test_original_capture_json_untouched(self) -> None:
        original_report = load_json(SAVED_REPORT)
        sample_rel = original_report["pages"][0]["json_path"]
        payload = load_json(REPO_ROOT / sample_rel)
        self.assertIn("content", payload)
        self.assertIsInstance(payload["content"].get("prices"), list)
        self.assertIsInstance(payload["content"].get("product_names"), list)
        self.assertNotIn("structured_facts", payload)
        self.assertNotIn("page_type", payload)

    def test_derived_export_has_schema_and_original_paths(self) -> None:
        derived = load_json(DERIVED_REPORT)
        self.assertEqual(derived["schema_version"], "1.0")
        self.assertTrue(derived["derived_from"].endswith("site-human-view-20261025-061336.json"))
        self.assertEqual(len(derived["pages"]), 45)
        self.assertEqual(len(derived["skipped"]), 65)
        page = derived["pages"][0]
        self.assertTrue((REPO_ROOT / page["json_path"]).is_file())
        self.assertTrue((REPO_ROOT / page["screenshot_path"]).is_file())
        self.assertTrue((REPO_ROOT / page["rendered_html_path"]).is_file())
        self.assertIn("structured_facts", page)
        self.assertEqual(page["structured_facts"]["schema_version"], "1.0")
        export_path = REPO_ROOT / page["derived_json_path"]
        self.assertTrue(export_path.is_file())
        export = load_json(export_path)
        self.assertIn("facts", export["structured_facts"])
        self.assertEqual(export["url"], page["url"])

    def test_enrichment_is_reproducible_from_saved_html(self) -> None:
        original = load_json(SAVED_REPORT)
        again = enrich_report(original, SAVED_REPORT)
        current = load_json(DERIVED_REPORT)
        self.assertEqual(again["page_type_counts"], current["page_type_counts"])
        first = json.dumps(again["pages"][0]["structured_facts"]["facts"], sort_keys=True)
        second = json.dumps(current["pages"][0]["structured_facts"]["facts"], sort_keys=True)
        self.assertEqual(first, second)


if __name__ == "__main__":
    unittest.main()
