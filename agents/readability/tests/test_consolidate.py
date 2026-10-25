from __future__ import annotations

import json
import unittest
from pathlib import Path

from consolidate_report import consolidate, write_consolidated
from tests.helpers import DERIVED_REPORT, REPO_ROOT, SAVED_REPORT, load_json


class ConsolidateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.output = REPO_ROOT / "out" / "playwright-crawl-complete.json"
        write_consolidated(SAVED_REPORT, cls.output)
        cls.payload = load_json(cls.output)

    def test_valid_json_and_counts(self) -> None:
        summary = self.payload["crawl_summary"]
        self.assertEqual(summary["total_pages_discovered"], 47)
        self.assertEqual(summary["total_pages_captured"], 45)
        self.assertEqual(summary["total_pages_failed"], 0)
        self.assertEqual(summary["skipped_entries"], 65)
        self.assertEqual(summary["page_records_exported"], 45)
        self.assertEqual(summary["successful_pages"], 45)
        self.assertEqual(len(self.payload["pages"]), 45)
        self.assertEqual(len(self.payload["skipped_urls"]), 65)
        self.assertEqual(self.payload["failed_urls"], [])
        self.assertEqual(self.payload["coverage"]["stopped_reason"], "queue_exhausted")
        self.assertFalse(self.payload["coverage"]["full_site_coverage_claimed"])
        self.assertTrue(self.payload["coverage"]["queue_exhausted"])
        self.assertFalse(self.payload["coverage"]["page_limit_reached"])

    def test_embeds_original_content_html_and_screenshot(self) -> None:
        home = next(page for page in self.payload["pages"] if page["metadata"]["canonical_path"] == "/")
        self.assertTrue(home["content"]["visible_text"])
        self.assertGreater(len(home["headings"]), 0)
        self.assertTrue(home["rendered_html"])
        self.assertIn("<html", home["rendered_html"].lower())
        self.assertEqual(home["screenshot"]["encoding"], "base64")
        self.assertTrue(home["screenshot"]["data"])
        self.assertGreater(home["screenshot"]["byte_length"], 1000)
        self.assertIn("product_names", home["product_data"])
        original = load_json(REPO_ROOT / home["source_paths"]["json_path"])
        self.assertEqual(home["content"]["visible_text"], original["content"]["visible_text"])

    def test_dashboard_facts_and_categories_present(self) -> None:
        derived = load_json(DERIVED_REPORT)
        self.assertEqual(self.payload["coverage"]["page_type_counts"], derived["page_type_counts"])
        detail = next(
            page
            for page in self.payload["pages"]
            if page["metadata"]["canonical_path"] == "/motorcycles/thunderstrike-650"
        )
        self.assertEqual(detail["metadata"]["page_type"], "product_detail")
        prices = [
            fact
            for fact in detail["structured_facts"]["facts"]
            if fact.get("entity_name") == "Thunderstrike 650" and fact.get("value") == 420000
        ]
        self.assertTrue(prices)
        self.assertEqual(detail["http"]["status"], 200)

    def test_does_not_overwrite_source_artifacts(self) -> None:
        before = (REPO_ROOT / "out" / "human-view-20261025-061336.json").read_bytes()
        write_consolidated(SAVED_REPORT, self.output)
        after = (REPO_ROOT / "out" / "human-view-20261025-061336.json").read_bytes()
        self.assertEqual(before, after)
        self.assertTrue(SAVED_REPORT.is_file())
        self.assertTrue(DERIVED_REPORT.is_file())

    def test_unavailable_fields_are_declared_not_invented(self) -> None:
        names = {item["field"] for item in self.payload["additional_crawler_data"]["unavailable_fields"]}
        self.assertIn("meta_description", names)
        home = self.payload["pages"][0]
        self.assertNotIn("meta_description", home["metadata"])

    def test_stamped_copy_written(self) -> None:
        stamped = REPO_ROOT / "out" / "playwright-crawl-complete-20261025-061336.json"
        self.assertTrue(stamped.is_file())
        self.assertEqual(json.loads(stamped.read_text(encoding="utf-8"))["crawl_summary"]["page_records_exported"], 45)


if __name__ == "__main__":
    unittest.main()
