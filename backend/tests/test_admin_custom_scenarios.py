# Tests for the admin's custom scenarios the demo loads (backend/demo/admin_custom_scenarios.json)

import json
import unittest
from collections import Counter
from pathlib import Path

from app.datasets.scenario_parser import ScenarioParser
from app.datasets.scenario_realism import enrich_scenario
from app.models.scenario import Scenario
from app.services.scenario_service import ScenarioService

DEMO_DIR = Path(__file__).resolve().parent.parent / "demo"
CUSTOM_FILE = DEMO_DIR / "admin_custom_scenarios.json"


def _ready_scenario(index, channel, category, sender, subject, message, answer, attachment=None):
    """A scenario as the importer or the seed builds it: fields from the parser rules, then realism."""
    fields = ScenarioParser.derive_fields(channel, sender or "", subject or "", message, answer == "REPORT")
    scenario = Scenario(scenario_id=index, title="t", simulation_type=channel, category=category,
                        difficulty=fields["difficulty"], sender=fields["sender"], subject=subject, message=message,
                        attachment=attachment, correct_answer=answer, status="DRAFT")
    scenario.set_phishing_cues(fields["phishing_cues"])
    enrich_scenario(scenario)
    return scenario


class AdminCustomScenarioTests(unittest.TestCase):
    """The admin's custom (South African) scenarios are ready to go live and never hint at the answer by category."""

    @classmethod
    def setUpClass(cls):
        cls.items = json.loads(CUSTOM_FILE.read_text(encoding="utf-8"))

    def test_every_item_passes_every_review_check(self):
        for index, item in enumerate(self.items):
            answer = "REPORT" if item["answer"] == "phishing" else "SAFE"
            scenario = _ready_scenario(index, item["channel"], item["category"], item.get("sender"),
                                       item.get("subject"), item["message"], answer, item.get("attachment"))
            failed = [check["label"] for check in ScenarioService.quality_checks(scenario) if not check["passed"]]
            self.assertEqual(failed, [], item["title"])
            if answer == "REPORT":
                self.assertTrue(scenario.get_phishing_cues(), item["title"])   # every phishing item shows a sign

    def test_every_category_has_as_many_genuine_as_phishing(self):
        counts = Counter((item["channel"], item["category"], item["answer"]) for item in self.items)
        for channel, category, _ in counts:
            self.assertEqual(counts[(channel, category, "phishing")], counts[(channel, category, "genuine")],
                             f"{channel} {category}")

    def test_titles_are_unique(self):
        titles = [item["title"] for item in self.items]
        self.assertEqual(len(titles), len(set(titles)))
