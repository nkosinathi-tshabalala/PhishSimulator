# Unit tests for the CATCH rules

import unittest
from datetime import date, datetime, timedelta
from types import SimpleNamespace

from app.adaptive.adaptive_engine import AdaptiveEngine
from app.analytics.feedback_generator import FeedbackGenerator
from app.datasets.scenario_parser import ScenarioParser
from app.services.progress_service import ProgressService
from app.utils.links import link_problems
from app.utils.clues import (
    TRUST_SIGNALS,
    WARNING_SIGNS,
    clue_options,
    evaluate_justification,
    real_clues,
    round_key,
)


def make_scenario(answer="REPORT", cues="Suspicious link,Urgency,Fake sender", scenario_id=1,
                  sender="Capitec <alerts@capitecbank.co.za>"):
    """A fake scenario with only the fields the rules read."""
    return SimpleNamespace(
        scenario_id=scenario_id,
        correct_answer=answer,
        sender=sender,
        get_phishing_cues=lambda: [cue for cue in cues.split(",") if cue],
    )


def make_attempts(results):
    """Attempts newest first, as the services load them."""
    return [SimpleNamespace(correct=result) for result in reversed(results)]


def make_fact(correct=True, difficulty="Easy", is_phishing=True, category="Banking & Money", clue_score=None):
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

    def test_each_new_level_is_judged_on_its_own_five_answers(self):
        # One correct answer after reaching Medium must not jump straight to Hard
        self.assertEqual(AdaptiveEngine.recommend_difficulty(make_attempts([True] * 6))[0], "Medium")
        self.assertEqual(AdaptiveEngine.recommend_difficulty(make_attempts([True] * 9))[0], "Medium")
        self.assertEqual(AdaptiveEngine.recommend_difficulty(make_attempts([True] * 10))[0], "Hard")

    def test_steps_down_one_level_per_five_answers(self):
        attempts = make_attempts([False] * 6)
        self.assertEqual(AdaptiveEngine.recommend_difficulty(attempts, baseline_score=90)[0], "Easy")
        hard_start = make_attempts([True] * 10 + [False] * 6)
        self.assertEqual(AdaptiveEngine.recommend_difficulty(hard_start)[0], "Medium")

    def test_campaign_results_do_not_move_difficulty(self):
        campaign = [SimpleNamespace(correct=True, campaign_recipient_id=1) for _ in range(5)]
        self.assertEqual(AdaptiveEngine.recommend_difficulty(campaign)[0], "Easy")


class BaselineInEffectTests(unittest.TestCase):
    """Only a baseline taken before the 5th training decision sets the start; later ones change nothing."""

    start = datetime(2026, 10, 1, 9, 0)

    def history(self, count):
        """`count` training decisions, one per hour from 10:00."""
        return [SimpleNamespace(correct=True, attempted_at=self.start + timedelta(hours=1 + n)) for n in range(count)]

    def test_no_baseline_means_no_score(self):
        self.assertIsNone(AdaptiveEngine.baseline_in_effect([], self.history(3)))

    def test_new_player_uses_their_latest_baseline(self):
        baselines = [(self.start, 40), (self.start + timedelta(minutes=30), 90)]
        self.assertEqual(AdaptiveEngine.baseline_in_effect(baselines, self.history(2)), 90)

    def test_a_baseline_after_the_fifth_decision_is_ignored(self):
        later = self.start + timedelta(days=3)
        baselines = [(self.start, 40), (later, 90)]
        self.assertEqual(AdaptiveEngine.baseline_in_effect(baselines, self.history(10)), 40)

    def test_a_later_baseline_cannot_jump_an_experienced_player(self):
        # 10 answers: 80% (Easy -> Medium), then 60% (stay). Starting from Medium instead would end on Hard.
        oldest_first = self.history(10)
        for attempt, correct in zip(oldest_first, [True] * 4 + [False] + [True] * 3 + [False] * 2):
            attempt.correct = correct
        attempts = list(reversed(oldest_first))   # newest first, as the services load them
        baselines = [(self.start, 40), (self.start + timedelta(days=3), 90)]   # 90% taken after 10 decisions
        in_effect = AdaptiveEngine.baseline_in_effect(baselines, attempts)
        self.assertEqual(in_effect, 40)
        self.assertEqual(AdaptiveEngine.recommend_difficulty(attempts, in_effect)[0], "Medium")
        # What using the latest baseline (90%) would have done: jumped the player to Hard
        self.assertEqual(AdaptiveEngine.recommend_difficulty(attempts, 90)[0], "Hard")

    def test_campaign_emails_do_not_count_towards_the_five(self):
        campaign = [SimpleNamespace(correct=True, attempted_at=self.start + timedelta(hours=n), campaign_recipient_id=1)
                    for n in range(1, 8)]
        baselines = [(self.start + timedelta(days=1), 90)]
        self.assertEqual(AdaptiveEngine.baseline_in_effect(baselines, campaign), 90)


