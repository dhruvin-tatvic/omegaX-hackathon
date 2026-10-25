from __future__ import annotations

import unittest

from structured_facts import extract_structured_facts
from tests.helpers import DERIVED_REPORT, facts, load_html, load_json, page_by_path, page_by_type


class StructuredFactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report = load_json(DERIVED_REPORT)

    def test_thunderstrike_base_price(self) -> None:
        page = page_by_path(self.report, "/motorcycles/thunderstrike-650")
        html = load_html(page["rendered_html_path"])
        payload = extract_structured_facts(html, url=page["url"], final_url=page["final_url"])
        base = [
            fact
            for fact in payload["facts"]
            if fact["entity_name"] == "Thunderstrike 650"
            and fact["fact_type"] in {"ex_showroom_price", "starting_price"}
            and fact["value"] == 420000
            and not (fact.get("qualifier") or {}).get("role")
        ]
        self.assertTrue(base)
        self.assertTrue(all(fact["status"] == "verified" for fact in base))
        self.assertTrue(all(fact["currency"] == "INR" for fact in base))

    def test_offers_cash_discount(self) -> None:
        page = page_by_type(self.report, "offers")
        hits = facts(page, entity_name="Thunderstrike 650", fact_type="cash_discount", value=25000)
        self.assertEqual(len(hits), 1)
        self.assertEqual(hits[0]["status"], "verified")
        self.assertEqual((hits[0].get("qualifier") or {}).get("offer"), "Monsoon Mania Sale")
        phantom = facts(page, entity_name="Phantom 350", fact_type="cash_discount", value=15000)
        self.assertEqual(len(phantom), 1)
        self.assertFalse(facts(page, entity_name="Thunderstrike 650", fact_type="ex_showroom_price", value=25000))

    def test_finance_down_payment_and_emi(self) -> None:
        page = page_by_type(self.report, "finance")
        down = facts(page, entity_name="Thunderstrike 650", fact_type="down_payment", value=42000)
        emi = facts(page, entity_name="Thunderstrike 650", fact_type="monthly_emi", value=9585)
        rate = facts(page, entity_name="Thunderstrike 650", fact_type="annual_interest_rate_pct", value=9.99)
        tenure = facts(page, entity_name="Thunderstrike 650", fact_type="loan_tenure_months", value=48)
        self.assertTrue(down)
        self.assertTrue(emi)
        self.assertTrue(rate)
        self.assertTrue(tenure)
        self.assertFalse(facts(page, entity_name="Thunderstrike 650", fact_type="ex_showroom_price", value=25000))
        self.assertFalse(facts(page, entity_name="Thunderstrike 650", fact_type="cash_discount", value=25000))

    def test_variant_and_on_road_not_conflated(self) -> None:
        page = page_by_path(self.report, "/motorcycles/thunderstrike-650")
        variant = [
            fact
            for fact in page["structured_facts"]["facts"]
            if fact["value"] == 475000 and "Adventure+" in str(fact.get("entity_name"))
        ]
        self.assertTrue(variant)
        base = [
            fact
            for fact in page["structured_facts"]["facts"]
            if fact["entity_name"] == "Thunderstrike 650" and fact["value"] == 420000
        ]
        self.assertTrue(base)
        delhi = [
            fact
            for fact in page["structured_facts"]["facts"]
            if fact["fact_type"] == "on_road_price" and (fact.get("qualifier") or {}).get("city") == "Delhi"
        ]
        self.assertEqual(delhi[0]["value"], 472500)
        related = [
            fact
            for fact in page["structured_facts"]["facts"]
            if fact["entity_name"] == "Phantom 350" and fact["value"] == 215000
        ]
        self.assertTrue(related)
        self.assertNotEqual(related[0]["entity_id"], "product:thunderstrike-650")

    def test_multi_product_pages(self) -> None:
        finance = page_by_type(self.report, "finance")
        plans = [entity for entity in finance["structured_facts"]["entities"] if entity["type"] == "financing_plan"]
        products = [entity for entity in finance["structured_facts"]["entities"] if entity["type"] == "product"]
        self.assertEqual(len(plans), 17)
        self.assertGreaterEqual(len(products), 17)
        phantom_emi = facts(finance, entity_name="Phantom 350", fact_type="monthly_emi", value=4894)
        self.assertTrue(phantom_emi)
        self.assertNotEqual(phantom_emi[0]["value"], 9585)

        offers = page_by_type(self.report, "offers")
        offer_entities = [entity for entity in offers["structured_facts"]["entities"] if entity["type"] == "offer"]
        self.assertGreaterEqual(len(offer_entities), 2)
        monsoon = [entity for entity in offer_entities if entity["name"] == "Monsoon Mania Sale"]
        zero = [entity for entity in offer_entities if entity["name"] == "Zero Down Payment"]
        self.assertTrue(monsoon and zero)

    def test_multiple_plans_for_one_product(self) -> None:
        detail = page_by_path(self.report, "/motorcycles/thunderstrike-650")
        finance = page_by_type(self.report, "finance")
        detail_plan = [
            entity for entity in detail["structured_facts"]["entities"] if entity["type"] == "financing_plan"
        ]
        finance_plan = [
            entity for entity in finance["structured_facts"]["entities"] if entity["id"].endswith("thunderstrike-650-finance")
        ]
        self.assertTrue(detail_plan)
        self.assertTrue(finance_plan)
        self.assertNotEqual(detail_plan[0]["id"], finance_plan[0]["id"])

    def test_ambiguous_accessories_and_fixture(self) -> None:
        offers = page_by_type(self.report, "offers")
        accessories = facts(offers, fact_type="accessories_value", value=8000)
        self.assertTrue(accessories)
        self.assertEqual(accessories[0]["status"], "ambiguous")

        html = """
        <article class="offer-card">
          <h3 class="offer-card__title">Unlabelled Promo</h3>
          <div class="offer-card__benefit"><span>Price ₹50,000</span></div>
        </article>
        """
        payload = extract_structured_facts(html, url="https://example.test/offers")
        money = [fact for fact in payload["facts"] if fact.get("value") == 50000]
        self.assertTrue(money)
        self.assertTrue(all(fact["status"] == "ambiguous" or fact["fact_type"] == "offer_term" for fact in money))

    def test_banking_partners(self) -> None:
        offers = page_by_type(self.report, "offers")
        banks = [entity["name"] for entity in offers["structured_facts"]["entities"] if entity["type"] == "bank"]
        self.assertEqual(set(banks), {"HDFC Bank", "ICICI Bank", "SBI", "Axis Bank"})
        hdfc = facts(offers, entity_name="HDFC Bank", fact_type="annual_interest_rate_pct", value=8.5)
        self.assertTrue(hdfc)

    def test_faq_pairing(self) -> None:
        faq = page_by_type(self.report, "faq")
        questions = facts(faq, fact_type="question")
        answers = facts(faq, fact_type="answer")
        self.assertEqual(len(questions), 12)
        self.assertEqual(len(answers), 12)
        first = questions[0]["entity_id"]
        paired = [fact for fact in answers if fact["entity_id"] == first]
        self.assertEqual(len(paired), 1)
        self.assertIn("₹99,000", paired[0]["value_text"])

    def test_zero_down_emi_not_thunderstrike_plan(self) -> None:
        offers = page_by_type(self.report, "offers")
        ts_emi = facts(offers, entity_name="Thunderstrike 650", fact_type="monthly_emi", value=4999)
        self.assertEqual(ts_emi, [])


if __name__ == "__main__":
    unittest.main()
