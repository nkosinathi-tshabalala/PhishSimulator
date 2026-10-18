# Unit tests for the baseline template bank: named assessments per role (CATCH "Check")
#   .venv\Scripts\python.exe -m unittest discover -s tests

import json
import unittest
from collections import Counter

from app.enums.occupation import Occupation
from app.services.baseline_service import TEMPLATE_FILE, BaselineService

BANK = json.loads(TEMPLATE_FILE.read_text(encoding="utf-8"))
ROLES = [occupation.value for occupation in Occupation]
QUESTIONS = [question for template in BANK for question in template["questions"]]


class BaselineBankTests(unittest.TestCase):
    def test_every_role_has_one_baseline_switched_on_and_a_spare(self):
        on = Counter(t["occupation"] for t in BANK if t["active"])
        off = Counter(t["occupation"] for t in BANK if not t["active"])
        for role in ROLES:
            self.assertEqual(on[role], 1, role)
            self.assertGreaterEqual(off[role], 1, role)

    def test_every_baseline_has_enough_questions_to_switch_on(self):
        for t in BANK:
            self.assertGreaterEqual(len(t["questions"]), BaselineService.MIN_QUESTIONS, f'{t["occupation"]} {t["name"]}')

    def test_the_demo_bank_loads_7_questions_per_baseline(self):
        for t in BANK:
            self.assertEqual(len(t["questions"]), 7, f'{t["occupation"]} {t["name"]}')

    def test_names_say_what_they_cover_and_are_unique_per_role(self):
        names = [(t["occupation"], t["name"]) for t in BANK]
        self.assertEqual(len(names), len(set(names)))
        for t in BANK:
            self.assertNotRegex(t["name"], r"(?i)^baseline assessment \d+$")   # a name, not a number
            self.assertLessEqual(len(t["name"]), 120)

    def test_roles_are_known(self):
        for t in BANK:
            self.assertIn(t["occupation"], [*ROLES, None], t["name"])

    def test_example_answers_contain_every_expected_keyword(self):
        # The example answer is shown after the quiz as a model answer, so it must score full marks
        for row in QUESTIONS:
            answer = row["exampleAnswer"].lower()
            missing = [keyword for keyword in row["expectedKeywords"] if keyword.lower() not in answer]
            self.assertEqual(missing, [], row["question"][:40])

    def test_thresholds_fit_the_keywords(self):
        for row in QUESTIONS:
            self.assertTrue(1 <= row["confidenceThreshold"] <= len(row["expectedKeywords"]), row["question"][:40])

    def test_questions_are_unique_across_the_bank(self):
        # Loading the bank matches questions on their text, so a repeated question would never load twice
        texts = [row["question"].strip().lower() for row in QUESTIONS]
        self.assertEqual(len(texts), len(set(texts)))


if __name__ == "__main__":
    unittest.main()