class TestStageTests(unittest.TestCase):
    """Slide 13: reasons are matched to the real clues, decoys never help."""

    def test_selected_and_written_clues_both_count(self):
        scenario = make_scenario()
        real = real_clues(scenario)
        offered = clue_options(scenario)
        real_offered = [option for option in offered if option in real]
        decoy = next(option for option in offered if option not in real)
        result = evaluate_justification(scenario, real_offered + [decoy], "It says within 24 hours")
        # A typed reason counts even when its button was not among the six
        self.assertEqual(set(result["spotted"]), set(real_offered) | {"Urgency"})
        self.assertEqual(result["missed"], [])
        self.assertEqual(result["wrong_picks"], [decoy])
        self.assertEqual(result["score"], round((len(real_offered) - 1) / len(real_offered) * 100))

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

    def test_a_message_without_a_sender_has_no_known_sender(self):
        clues = real_clues(make_scenario(answer="SAFE", cues="", sender=""))
        self.assertNotIn("Known sender", clues)
        self.assertIn("No personal info requested", clues)

    def test_options_mix_real_clues_with_decoys_and_are_stable(self):
        for scenario in (make_scenario(), make_scenario("SAFE", cues="")):
            real = real_clues(scenario)
            own = WARNING_SIGNS if scenario.correct_answer == "REPORT" else TRUST_SIGNALS
            for key in ("1:0", "1:1", "7:0", "7:3"):
                options = clue_options(scenario, key)
                self.assertEqual(len(options), 6)
                self.assertEqual(len(set(options)), 6)
                self.assertTrue(any(option in real for option in options), options)
                # A decoy on the answer's own side, so ticking that whole side never works
                self.assertTrue(any(option in own and option not in real for option in options), options)
                self.assertEqual(options, clue_options(scenario, key))

    def test_buttons_change_each_time_a_message_comes_back(self):
        scenario = make_scenario("SAFE", cues="")
        shown = {tuple(sorted(clue_options(scenario, f"7:{n}"))) for n in range(6)}
        self.assertGreater(len(shown), 2)

    def test_button_mix_does_not_reveal_the_answer(self):
        def trust_counts(answer, cues):
            return [sum(option in TRUST_SIGNALS for option in clue_options(make_scenario(answer, cues, scenario_id=n)))
                    for n in range(1, 301)]
        phishing, genuine = trust_counts("REPORT", "Suspicious link,Urgency,Fake sender"), trust_counts("SAFE", "")
        self.assertEqual(set(phishing), {2, 3, 4})
        self.assertEqual(set(genuine), {2, 3, 4})
        self.assertLess(abs(sum(phishing) / 300 - sum(genuine) / 300), 0.25)

    def test_round_key_counts_training_answers_only(self):
        attempts = [SimpleNamespace(scenario_id=5, campaign_recipient_id=None),
                    SimpleNamespace(scenario_id=5, campaign_recipient_id=9),
                    SimpleNamespace(scenario_id=6, campaign_recipient_id=None)]
        self.assertEqual(round_key(3, attempts, 5), "3:1")
        self.assertEqual(round_key(3, [], 5), "3:0")

    def test_trust_signals_that_depend_on_the_message(self):
        def clues(message, attachment=""):
            scenario = make_scenario("SAFE", cues="")
            scenario.message, scenario.attachment = message, attachment
            return real_clues(scenario)
        official = clues("Hi Thabo, your order has shipped. Track it at https://www.takealot.com/orders")
        self.assertIn("Official link", official)
        self.assertIn("Personal greeting", official)
        self.assertNotIn("No link or attachment", official)
        plain = clues("Dear customer, your statement is ready. We will never ask for your PIN.")
        self.assertIn("No link or attachment", plain)
        self.assertIn("Safe way to check", plain)
        self.assertNotIn("Personal greeting", plain)
        for group in ("Dear Student, exams start Monday.", "Dear Residents, water is off today.", "Hi all, see you"):
            self.assertNotIn("Personal greeting", clues(group), group)
        self.assertIn("Personal greeting", clues("Good morning Lerato, your parcel is at the counter."))
        self.assertIn("Personal greeting", clues("Dear Ms Naidoo, your statement is ready."))
        self.assertNotIn("Official link", plain)
        self.assertNotIn("No link or attachment", clues("Your payslip is attached.", attachment="Payslip.pdf"))
        self.assertNotIn("Official link", clues("Hi Thabo, confirm at https://takealot-secure-login.xyz/verify"))


