# Tests for the demo-only, author-written content in backend/demo

import json
import unittest
from collections import Counter
from pathlib import Path

from app.datasets.scenario_parser import ScenarioParser
from app.datasets.scenario_realism import enrich_scenario
from app.models.scenario import Scenario
from app.services.dataset_service import DatasetService
from app.services.scenario_service import ScenarioService

DEMO_DIR = Path(__file__).resolve().parent.parent / "demo"
FILES = (("demo_only_author_written_genuine_email.csv", "EMAIL"),)
SA_FILE = DEMO_DIR / "sa_admin_scenarios.json"


def _ready_scenario(index, channel, category, sender, subject, message, answer, attachment=None):
    """A scenario as the importer or the seed builds it: fields from the parser rules, then realism."""
    fields = ScenarioParser.derive_fields(channel, sender or "", subject or "", message, answer == "REPORT")
    scenario = Scenario(scenario_id=index, title="t", simulation_type=channel, category=category,
                        difficulty=fields["difficulty"], sender=fields["sender"], subject=subject, message=message,
                        attachment=attachment, correct_answer=answer, status="DRAFT")
    scenario.set_phishing_cues(fields["phishing_cues"])
    enrich_scenario(scenario)
    return scenario


class DemoOnlyDatasetTests(unittest.TestCase):
    """The demo-only files pass the import like any upload, and every row needs no admin edit."""

    def test_each_file_passes_the_quality_gate_as_its_channel(self):
        for name, channel in FILES:
            records, report = DatasetService.check_quality(DatasetService._read_rows(DEMO_DIR / name, "csv"), channel)
            self.assertTrue(report["quality_ok"], name)
            self.assertEqual(report["usable_labelled"], report["total_rows"], name)
            self.assertTrue(all(record["label"] == "LEGITIMATE" for record in records), name)   # genuine only

    def test_every_row_lands_in_its_category_and_passes_every_review_check(self):
        for name, channel in FILES:
            for index, row in enumerate(DatasetService._read_rows(DEMO_DIR / name, "csv")):
                record = ScenarioParser.parse_row(row, channel)
                self.assertEqual(record["category"], row["intended_category"], f"{name} row {index}")
                scenario = Scenario(scenario_id=index, title="t", simulation_type=channel, category=record["category"],
                                    difficulty=record["difficulty"], sender=record["sender"], subject=record["subject"],
                                    message=record["message"], correct_answer="SAFE", status="DRAFT")
                scenario.set_phishing_cues(record["phishing_cues"])
                enrich_scenario(scenario)
                failed = [check["label"] for check in ScenarioService.quality_checks(scenario) if not check["passed"]]
                self.assertEqual(failed, [], f"{name} row {index}")

    def test_emails_get_a_sender_and_subject_the_way_the_kd_phishing_does(self):
        row = DatasetService._read_rows(DEMO_DIR / FILES[0][0], "csv")[0]
        record = ScenarioParser.parse_row(row, "EMAIL")
        self.assertEqual(record["sender"], "Security Team")   # read from the signature, no address
        self.assertTrue(record["subject_from_text"])           # from the first sentence, like KD phishing
        self.assertEqual(ScenarioParser.extract_urls(record["message"]), [])   # no links, like KD phishing


class SouthAfricanAdminScenarioTests(unittest.TestCase):
    """The admin's South African scenarios are ready to go live and never hint at the answer by category."""

    @classmethod
    def setUpClass(cls):
        cls.items = json.loads(SA_FILE.read_text(encoding="utf-8"))

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
