# Tests for the chart data on the analytics pages

import unittest
from datetime import date, datetime
from types import SimpleNamespace

from app.analytics import trends

TODAY = date(2026, 9, 28)


def attempt(day, correct, answer="REPORT", scenario_id=1, difficulty="Easy"):
    """A fake attempt with only the fields the chart helpers read."""
    return SimpleNamespace(
        attempted_at=datetime(2026, 9, day, 10, 0),
        correct=correct,
        player_answer=answer,
        scenario_id=scenario_id,
        difficulty=difficulty,
    )


class TrendTests(unittest.TestCase):
    """Daily, weekly, learning-curve and category numbers."""

    def test_daily_counts_decisions_and_accuracy(self):
        rows = trends.daily([attempt(28, True), attempt(28, False), attempt(27, True)], 3, today=TODAY)
        self.assertEqual([row["decisions"] for row in rows], [0, 1, 2])
        self.assertEqual(rows[-1]["accuracy"], 50)
        self.assertIsNone(rows[0]["accuracy"])

    def test_weekly_errors_split_missed_phishing_and_false_alarms(self):
        week = [attempt(28, False, "SAFE"), attempt(28, False, "REPORT"), attempt(28, True), attempt(28, True)]
        latest = trends.weekly_errors(week, 2, today=TODAY)[-1]
        self.assertEqual((latest["missed_phishing"], latest["false_alarms"], latest["accuracy"]), (25, 25, 50))

    def test_learning_curve_uses_a_rolling_window(self):
        points = trends.learning_curve([attempt(20 + i, i >= 2) for i in range(4)], window=2)
        self.assertEqual([point["accuracy"] for point in points], [0, 0, 50, 100])

    def test_categories_are_sorted_by_decisions(self):
        rows = trends.by_category([attempt(28, True, scenario_id=2), attempt(28, False, scenario_id=2), attempt(28, True)],
                                  {1: "Banking", 2: "Delivery"})
        self.assertEqual([(row["category"], row["decisions"], row["accuracy"]) for row in rows],
                         [("Delivery", 2, 50), ("Banking", 1, 100)])


if __name__ == "__main__":
    unittest.main()
