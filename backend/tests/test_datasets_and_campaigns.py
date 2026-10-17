# Tests for dataset cleaning and the email campaign helpers

import unittest

from app.datasets.scenario_parser import ScenarioParser
from app.services.campaign_service import POINTS, CampaignService
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


class CampaignPointsTests(unittest.TestCase):
    """Campaign results follow the training rule: XP measures effort and never goes down."""

    def test_no_campaign_result_takes_xp_away(self):
        self.assertTrue(all(xp >= 0 for xp in POINTS.values()), POINTS)

    def test_mistakes_earn_nothing_and_good_calls_earn_xp(self):
        self.assertEqual(POINTS[(True, "CLICKED")], 0)     # fell for the phish
        self.assertEqual(POINTS[(False, "REPORTED")], 0)   # false alarm
        self.assertGreater(POINTS[(True, "REPORTED")], POINTS[(True, "IGNORED")])


class DatasetFormatTests(unittest.TestCase):
    """Common public dataset layouts are read correctly, and generator artefacts never give the answer away."""

    def test_generator_keywords_line_is_removed(self):
        row = {"text": "Your profile has been locked. Use the secure link.\n\nKeywords: pin update password\n\nSincerely,\nRiley",
               "label": "1", "phishing_type": "credential_harvesting"}
        record = ScenarioParser.parse_row(row, "EMAIL")
        self.assertNotIn("Keywords", record["message"])
        self.assertEqual(record["label"], "PHISHING")
        self.assertEqual(record["category"], "Password Reset")

    def test_subject_header_in_the_body_becomes_the_subject(self):
        row = {"text": "Subject: Office maintenance\n\nThanks for your help on the analysis.", "label": "0"}
        record = ScenarioParser.parse_row(row, "EMAIL")
        self.assertEqual(record["subject"], "Office maintenance")
        self.assertFalse(record["message"].lower().startswith("subject"))
        self.assertFalse(record["subject_from_text"])

    def test_one_line_message_starting_with_subject_is_left_alone(self):
        row = {"text": "Subject: naturally irresistible your corporate identity is really hard to recollect", "spam": "1"}
        record = ScenarioParser.parse_row(row, "EMAIL")
        self.assertTrue(record["message"].startswith("Subject:"))
        self.assertEqual(record["label"], "PHISHING")

    def test_email_without_subject_gets_one_from_its_first_sentence(self):
        row = {"text": "Hello, your profile has been locked. Use the secure link to restore access.", "label": "1"}
        record = ScenarioParser.parse_row(row, "EMAIL")
        self.assertEqual(record["subject"], "Your profile has been locked")
        self.assertTrue(record["subject_from_text"])

    def test_sms_never_gets_a_subject(self):
        row = {"v1": "ham", "v2": "Subject: hi\nAre we still meeting at 6?"}
        record = ScenarioParser.parse_row(row, "SMS")
        self.assertEqual(record["subject"], "")
        self.assertEqual(record["label"], "LEGITIMATE")

    def test_common_label_values(self):
        self.assertEqual(ScenarioParser.normalize_label("Phishing Email"), "PHISHING")
        self.assertEqual(ScenarioParser.normalize_label("Safe Email"), "LEGITIMATE")
        self.assertEqual(ScenarioParser.normalize_label("Smishing"), "PHISHING")
        self.assertIsNone(ScenarioParser.normalize_label("spam"))   # marketing spam is not phishing

    def test_common_column_layouts(self):
        twente = ScenarioParser.parse_row({"Email Text": "Your mailbox is full, verify now at the link", "Email Type": "Phishing Email"}, "EMAIL")
        uci = ScenarioParser.parse_row({"v1": "ham", "v2": "Ok lar... Joking wif u oni..."}, "SMS")
        mendeley = ScenarioParser.parse_row({"LABEL": "Smishing", "TEXT": "Your parcel is held, pay the fee", "URL": "No"}, "SMS")
        combined = ScenarioParser.parse_row({"text_combined": "account suspended verify your details now", "label": "1"}, "EMAIL")
        self.assertEqual([twente["label"], uci["label"], mendeley["label"], combined["label"]],
                         ["PHISHING", "LEGITIMATE", "PHISHING", "PHISHING"])

    def test_a_malformed_link_does_not_break_the_import(self):
        record = ScenarioParser.parse_row({"body": "See http://[broken and http://micr0soft.com/login now", "label": "1"}, "EMAIL")
        self.assertIn("Suspicious link", record["phishing_cues"])

    def test_latin1_csv_files_are_read(self):
        import os, tempfile
        path = os.path.join(tempfile.mkdtemp(), "uci.csv")
        with open(path, "wb") as handle:
            handle.write("v1,v2\nspam,Win £1000 cash now\nham,See you later\n".encode("cp1252"))
        rows = DatasetService._read_rows(path, "csv")
        self.assertEqual(rows[0]["v2"], "Win £1000 cash now")

    def test_the_formatting_leak_check_still_catches_real_leaks(self):
        records = [{"label": "PHISHING", "message": "Ref: 12\nPay now"}] * 10 + [{"label": "LEGITIMATE", "message": "Hi there"}] * 10
        self.assertEqual(DatasetService.find_label_leaks(records), ["Ref:"])