class CorrectStageTests(unittest.TestCase):
    """Feedback straight after each decision: verdict, clues found and missed, and advice."""

    @staticmethod
    def feedback(answer="REPORT", cues="Suspicious link,Urgency", correct=True, selected=(), trap=None):
        scenario = make_scenario(answer, cues)
        scenario.simulation_type, scenario.category, scenario.feedback = "EMAIL", "Banking & Money", None
        scenario.message = "Your card is blocked. Unlock it at [Secure my account](https://fnb-verify.co.za/unlock)"
        # A showing whose buttons include every real clue (when one exists), so "missed" covers all of them
        key = next((key for key in map(str, range(200))
                    if set(real_clues(scenario)) <= set(clue_options(scenario, key))), "")
        result = evaluate_justification(scenario, list(selected), "", key)
        return FeedbackGenerator.build(scenario, correct, result, trap)

    def test_phishing_feedback_lists_found_and_missed_clues_with_tips(self):
        feedback = self.feedback(selected=["Suspicious link"])
        self.assertEqual(feedback["headline"], "Correct: this was phishing")
        self.assertEqual([clue["name"] for clue in feedback["clues_spotted"]], ["Suspicious link"])
        self.assertEqual([clue["name"] for clue in feedback["clues_missed"]], ["Urgency"])
        self.assertTrue(all(clue["tip"] for clue in feedback["clues_spotted"] + feedback["clues_missed"]))
        self.assertEqual(feedback["threat_explanation"], FeedbackGenerator.CATEGORY_GUIDANCE["Banking & Money"][0])

    def test_a_missed_link_clue_names_the_fake_link_and_why(self):
        missed = {clue["name"]: clue["tip"] for clue in self.feedback()["clues_missed"]}
        self.assertIn("fnb-verify.co.za", missed["Suspicious link"])
        self.assertIn("FNB", missed["Suspicious link"])

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
                 ("Banking & Money", "Delivery", "Government", "Employment", "University", "Account Security",
                  "Email & IT", "Social Media", "Prizes & Offers")]
        facts.append({**make_fact(True), "campaign": True})
        progress = ProgressService.badge_progress(facts, [], {"daily_streak": 0, "longest_streak": 0})
        self.assertEqual((progress["sharp_eye"], progress["all_rounder"], progress["real_world_catch"]), (9, 9, 1))


class LinkTests(unittest.TestCase):
    """A link is a warning sign only when it looks fake, never just for being there."""

    def test_genuine_links_are_fine(self):
        for url in ("https://www.takealot.com/orders", "https://teams.microsoft.com/l/meetup-join/",
                    "https://www.sars.gov.za/efiling", "https://onedrive.live.com/view", "https://www.up.ac.za/portal"):
            self.assertEqual(link_problems(url), [], url)

    def test_fake_links_are_caught_with_a_reason(self):
        cases = {
            "www.m1crosoft.com": "swapping letters for numbers",
            "https://paypal.com.secure-login.ru/verify": "PayPal",
            "http://192.168.10.4/login": "IP address",
            "https://bit.ly/3xYz": "shortener",
            "http://microsoft.com@evil.ru/login": "after the '@'",
            "https://nsfas-portal-za.com/confirm": "NSFAS",
            "https://customs-clearance-za.info/pay": "South African",
            "https://parcel-check.xyz/pay": ".xyz",
        }
        for url, reason in cases.items():
            problems = link_problems(url)
            self.assertTrue(problems and reason in " ".join(problems), (url, problems))

    def test_only_a_fake_link_becomes_the_suspicious_link_clue(self):
        self.assertNotIn("Suspicious link", ScenarioParser.extract_cues("Track it at https://www.takealot.com/orders"))
        self.assertIn("Suspicious link", ScenarioParser.extract_cues("Track it at https://takealot-redeliver.co.za"))

    def test_organisation_phone_numbers_are_not_personal_data(self):
        self.assertEqual(ScenarioParser.find_personal_data("Call 0800 110 929 or 0860 10 20 43"), [])
        self.assertEqual(ScenarioParser.find_personal_data("Call 09061701461 to claim, or 08712400200"), [])
        self.assertEqual(ScenarioParser.find_personal_data("Call me on 082 555 1234"), ["phone number"])

    def test_made_up_addresses_are_not_personal_data(self):
        self.assertEqual(ScenarioParser.find_personal_data("Sent to you@example.com"), [])
        self.assertEqual(ScenarioParser.personal_details("Mail jadkins@pths209.org"), [("email address", "ja***@pths209.org")])


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

    def test_a_body_stored_twice_is_kept_once(self):
        body = "Password will expire in 2 days. Click Here To Validate E-mail Thank you, Copyright 1993-2013"
        self.assertEqual(ScenarioParser.drop_repeated_text(f"{body} {body}"), body)
        self.assertEqual(ScenarioParser.drop_repeated_text("Hi Hi there"), "Hi Hi there")
        self.assertEqual(ScenarioParser.drop_repeated_text("Pay now. Pay now. Pay now. Pay now."), "Pay now. Pay now. Pay now. Pay now.")

    def test_look_alike_sender_is_flagged(self):
        self.assertTrue(ScenarioParser.is_suspicious_sender("security@micr0soft.co"))
        self.assertFalse(ScenarioParser.is_suspicious_sender("noreply@microsoft.com"))


if __name__ == "__main__":
    unittest.main()
