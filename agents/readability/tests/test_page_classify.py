from __future__ import annotations

import unittest

from page_classify import classify_page_type, classify_url, filter_pages, human_stop_reason
from tests.helpers import DERIVED_REPORT, SAVED_REPORT, load_json, page_by_path


class PageClassifyTests(unittest.TestCase):
    def test_required_paths(self) -> None:
        cases = {
            "https://omegax-hackathon.onrender.com/": "homepage",
            "https://omegax-hackathon.onrender.com/motorcycles": "product_listing",
            "https://omegax-hackathon.onrender.com/motorcycles/": "product_listing",
            "https://omegax-hackathon.onrender.com/motorcycles/thunderstrike-650": "product_detail",
            "https://omegax-hackathon.onrender.com/motorcycles/thunderstrike-650/": "product_detail",
            "https://omegax-hackathon.onrender.com/offers": "offers",
            "https://omegax-hackathon.onrender.com/finance": "finance",
            "https://omegax-hackathon.onrender.com/dealers": "dealer_listing",
            "https://omegax-hackathon.onrender.com/dealers/delhi-central": "dealer_detail",
            "https://omegax-hackathon.onrender.com/faq": "faq",
            "https://omegax-hackathon.onrender.com/about": "about",
            "https://omegax-hackathon.onrender.com/contact": "contact",
            "https://omegax-hackathon.onrender.com/book-test-ride": "booking",
            "https://omegax-hackathon.onrender.com/book-test-ride?bike=thunderstrike-650": "booking",
            "https://omegax-hackathon.onrender.com/account": "account",
            "https://omegax-hackathon.onrender.com/login": "authentication",
            "https://omegax-hackathon.onrender.com/mystery": "other",
        }
        for url, expected in cases.items():
            page_type, reason = classify_page_type(url)
            self.assertEqual(page_type, expected, url)
            self.assertTrue(reason)

    def test_query_and_slash_do_not_merge_identity(self) -> None:
        listing = classify_url("https://x.test/motorcycles/")
        detail = classify_url("https://x.test/motorcycles/thunderstrike-650/")
        booking = classify_url("https://x.test/book-test-ride?bike=thunderstrike-650")
        self.assertEqual(listing["page_type"], "product_listing")
        self.assertEqual(detail["page_type"], "product_detail")
        self.assertNotEqual(listing["canonical_path"], detail["canonical_path"])
        self.assertEqual(booking["page_type"], "booking")
        self.assertEqual(booking["canonical_path"], "/book-test-ride")
        self.assertEqual(booking["query"].get("bike"), "thunderstrike-650")
        self.assertTrue(booking["url"].endswith("bike=thunderstrike-650"))

    def test_saved_report_categories(self) -> None:
        derived = load_json(DERIVED_REPORT)
        counts = derived["page_type_counts"]
        self.assertEqual(counts.get("homepage"), 1)
        self.assertEqual(counts.get("product_listing"), 1)
        self.assertEqual(counts.get("product_detail"), 18)
        self.assertEqual(counts.get("offers"), 1)
        self.assertEqual(counts.get("finance"), 1)
        self.assertEqual(counts.get("dealer_listing"), 1)
        self.assertEqual(counts.get("faq"), 1)
        self.assertEqual(counts.get("about"), 1)
        self.assertEqual(counts.get("contact"), 1)
        self.assertEqual(counts.get("booking"), 19)
        self.assertEqual(sum(counts.values()), 45)
        self.assertNotIn("account", counts)
        self.assertNotIn("authentication", counts)

        original = load_json(SAVED_REPORT)
        skipped_robots = [
            item for item in original["skipped"] if str(item.get("reason") or "").startswith("robots")
        ]
        self.assertEqual(len(skipped_robots), 2)
        captured_urls = {page["url"] for page in derived["pages"]}
        for item in skipped_robots:
            self.assertNotIn(item["url"].rstrip("/"), {url.rstrip("/") for url in captured_urls})

        listing = page_by_path(derived, "/motorcycles")
        detail = page_by_path(derived, "/motorcycles/thunderstrike-650")
        self.assertEqual(listing["page_type"], "product_listing")
        self.assertEqual(detail["page_type"], "product_detail")

        bookings = [
            page
            for page in derived["pages"]
            if page["page_type"] == "booking" and (page.get("query") or {}).get("bike")
        ]
        self.assertEqual(len(bookings), 18)
        for page in bookings:
            self.assertEqual(page["canonical_path"], "/book-test-ride")
            self.assertIn("bike=", page["url"])

    def test_filter_pages(self) -> None:
        derived = load_json(DERIVED_REPORT)
        finance = filter_pages(derived["pages"], page_type="finance")
        self.assertEqual(len(finance), 1)
        search = filter_pages(derived["pages"], query="thunderstrike-650")
        self.assertTrue(search)
        self.assertTrue(all("thunderstrike-650" in (p.get("url") or "") or "Thunderstrike" in (p.get("page_title") or "") for p in search))
        none = filter_pages(derived["pages"], page_type="finance", status="error")
        self.assertEqual(none, [])

    def test_stop_reason_label(self) -> None:
        self.assertIn("not proof", human_stop_reason("queue_exhausted").lower())


if __name__ == "__main__":
    unittest.main()
