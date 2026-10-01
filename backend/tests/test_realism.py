# Tests for realistic scenario generation and the Help-stage rules

import unittest
from datetime import date
from types import SimpleNamespace

from app.datasets.scenario_realism import (
    attachment_for,
    display_sender,
    enrich,
    link_targets,
    mask_links,
    quality_score,
)
from app.schemas.simulation_schema import SimulationSchema
from app.services.progress_service import ProgressService
from app.services.scenario_service import ScenarioService


class LinkMaskingTests(unittest.TestCase):
    """Links are hidden behind readable text."""

    def test_labelled_link_uses_its_label(self):
        masked = mask_links("Track your order: https://www.takealot.com/orders/1", "Delivery", "EMAIL")
        self.assertEqual(masked, "[Track your order](https://www.takealot.com/orders/1)")

    def test_link_on_its_own_line_gets_button_text(self):
        masked = mask_links("Pay now below:\nhttp://evil.example/pay.", "Delivery", "EMAIL")
        self.assertRegex(masked.splitlines()[1], r"^\[[^\]]+\]\(http://evil\.example/pay\)$")

    def test_inline_links_and_sms_links_stay_visible(self):
        inline = "Visit https://www.up.ac.za for details."
        self.assertEqual(mask_links(inline, "University", "EMAIL"), inline)
        sms = "Pay here:\nhttps://postnet-redeliver.co.za/pay"
        self.assertEqual(mask_links(sms, "Delivery", "SMS"), sms)

    def test_masking_twice_changes_nothing(self):
        once = mask_links("Login:\nhttps://m1crosoft.com/reset", "Password Reset", "EMAIL")
        self.assertEqual(mask_links(once, "Password Reset", "EMAIL"), once)

    def test_link_targets_find_hidden_and_visible_addresses(self):
        text = "[Sign in](https://fake.example/login) or visit https://real.example."
        self.assertEqual(link_targets(text), ["https://fake.example/login", "https://real.example"])


class SenderAndAttachmentTests(unittest.TestCase):
    """Senders get display names and messages get fitting attachments."""

    def test_bare_address_gets_display_name(self):
        self.assertEqual(
            display_sender("security@fnb-alerts.co.za", "EMAIL"),
            "FNB Alerts <security@fnb-alerts.co.za>",
        )
        self.assertEqual(display_sender("registrar@up.ac.za", "EMAIL"), "UP Registrar <registrar@up.ac.za>")

    def test_existing_names_and_sms_senders_are_kept(self):
        self.assertEqual(display_sender("Takealot <orders@takealot.com>", "EMAIL"), "Takealot <orders@takealot.com>")
        self.assertEqual(display_sender("+27601234567", "SMS"), "+27601234567")

    def test_attachment_type_depends_on_label(self):
        text = "Please see the attached statement."
        risky = attachment_for(text, "Banking", True, "EMAIL")
        safe = attachment_for(text, "Banking", False, "EMAIL")
        self.assertTrue(risky.endswith((".htm", ".zip", ".docm", ".iso")))
        self.assertTrue(safe.endswith((".pdf", ".docx", ".xlsx")))
        self.assertIsNone(attachment_for("No files here.", "Banking", True, "EMAIL"))

    def test_risky_attachment_adds_the_clue(self):
        fields = enrich("EMAIL", "Banking", "a@b.com", "Invoice", "Invoice attached, pay today.", True, [])
        self.assertIn("Unexpected attachment", fields["phishing_cues"])

    def test_quality_prefers_complete_clean_messages(self):
        good = quality_score("EMAIL", "a@b.com", "Hello", "x" * 200, True, ["Urgency", "Suspicious link"])
        raw = quality_score("EMAIL", "", "", "<html>content-type: text</html>", True, [])
        self.assertEqual(good, 100)
        self.assertLess(raw, 40)


class InteractionRulesTests(unittest.TestCase):
    """Clicking or opening counts as trusting the message."""

    def base(self, **extra):
        """A valid attempt, with any fields overridden."""
        return {"scenario_id": 1, "player_answer": "SAFE", "selected_clues": ["Known sender"], **extra}

    def test_opened_attachment_must_mean_safe(self):
        self.assertTrue(SimulationSchema.validate_attempt(self.base(opened_attachment=True))[0])
        report = self.base(player_answer="REPORT", opened_attachment=True)
        self.assertFalse(SimulationSchema.validate_attempt(report)[0])

    def test_link_and_attachment_cannot_both_be_recorded(self):
        both = self.base(clicked_link=True, opened_attachment=True)
        self.assertFalse(SimulationSchema.validate_attempt(both)[0])

    def test_mistakes_return_after_a_gap(self):
        attempts = [SimpleNamespace(scenario_id=sid, correct=ok) for sid, ok in [
            (9, False), (1, True), (2, True), (5, True), (4, False), (5, False),
        ]]
        self.assertEqual(ScenarioService.mistakes_to_review(attempts), [4])


class DailyHabitTests(unittest.TestCase):
    """Daily goal and practice-day streak."""

    def facts_on(self, *days):
        """Attempts made on the given dates."""
        return [{"date": day} for day in days]

    def test_streak_counts_consecutive_days_up_to_yesterday(self):
        today = date(2026, 9, 28)
        facts = self.facts_on(date(2026, 9, 27), date(2026, 9, 26), date(2026, 9, 24))
        activity = ProgressService.daily_activity(facts, today)
        self.assertEqual(activity["daily_streak"], 2)
        self.assertFalse(activity["practised_today"])

    def test_today_counts_towards_goal_and_streak(self):
        today = date(2026, 9, 28)
        activity = ProgressService.daily_activity(self.facts_on(today, today, date(2026, 9, 27)), today)
        self.assertEqual(activity["today_attempts"], 2)
        self.assertEqual(activity["daily_streak"], 2)


if __name__ == "__main__":
    unittest.main()