class DemoSeedTests(unittest.TestCase):
    """The demo data is built from real dataset files with the app's own rules."""

    def test_broken_characters_lower_the_quality_score(self):
        from app.datasets.scenario_realism import quality_review
        text = "Your parcel is waiting at the depot{} collect it before Friday."
        clean, _ = quality_review("SMS", "+27 82 000 0000", "", text.format(","), False, [])
        broken, problems = quality_review("SMS", "+27 82 000 0000", "", text.format("\ufffd"), False, [])
        self.assertEqual(clean - broken, 20)
        self.assertTrue(any("broken characters" in reason for _, reason in problems))

    def test_category_pick_repeats_with_a_seeded_random(self):
        from random import Random
        from app.adaptive.adaptive_engine import AdaptiveEngine
        unpractised = {"Banking": [], "Delivery": [], "Government": []}
        picks = {AdaptiveEngine.recommend_category(unpractised, rng=Random(7))[0] for _ in range(5)}
        self.assertEqual(len(picks), 1)

    def test_near_copies_differ_only_in_greeting_and_sign_off(self):
        import seed_demo
        first = "Dear customer, your account has been restricted. Verify now.\n\nSincerely,\nRiley Khan"
        second = "Hello, your account has been restricted. Verify now.\n\nSupport Desk,\nAlex Lee"
        self.assertEqual(seed_demo._core_text(first), seed_demo._core_text(second))
        self.assertNotEqual(seed_demo._core_text(first), seed_demo._core_text("Your parcel is waiting at the depot."))


