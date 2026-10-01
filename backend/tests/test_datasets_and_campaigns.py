# Tests for dataset cleaning and the email campaign helpers

import unittest

from app.datasets.scenario_parser import ScenarioParser
from app.services.campaign_service import CampaignService
from app.services.dataset_service import DatasetService


class ParserCleaningTests(unittest.TestCase):
    """Dataset rows are cleaned before becoming scenarios."""

    def test_yes_no_flag_columns_are_not_treated_as_a_sender(self):
        row = {"TEXT": "Win a prize now, click here!", "LABEL": "smishing", "EMAIL": "No", "PHONE": "No"}
        record = ScenarioParser.parse_row(row, "SMS")
        self.assertEqual(record["sender"], "")

    def test_recipient_address_is_anonymised(self):
        text = "Dear jose@monkey.org, your monkey.org account is locked."
        cleaned = ScenarioParser.anonymise_recipient(text, "jose@monkey.org")
        self.assertNotIn("jose@monkey.org", cleaned)
        self.assertIn("you@example.com", cleaned)
        self.assertNotIn("monkey.org", cleaned)

    def test_urls_lose_trailing_punctuation(self):
        self.assertEqual(ScenarioParser.extract_urls("Go to http://evil.example/pay."), ["http://evil.example/pay"])


class LabelLeakTests(unittest.TestCase):
    """Datasets whose formatting gives the answer away are caught."""

    def records(self, phishing_texts, legit_texts):
        """Build labelled records from phishing and safe texts."""
        return (
            [{"label": "PHISHING", "message": text} for text in phishing_texts]
            + [{"label": "LEGITIMATE", "message": text} for text in legit_texts]
        )

    def test_prefix_only_phishing_uses_is_a_leak(self):
        records = self.records(
            [f"Please verify.\nKeywords: bank pin\nThanks {i}" for i in range(10)],
            [f"Meeting at 2pm about topic {i}." for i in range(10)],
        )
        self.assertIn("Keywords:", DatasetService.find_label_leaks(records))

    def test_shared_prefix_is_not_a_leak(self):
        records = self.records(
            [f"Subject: alert\nVerify now {i}" for i in range(10)],
            [f"Subject: notes\nSee you {i}" for i in range(10)],
        )
        self.assertEqual(DatasetService.find_label_leaks(records), [])


class ChannelCheckTests(unittest.TestCase):
    """An SMS file can't be uploaded as email, or the other way round."""

    def email(self, index):
        """A typical email record: sender address, subject and a long multi-line body."""
        body = "Dear customer,\n\nWe noticed unusual activity on your account. " * 8
        return {"sender": f"alerts{index}@bank.example", "subject": "Account notice", "message": body}

    def text(self, index):
        """A typical SMS record: short, one line and no subject."""
        return {"sender": "+27820000000", "subject": "", "message": f"Your parcel {index} is waiting. Pay R25 at bit.ly/x"}

    def test_emails_are_recognised(self):
        self.assertEqual(DatasetService.guess_channel([self.email(i) for i in range(10)]), "EMAIL")

    def test_texts_are_recognised(self):
        self.assertEqual(DatasetService.guess_channel([self.text(i) for i in range(10)]), "SMS")

    def test_sms_file_uploaded_as_email_is_rejected(self):
        rows = [
            {"text": f"Win R{i}000 now! Claim at bit.ly/prize{i}", "label": "phishing" if i % 2 else "legitimate"}
            for i in range(20)
        ]
        _, report = DatasetService.check_quality(rows, "EMAIL")
        self.assertTrue(report["channel_mismatch"])
        self.assertFalse(report["quality_ok"])
        self.assertIn("looks like an SMS dataset", DatasetService._rejection_message(report))

    def test_too_few_rows_is_not_guessed(self):
        self.assertIsNone(DatasetService.guess_channel([self.text(1), self.text(2)]))


class CampaignRecipientTests(unittest.TestCase):
    """Campaign recipients are cleaned and checked against the allow-list."""

    def test_recipients_are_split_deduped_and_validated(self):
        raw = "you@gmail.com, you@gmail.com\nyou+test@gmail.com; not-an-email"
        self.assertEqual(
            CampaignService._clean_recipients(raw),
            ["you@gmail.com", "you+test@gmail.com"],
        )

    def test_recipients_accepts_a_list(self):
        self.assertEqual(CampaignService._clean_recipients(["A@B.com"]), ["a@b.com"])


if __name__ == "__main__":
    unittest.main()
