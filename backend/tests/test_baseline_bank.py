# Unit tests for the role-based baseline question bank (CATCH "Check")
#   .venv\Scripts\python.exe -m unittest discover -s tests

import json
import unittest
from collections import Counter

from app.enums.occupation import Occupation
from app.services.baseline_service import TEMPLATE_FILE, BaselineService

BANK = json.loads(TEMPLATE_FILE.read_text(encoding="utf-8"))
ROLES = [occupation.value for occupation in Occupation]


class BaselineBankTests(unittest.TestCase):
    def test_every_role_has_a_full_baseline_switched_on(self):
        active = Counter(row["occupation"] for row in BANK if row["active"])
        for role in ROLES:
            self.assertEqual(active[role], BaselineService.QUESTIONS_PER_ASSESSMENT, role)

    def test_every_role_has_spare_templates_the_admin_can_switch_on(self):
        spare = Counter(row["occupation"] for row in BANK if not row["active"])
        for role in ROLES:
            self.assertGreaterEqual(spare[role], 1, role)

    def test_roles_are_known_or_general(self):
        for row in BANK:
            self.assertIn(row["occupation"], [*ROLES, None], row["question"][:40])

    def test_example_answers_contain_every_expected_keyword(self):
        # The example answer is shown after the quiz as a model answer, so it must score full marks
        for row in BANK:
            answer = row["exampleAnswer"].lower()
            missing = [keyword for keyword in row["expectedKeywords"] if keyword.lower() not in answer]
            self.assertEqual(missing, [], row["question"][:40])

    def test_thresholds_fit_the_keywords(self):
        for row in BANK:
            self.assertTrue(1 <= row["confidenceThreshold"] <= len(row["expectedKeywords"]), row["question"][:40])

    def test_questions_are_unique(self):
        texts = [row["question"].strip().lower() for row in BANK]
        self.assertEqual(len(texts), len(set(texts)))


if __name__ == "__main__":
    unittest.main()
