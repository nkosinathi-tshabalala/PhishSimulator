# Unit tests for the CATCH rules

import unittest
from datetime import date, timedelta
from types import SimpleNamespace

from app.adaptive.adaptive_engine import AdaptiveEngine
from app.analytics.feedback_generator import FeedbackGenerator
from app.datasets.scenario_parser import ScenarioParser
from app.services.progress_service import ProgressService
from app.utils.clues import (
    TRUST_SIGNALS,
    WARNING_SIGNS,
    clue_options,
    evaluate_justification,
    real_clues,
)


def make_scenario(answer="REPORT", cues="Suspicious link,Urgency,Fake sender", scenario_id=1):
    """A fake scenario with only the fields the rules read."""
    return SimpleNamespace(
        scenario_id=scenario_id,
        correct_answer=answer,
        get_phishing_cues=lambda: [cue for cue in cues.split(",") if cue],
    )


def make_attempts(results):
    """Attempts newest first, as the services load them."""
    return [SimpleNamespace(correct=result) for result in reversed(results)]


def make_fact(correct=True, difficulty="Easy", is_phishing=True, category="Banking", clue_score=None):
    """One attempt in the shape the progress rules expect."""
    return {
        "correct": correct,
        "difficulty": difficulty,
        "is_phishing": is_phishing,
        "category": category,
        "clue_score": clue_score,
        "xp": 0,
    }


class CheckStageTests(unittest.TestCase):
    """Slide 11: baseline score sets the starting difficulty."""

    def test_baseline_of_70_starts_on_medium(self):
        self.assertEqual(AdaptiveEngine.starting_difficulty(70), "Medium")

    def test_low_or_missing_baseline_starts_on_easy(self):
        self.assertEqual(AdaptiveEngine.starting_difficulty(69), "Easy")
        self.assertEqual(AdaptiveEngine.starting_difficulty(None), "Easy")


class AdaptiveTests(unittest.TestCase):
    """Slide 17: step one level at a time from the last five answers."""

    def test_four_of_five_steps_medium_up_to_hard(self):
        difficulty, _ = AdaptiveEngine.recommend_difficulty(
            make_attempts([True, True, False, True, True]), baseline_score=80,
        )
        self.assertEqual(difficulty, "Hard")

    def test_steps_are_one_level_not_a_jump(self):
        difficulty, _ = AdaptiveEngine.recommend_difficulty(
            make_attempts([True] * 5), baseline_score=None,
        )
        self.assertEqual(difficulty, "Medium")

    def test_below_60_steps_down(self):
        self.assertEqual(AdaptiveEngine.step("Hard", 40), "Medium")
        self.assertEqual(AdaptiveEngine.step("Easy", 40), "Easy")

    def test_between_60_and_79_stays(self):
        self.assertEqual(AdaptiveEngine.step("Medium", 60), "Medium")


class TestStageTests(unittest.TestCase):
    """Slide 13: reasons are matched to the real clues, decoys never help."""

    def test_selected_and_written_clues_both_count(self):
        scenario = make_scenario()
        decoy = next(option for option in clue_options(scenario) if option in TRUST_SIGNALS)
        result = evaluate_justification(
            scenario, ["Suspicious link", "Fake sender", decoy], "It says within 24 hours",
        )
        self.assertEqual(result["spotted"], ["Suspicious link", "Urgency", "Fake sender"])
        self.assertEqual(result["missed"], [])
        self.assertEqual(result["wrong_picks"], [decoy])
        self.assertEqual(result["score"], 67)

    def test_ticking_every_button_earns_nothing_extra(self):
        scenario = make_scenario()
        result = evaluate_justification(scenario, clue_options(scenario), "")
        self.assertEqual(result["net_found"], 0)
        self.assertEqual(result["score"], 0)

    def test_buttons_not_offered_are_ignored(self):
        result = evaluate_justification(make_scenario(), ["Not a clue", "Suspicious link"], "")
        self.assertEqual(result["wrong_picks"], [])

    def test_legacy_cue_names_are_understood(self):
        scenario = make_scenario(cues="Suspicious URL,Credential Request")
        self.assertEqual(real_clues(scenario), ["Suspicious link", "Credential request"])

    def test_safe_messages_use_trust_signals(self):
        clues = real_clues(make_scenario(answer="SAFE", cues=""))
        self.assertIn("Known sender", clues)
        self.assertIn("No personal info requested", clues)

    def test_options_mix_real_clues_with_decoys_and_are_stable(self):
        scenario = make_scenario()
        options = clue_options(scenario)
        self.assertEqual(len(options), 6)
        self.assertTrue(set(real_clues(scenario)) <= set(options))
        self.assertEqual(options, clue_options(scenario))

    def test_button_mix_does_not_reveal_the_answer(self):
        for scenario_id in range(1, 30):
            for scenario in (
                make_scenario("REPORT", scenario_id=scenario_id),
                make_scenario("SAFE", cues="", scenario_id=scenario_id),
            ):
                options = clue_options(scenario)
                self.assertEqual(sum(option in WARNING_SIGNS for option in options), 3)
                self.assertEqual(sum(option in TRUST_SIGNALS for option in options), 3)