class AnswerFirstSelectionTests(unittest.TestCase):
    """Phishing or genuine is chosen first, so difficulty and category never give the answer away."""

    class FixedRandom:
        """A random source whose random() is fixed and whose choice() takes the first item."""
        def __init__(self, value):
            self.value = value

        def random(self):
            return self.value

        def choice(self, items):
            return items[0]

    @staticmethod
    def attempt(answer, correct=True, campaign=None):
        from types import SimpleNamespace
        given = answer if correct else ("SAFE" if answer == "REPORT" else "REPORT")
        return SimpleNamespace(player_answer=given, correct=correct, campaign_recipient_id=campaign)

    def test_the_answer_leans_away_from_what_came_recently_but_is_never_certain(self):
        from app.adaptive.adaptive_engine import AdaptiveEngine
        all_phishing = [self.attempt("REPORT") for _ in range(10)]
        all_genuine = [self.attempt("SAFE", correct=False) for _ in range(10)]   # a wrong answer still counts
        # After 10 phishing, phishing is still possible (25%) but genuine is likelier, and the other way round
        self.assertEqual(AdaptiveEngine.recommend_answer(all_phishing, rng=self.FixedRandom(0.2)), "REPORT")
        self.assertEqual(AdaptiveEngine.recommend_answer(all_phishing, rng=self.FixedRandom(0.3)), "SAFE")
        self.assertEqual(AdaptiveEngine.recommend_answer(all_genuine, rng=self.FixedRandom(0.7)), "REPORT")
        self.assertEqual(AdaptiveEngine.recommend_answer(all_genuine, rng=self.FixedRandom(0.8)), "SAFE")
        self.assertEqual(AdaptiveEngine.recommend_answer([], rng=self.FixedRandom(0.49)), "REPORT")

    def test_campaign_results_do_not_count_toward_the_mix(self):
        from app.adaptive.adaptive_engine import AdaptiveEngine
        campaigns = [self.attempt("REPORT", campaign=index + 1) for index in range(10)]
        self.assertEqual(AdaptiveEngine.recommend_answer(campaigns, rng=self.FixedRandom(0.49)), "REPORT")

    # (id, category, difficulty, answer): Government holds only phishing; genuine exists only as Easy
    ROWS = [(1, "Government", "Hard", "REPORT"), (2, "Banking", "Hard", "REPORT"),
            (3, "Banking", "Easy", "SAFE"), (4, "Social Media", "Easy", "SAFE")]

    def pick(self, answer, category, difficulty, exclusions=(set(),), strict=False):
        from app.services.scenario_service import ScenarioService
        return ScenarioService.pick(self.ROWS, answer, category, difficulty, list(exclusions), strict, self.FixedRandom(0))

    def test_the_answer_comes_before_the_category_and_the_difficulty(self):
        self.assertEqual(self.pick("SAFE", "Government", "Hard"), 3)    # genuine from another category, nearest level
        self.assertEqual(self.pick("REPORT", "Banking", "Hard"), 2)
        self.assertEqual(self.pick("SAFE", "Banking", "Hard"), 3)       # same category, nearest difficulty

    def test_a_player_chosen_category_is_kept(self):
        self.assertEqual(self.pick("SAFE", "Government", "Hard", strict=True), 1)   # only phishing there

    def test_the_other_answer_only_when_none_of_the_chosen_one_is_left(self):
        self.assertEqual(self.pick("SAFE", "Banking", "Easy", exclusions=({3, 4},)), 2)
        self.assertIsNone(self.pick("SAFE", "Banking", "Easy", exclusions=({1, 2, 3, 4},)))

    def test_dataset_severity_is_not_used_as_difficulty(self):
        row = {"text": "Hello, please verify your password at the link below within 24 hours.",
               "label": "1", "severity": "high"}
        record = ScenarioParser.parse_row(row, "EMAIL")
        self.assertEqual(record["difficulty"], ScenarioParser.infer_difficulty(record["phishing_cues"], True))
        self.assertNotEqual(record["difficulty"], "Hard")

    def test_a_campaign_email_needs_something_to_click(self):
        self.assertFalse(CampaignService.is_clickable("Use the secure link to restore access.", None))
        self.assertTrue(CampaignService.is_clickable("Restore access at https://example.test/restore", None))
        self.assertTrue(CampaignService.is_clickable("Notes attached.", "Notes.pdf"))

    def test_a_message_matching_no_category_is_general(self):
        self.assertEqual(ScenarioParser.infer_category("Thanks for the notes from today's sync."), "General")
        self.assertEqual(ScenarioParser.infer_category("Someone commented on your Instagram photo."), "Social Media")
        from app.services.progress_service import ProgressService
        all_rounder = next(badge for badge in ProgressService.BADGES if badge[0] == "all_rounder")
        self.assertEqual(all_rounder[4], 8)   # General is not one of the phishing categories the badge asks for
