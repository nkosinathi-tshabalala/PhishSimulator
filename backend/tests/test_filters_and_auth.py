# Tests for the metrics filters and the password rules

import unittest
from datetime import date, datetime
from types import SimpleNamespace

from app.analytics.filters import MAX_CHART_DAYS, MetricFilters
from app.schemas.auth_schema import AuthSchema
from app.services.auth_service import hash_token
from app.services.progress_service import ProgressService

TODAY = date(2026, 10, 1)


class FilterTests(unittest.TestCase):
    """Reading the filters from the URL and sizing the charts."""

    def test_quick_range_counts_back_from_today(self):
        filters = MetricFilters.from_args({"range": "7d"}, today=TODAY)
        self.assertEqual((filters.start, filters.end), (date(2026, 9, 25), TODAY))

    def test_unknown_values_are_ignored(self):
        filters = MetricFilters.from_args({"channel": "FAX", "start": "2026-13-40", "group": "pilots"})
        self.assertEqual((filters.channel, filters.start, filters.group), ("", None, ""))
        self.assertFalse(filters.is_set())

    def test_values_match_in_any_case_and_dates_are_put_in_order(self):
        filters = MetricFilters.from_args({"channel": "sms", "difficulty": "HARD", "start": "2026-09-30", "end": "2026-09-01"})
        self.assertEqual((filters.channel, filters.difficulty), ("SMS", "Hard"))
        self.assertEqual((filters.start, filters.end), (date(2026, 9, 1), date(2026, 9, 30)))

    def test_chart_window_covers_the_chosen_dates(self):
        filters = MetricFilters(start=date(2026, 9, 1), end=date(2026, 9, 30))
        self.assertEqual(filters.chart_window([]), (30, date(2026, 9, 30)))

    def test_all_time_starts_at_the_first_attempt_and_is_capped(self):
        first = SimpleNamespace(attempted_at=datetime(2026, 9, 20, 9, 0))
        self.assertEqual(MetricFilters().chart_window([first], today=TODAY), (12, TODAY))
        ancient = SimpleNamespace(attempted_at=datetime(2020, 1, 1, 9, 0))
        self.assertEqual(MetricFilters().chart_window([ancient], today=TODAY)[0], MAX_CHART_DAYS)


class PasswordTests(unittest.TestCase):
    """The shared password rule and reset-token hashing."""

    def test_password_needs_length_a_letter_and_a_number(self):
        self.assertIn("8 characters", AuthSchema.password_problem("ab1"))
        self.assertIn("letter and one number", AuthSchema.password_problem("abcdefgh"))
        self.assertIsNone(AuthSchema.password_problem("Player#2026"))

    def test_new_password_must_match_its_confirmation(self):
        valid, error = AuthSchema.validate_new_password({"new_password": "abcd1234", "confirm_password": "abcd12345"})
        self.assertFalse(valid)
        self.assertEqual(error, "New passwords do not match.")

    def test_emails_are_compared_in_lower_case(self):
        self.assertEqual(AuthSchema.clean_email("  You+Test@Gmail.COM "), "you+test@gmail.com")

    def test_reset_tokens_are_stored_hashed(self):
        self.assertEqual(hash_token("abc"), hash_token("abc"))
        self.assertNotIn("abc", hash_token("abc"))
        self.assertEqual(len(hash_token("abc")), 64)


class StandingTests(unittest.TestCase):
    """The private "#N of M" position."""

    def test_best_rating_is_first_and_xp_breaks_ties(self):
        scores = [(90, 100), (75, 400), (75, 200), (40, 900)]
        self.assertEqual(ProgressService.place_in(scores, (90, 100)), 1)
        self.assertEqual(ProgressService.place_in(scores, (75, 200)), 3)
        self.assertEqual(ProgressService.place_in(scores, (40, 900)), 4)

    def test_equal_scores_share_a_place(self):
        self.assertEqual(ProgressService.place_in([(80, 50), (80, 50)], (80, 50)), 1)

    def test_unrated_players_count_but_rank_below_every_rated_player(self):
        scores = [(True, 40, 10), (True, 90, 300), (False, 0, 900), (False, 0, 50)]
        self.assertEqual(ProgressService.place_in(scores, (True, 40, 10)), 2)
        self.assertEqual(ProgressService.place_in(scores, (False, 0, 900)), 3)
        self.assertEqual(ProgressService.place_in(scores, (False, 0, 50)), 4)

    def test_top_percent_is_small_for_the_best_players(self):
        self.assertEqual(ProgressService.top_percent(1, 24), 5)
        self.assertEqual(ProgressService.top_percent(12, 24), 50)
        self.assertEqual(ProgressService.top_percent(21, 24), 88)


if __name__ == "__main__":
    unittest.main()