class CorrectStageTests(unittest.TestCase):
    """Feedback straight after each decision: verdict, clues found and missed, and advice."""

    @staticmethod
    def feedback(answer="REPORT", cues="Suspicious link,Urgency", correct=True, selected=(), trap=None):
        scenario = make_scenario(answer, cues)
        scenario.simulation_type, scenario.category, scenario.feedback = "EMAIL", "Banking", None
        result = evaluate_justification(scenario, list(selected), "")
        return FeedbackGenerator.build(scenario, correct, result, trap)

    def test_phishing_feedback_lists_found_and_missed_clues_with_tips(self):
        feedback = self.feedback(selected=["Suspicious link"])
        self.assertEqual(feedback["headline"], "Correct: this was phishing")
        self.assertEqual([clue["name"] for clue in feedback["clues_spotted"]], ["Suspicious link"])
        self.assertEqual([clue["name"] for clue in feedback["clues_missed"]], ["Urgency"])
        self.assertTrue(all(clue["tip"] for clue in feedback["clues_spotted"] + feedback["clues_missed"]))
        self.assertEqual(feedback["threat_explanation"], FeedbackGenerator.CATEGORY_GUIDANCE["Banking"][0])

    def test_genuine_messages_are_explained_with_trust_signals(self):
        feedback = self.feedback(answer="SAFE", cues="", correct=False)
        self.assertEqual(feedback["headline"], "Not quite: this message was legitimate (the right choice was Mark Safe)")
        self.assertEqual(feedback["threat_explanation"], FeedbackGenerator.LEGITIMATE_EXPLANATION)
        self.assertIn("Trust signals", feedback["summary"])

    def test_clicking_a_phishing_link_says_you_were_phished(self):
        feedback = self.feedback(correct=False, trap="LINK")
        self.assertTrue(feedback["headline"].startswith("You've been phished"))
        self.assertEqual(feedback["trap_warning"], FeedbackGenerator.TRAP_WARNINGS["LINK"])


class HelpStageXpTests(unittest.TestCase):
    """Slide 15: (base + clue bonus) x level multiplier."""

    def test_slide_example_hard_two_clues_level_four(self):
        multiplier = ProgressService.multiplier(4)
        self.assertEqual(multiplier, 2.15)
        self.assertEqual(ProgressService.calculate_xp(True, "Hard", 2, multiplier), 86)

    def test_clue_bonus_is_capped_at_15(self):
        self.assertEqual(ProgressService.calculate_xp(True, "Easy", 5, 1), 25)

    def test_wrong_answer_earns_nothing(self):
        self.assertEqual(ProgressService.calculate_xp(False, "Hard", 3, 5), 0)

    def test_level_ten_multiplier_is_about_ten(self):
        self.assertAlmostEqual(ProgressService.multiplier(10), 9.9, places=1)

    def test_each_level_needs_one_and_a_half_times_more_xp(self):
        self.assertEqual(ProgressService.xp_needed_for_level(1), 100)
        self.assertEqual(ProgressService.xp_needed_for_level(2), 150)
        self.assertEqual(ProgressService.level_for_xp(250)["level"], 3)


