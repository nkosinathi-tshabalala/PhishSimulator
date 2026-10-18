# Tests for input rules found by black-box probing: yes/no fields and scenario categories

import unittest

from app.schemas.scenario_schema import ScenarioSchema
from app.services.auth_service import AuthService


def _scenario(**changes):
    data = {"title": "t", "simulation_type": "EMAIL", "category": "Banking & Money", "difficulty": "Easy",
            "message": "m", "correct_answer": "SAFE"}
    data.update(changes)
    return data


class InputRuleTests(unittest.TestCase):

    def test_only_true_counts_as_yes(self):
        for value in (True, "true", " TRUE "):
            self.assertTrue(AuthService._flag(value), value)
        # "false" sent as text used to count as yes, which switched campaign consent on
        for value in (False, "false", "no", "", None, 0, 1, "1", "yes", [], {}):
            self.assertFalse(AuthService._flag(value), value)

    def test_consent_from_text_false_is_withdrawn(self):
        fields = AuthService._consent_fields("false")
        self.assertFalse(fields["campaign_consent"])
        self.assertIsNone(fields["campaign_consent_at"])

    def test_scenario_category_must_be_a_training_category(self):
        self.assertEqual(ScenarioSchema.validate_create(_scenario()), (True, None))
        self.assertEqual(ScenarioSchema.validate_update(_scenario(category="General")), (True, None))
        valid, message = ScenarioSchema.validate_update(_scenario(category="Not a category"))
        self.assertFalse(valid)
        self.assertIn("category must be one of", message)


if __name__ == "__main__":
    unittest.main()