class HelpStageRankTests(unittest.TestCase):
    """Slide 16: private skill rank from the last 20 attempts."""

    def test_fewer_than_ten_attempts_is_recruit(self):
        summary = ProgressService.summary_from_facts([make_fact()] * 9)
        self.assertEqual(summary["skill"]["tier"], "Recruit")

    def test_harder_scenarios_weigh_more(self):
        facts = [make_fact(True, "Hard")] * 5 + [make_fact(False, "Easy")] * 5
        rating = ProgressService.skill_rating(facts)["rating"]
        self.assertEqual(rating, 67)

    def test_guardian_needs_few_missed_phishing(self):
        facts = [make_fact(True)] * 18 + [make_fact(False, is_phishing=True)] * 2
        summary = ProgressService.summary_from_facts(facts)
        self.assertEqual(summary["skill"]["rating"], 90)
        self.assertEqual(summary["skill"]["tier"], "Defender")

    def test_rank_drop_lowers_the_multiplier(self):
        facts = [make_fact(True)] * 20 + [make_fact(False)] * 6
        summary = ProgressService.summary_from_facts(facts)
        self.assertTrue(summary["rank_dropped"])

    def test_badges(self):
        facts = [make_fact(True, clue_score=100)] * 10
        earned = {b["key"] for b in ProgressService.summary_from_facts(facts)["badges"] if b["earned"]}
        self.assertEqual(earned, {"day_one", "decisions_10", "first_catch", "clue_hunter", "category_master", "zero_misses"})

    def test_every_badge_has_a_group_and_a_way_to_earn_it(self):
        badges = ProgressService.summary_from_facts([])["badges"]
        self.assertEqual(len(badges), 15)
        self.assertTrue(all(b["group"] in ("streak", "milestone", "skill") and b["how"] for b in badges))

    def test_streak_badges_use_the_best_run(self):
        today = date(2026, 10, 1)
        # A 6-day run in September, then a 2-day run ending today
        days = [today - timedelta(days=offset) for offset in (0, 1, *range(10, 16))]
        facts = [{**make_fact(True), "date": day} for day in sorted(days)]
        streaks = ProgressService.daily_activity(facts, today=today)
        self.assertEqual((streaks["daily_streak"], streaks["longest_streak"]), (2, 6))
        progress = ProgressService.badge_progress(facts, [], streaks)
        self.assertEqual((progress["streak_5"], progress["streak_14"]), (5, 2))

    def test_skill_badges_for_hard_catches_categories_and_campaigns(self):
        facts = [make_fact(True, "Hard", category=name) for name in
                 ("Banking", "Delivery", "Government", "Employment", "University", "Password Reset",
                  "Microsoft 365", "Social Media")]
        facts.append({**make_fact(True), "campaign": True})
        progress = ProgressService.badge_progress(facts, [], {"daily_streak": 0, "longest_streak": 0})
        self.assertEqual((progress["sharp_eye"], progress["all_rounder"], progress["real_world_catch"]), (8, 8, 1))


class ParserTests(unittest.TestCase):
    """Slide 17: Easy = obvious clues, Hard = subtle clues."""

    def test_many_clues_is_easy_and_few_is_hard(self):
        self.assertEqual(ScenarioParser.infer_difficulty(["a", "b", "c"], True), "Easy")
        self.assertEqual(ScenarioParser.infer_difficulty(["a"], True), "Hard")

    def test_keywords_match_whole_words_only(self):
        self.assertNotIn("Credential request", ScenarioParser.extract_cues("Happy shopping this weekend"))
        self.assertIn("Credential request", ScenarioParser.extract_cues("Enter your PIN to continue"))

    def test_spam_is_not_treated_as_phishing(self):
        self.assertIsNone(ScenarioParser.normalize_label("spam"))
        self.assertEqual(ScenarioParser.normalize_label("smishing"), "PHISHING")

    def test_preprocessed_corpus_text_is_unreadable(self):
        self.assertTrue(ScenarioParser.is_unreadable("wed , 15 sep 2004 11 : 33 hi cable tv subscriber"))
        self.assertTrue(ScenarioParser.is_unreadable(
            "hpl nom may 25 2001 see attached file hplno 525 xls and please confirm the volumes today"
        ))
        self.assertFalse(ScenarioParser.is_unreadable("Your parcel is waiting. Pay the fee at www.x.co today."))

    def test_look_alike_sender_is_flagged(self):
        self.assertTrue(ScenarioParser.is_suspicious_sender("security@micr0soft.co"))
        self.assertFalse(ScenarioParser.is_suspicious_sender("noreply@microsoft.com"))


if __name__ == "__main__":
    unittest.main()
