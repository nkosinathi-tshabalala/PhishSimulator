# XP, levels, badges and the private skill rank (CATCH "Help")

from datetime import timedelta
from math import ceil

from app.datasets.scenario_parser import ScenarioParser
from app.extensions import db
from app.models.authentication import Player
from app.models.scenario import Scenario
from app.models.simulation import SimulationAttempt
from app.utils.clock import local_date, local_today


class ProgressService:
    """XP, levels, badges, daily goal and the private skill rank."""
    BASE_XP = {"Easy": 10, "Medium": 20, "Hard": 30}
    CLUE_BONUS = 5
    MAX_CLUE_BONUS = 15
    MULTIPLIER_GROWTH = 1.29
    FIRST_LEVEL_XP = 100
    LEVEL_XP_GROWTH = 1.5
    MAX_LEVEL = 10

    RATING_WINDOW = 20
    MIN_RATED_ATTEMPTS = 10
    DIFFICULTY_WEIGHTS = {"Easy": 1, "Medium": 1.5, "Hard": 2}
    TIERS = (
        ("Recruit", 0),
        ("Spotter", 50),
        ("Analyst", 65),
        ("Defender", 80),
        ("Guardian", 90),
    )
    GUARDIAN_MAX_MISSED_PERCENT = 5

    # (key, group, name, short description, target, how to earn it). Streaks build the habit,
    # milestones reward effort, and skill badges reward getting better, so most badges need skill.
    BADGES = (
        ("day_one", "streak", "Day One", "Practise for the first time", 1,
         "Make your first decision in any training mode."),
        ("streak_5", "streak", "5-Day Streak", "Practise 5 days in a row", 5,
         "Make at least one decision every day for 5 days. A day counts when you practise, not just log in."),
        ("streak_14", "streak", "2-Week Streak", "Practise 14 days in a row", 14,
         "Keep your daily practice going for 14 days without a gap."),
        ("streak_30", "streak", "Month Streak", "Practise 30 days in a row", 30,
         "A whole month of daily practice. Even one scenario a day keeps it alive."),
        ("decisions_10", "milestone", "Getting Started", "Complete 10 simulations", 10,
         "Answer 10 scenarios in email, SMS or Inbox Rush training. Campaign emails count too."),
        ("decisions_50", "milestone", "Committed", "Complete 50 simulations", 50,
         "Answer 50 scenarios in total."),
        ("decisions_100", "milestone", "Centurion", "Complete 100 simulations", 100,
         "Answer 100 scenarios in total."),
        ("first_catch", "skill", "First Catch", "First phishing message reported correctly", 1,
         "Report a phishing message correctly. Every mode counts, including Inbox Rush."),
        ("clue_hunter", "skill", "Clue Hunter", "Spot every clue in 5 scenarios", 5,
         "Answer correctly and tick every warning sign in the message, with no wrong picks. Do it 5 times."),
        ("sharp_eye", "skill", "Sharp Eye", "Catch 5 Hard phishing messages", 5,
         "Report 5 phishing messages from Hard scenarios correctly. Their clues are the subtlest."),
        ("zero_misses", "skill", "Zero Misses", "10 in a row with no missed phishing", 10,
         "Make 10 decisions in a row without marking a phishing message as safe. False alarms don't break the run."),
        ("category_master", "skill", "Category Master", "90%+ over 10 scenarios in one category", 10,
         "Answer 10 scenarios in one category, like Banking, and get at least 90% of them right. Retakes count."),
        ("all_rounder", "skill", "All-Rounder", "A correct decision in every category", len(ScenarioParser.CATEGORY_KEYWORDS),
         "Get at least one scenario right in each category: banking, delivery, government, jobs, university, "
         "passwords, Microsoft 365 and social media."),
        ("comeback", "skill", "Comeback", "Skill rank rises after a drop", 1,
         "Your skill rank has to drop and then climb back up. Keep training after a bad run."),
        ("real_world_catch", "skill", "Real-World Catch", "Report a phishing campaign email", 1,
         "Report a phishing test email that arrived in your real inbox, instead of clicking it."),
    )

    DAILY_GOAL = 5

    @staticmethod
    def xp_needed_for_level(level):
        """XP needed to go from `level` to the next one (x1.5 each level)."""
        return round(ProgressService.FIRST_LEVEL_XP * ProgressService.LEVEL_XP_GROWTH ** (level - 1))

    @staticmethod
    def level_for_xp(xp):
        """Return the level reached with `xp` and the progress into it."""
        level = 1
        remaining = xp
        while level < ProgressService.MAX_LEVEL:
            needed = ProgressService.xp_needed_for_level(level)
            if remaining < needed:
                return {"level": level, "xp_into_level": remaining, "xp_for_next_level": needed}
            remaining -= needed
            level += 1

        return {"level": level, "xp_into_level": remaining, "xp_for_next_level": None}

    @staticmethod
    def multiplier(level):
        """Level multiplier: 1.29 ^ (level - 1), so Level 10 is about 10x."""
        return round(ProgressService.MULTIPLIER_GROWTH ** (level - 1), 2)

    @staticmethod
    def calculate_xp(correct, difficulty, clues_found, multiplier):
        """(Base XP + clue bonus) x level multiplier. Wrong answers earn 0 XP."""
        if not correct:
            return 0

        base = ProgressService.BASE_XP.get(difficulty, ProgressService.BASE_XP["Easy"])
        bonus = min(clues_found * ProgressService.CLUE_BONUS, ProgressService.MAX_CLUE_BONUS)
        return round((base + bonus) * multiplier)

    @staticmethod
    def tier_for(rating, rated_attempts, missed_percent):
        """Return the index into TIERS for a rating."""
        if rated_attempts < ProgressService.MIN_RATED_ATTEMPTS:
            return 0

        index = 0
        for position, (_, threshold) in enumerate(ProgressService.TIERS):
            if rating >= threshold:
                index = position

        if index == len(ProgressService.TIERS) - 1 and (
            missed_percent > ProgressService.GUARDIAN_MAX_MISSED_PERCENT
        ):
            index -= 1
        return index

    @staticmethod
    def skill_rating(facts):
        """Weighted accuracy over the last 20 attempts (harder counts more)."""
        window = facts[-ProgressService.RATING_WINDOW:]
        if not window:
            return {"rating": 0, "rated_attempts": 0, "missed_percent": 0, "tier_index": 0}

        total_weight = 0
        earned_weight = 0
        for fact in window:
            weight = ProgressService.DIFFICULTY_WEIGHTS.get(fact["difficulty"], 1)
            total_weight += weight
            earned_weight += weight if fact["correct"] else 0

        rating = round(earned_weight / total_weight * 100)
        phishing_seen = [fact for fact in window if fact["is_phishing"]]
        missed = [fact for fact in phishing_seen if not fact["correct"]]
        missed_percent = round(len(missed) / len(phishing_seen) * 100) if phishing_seen else 0

        return {
            "rating": rating,
            "rated_attempts": len(window),
            "missed_percent": missed_percent,
            "tier_index": ProgressService.tier_for(rating, len(facts), missed_percent),
        }

    @staticmethod
    def tier_history(facts):
        """Tier index after each attempt, oldest first."""
        return [
            ProgressService.skill_rating(facts[:count])["tier_index"]
            for count in range(1, len(facts) + 1)
        ]

    @staticmethod
    def _longest_run_without_missed_phishing(facts):
        """Longest streak of attempts without missing a phishing message."""
        longest = current = 0
        for fact in facts:
            missed_phishing = fact["is_phishing"] and not fact["correct"]
            current = 0 if missed_phishing else current + 1
            longest = max(longest, current)
        return longest

    @staticmethod
    def _category_mastery_progress(facts):
        """Scenarios done (up to 10) in the best category that is at 90%+ accuracy."""
        by_category = {}
        for fact in facts:
            by_category.setdefault(fact["category"], []).append(fact["correct"])
        qualifying = [
            len(results) for results in by_category.values()
            if sum(results) / len(results) >= 0.9
        ]
        return min(max(qualifying, default=0), 10)

    @staticmethod
    def _had_comeback(tiers):
        """True when the tier dropped at some point and later rose again."""
        has_dropped = False
        for previous, current in zip(tiers, tiers[1:]):
            if current < previous:
                has_dropped = True
            elif has_dropped and current > previous:
                return True
        return False

    @staticmethod
    def _streak_progress(target, current, longest):
        """A streak badge is earned once any run reached the target; until then the current run counts."""
        return target if longest >= target else current

    @staticmethod
    def badge_progress(facts, tiers, streaks):
        """How far the player is towards each badge (compared with its target)."""
        caught = [fact for fact in facts if fact["is_phishing"] and fact["correct"]]
        categories_right = {fact["category"] for fact in facts if fact["correct"]}
        current, longest = streaks["daily_streak"], streaks["longest_streak"]
        return {
            "day_one": int(bool(facts)),
            "streak_5": ProgressService._streak_progress(5, current, longest),
            "streak_14": ProgressService._streak_progress(14, current, longest),
            "streak_30": ProgressService._streak_progress(30, current, longest),
            "decisions_10": len(facts),
            "decisions_50": len(facts),
            "decisions_100": len(facts),
            "first_catch": int(bool(caught)),
            "clue_hunter": sum(1 for fact in facts if fact["correct"] and fact["clue_score"] == 100),
            "sharp_eye": sum(1 for fact in caught if fact["difficulty"] == "Hard"),
            "zero_misses": ProgressService._longest_run_without_missed_phishing(facts),
            "category_master": ProgressService._category_mastery_progress(facts),
            "all_rounder": len(categories_right & set(ScenarioParser.CATEGORY_KEYWORDS)),
            "comeback": int(ProgressService._had_comeback(tiers)),
            "real_world_catch": int(any(fact.get("campaign") for fact in caught)),
        }

    @staticmethod
    def longest_streak(days):
        """The most practice days in a row, from a set of dates."""
        longest = 0
        for day in days:
            if day - timedelta(days=1) in days:
                continue  # not the start of a run
            length = 1
            while day + timedelta(days=length) in days:
                length += 1
            longest = max(longest, length)
        return longest

    @staticmethod
    def daily_activity(facts, today=None):
        """Practice-day streak and today's decisions (local days, see app/utils/clock.py)."""
        today = today or local_today()
        days = {fact["date"] for fact in facts if fact.get("date")}

        day = today if today in days else today - timedelta(days=1)
        streak = 0
        while day in days:
            streak += 1
            day -= timedelta(days=1)

        done_today = sum(1 for fact in facts if fact.get("date") == today)
        return {
            "daily_streak": streak,
            "longest_streak": ProgressService.longest_streak(days),
            "practised_today": today in days,
            "today_attempts": done_today,
            "daily_goal": ProgressService.DAILY_GOAL,
        }

    @staticmethod
    def attempt_facts(attempts, scenarios=None):
        """Turn attempts (any order) into simple dictionaries, oldest first.
        `scenarios` (id -> Scenario) can be passed in to avoid loading them again."""
        ordered = sorted(attempts, key=lambda attempt: (attempt.attempted_at, attempt.attempt_id))
        if scenarios is None:
            scenario_ids = {attempt.scenario_id for attempt in ordered}
            scenarios = {
                scenario.scenario_id: scenario
                for scenario in db.session.query(Scenario).filter(
                    Scenario.scenario_id.in_(scenario_ids)
                ).all()
            } if scenario_ids else {}

        facts = []
        for attempt in ordered:
            scenario = scenarios.get(attempt.scenario_id)
            facts.append({
                "correct": bool(attempt.correct),
                "is_phishing": bool(scenario and scenario.correct_answer.upper() == "REPORT"),
                "difficulty": attempt.difficulty or (scenario.difficulty if scenario else "Easy"),
                "category": scenario.category if scenario else "Unknown",
                "clue_score": attempt.clue_score,
                "xp": attempt.score or 0,
                "date": local_date(attempt.attempted_at) if attempt.attempted_at else None,
                "campaign": bool(attempt.campaign_recipient_id),
            })
        return facts

    @staticmethod
    def running_xp(facts):
        """Total XP, added up in time order and never below 0 at any step.
        A campaign penalty takes away only what the player has, so there is no hidden debt:
        whatever they earn afterwards shows straight away."""
        xp = 0
        for fact in facts:
            xp = max(xp + fact["xp"], 0)
        return xp

    @staticmethod
    def summary_from_facts(facts):
        """Build the private progress summary shown to one player."""
        xp = ProgressService.running_xp(facts)
        level_info = ProgressService.level_for_xp(xp)
        level = level_info["level"]

        rating = ProgressService.skill_rating(facts)
        tiers = ProgressService.tier_history(facts)
        tier_index = rating["tier_index"]
        peak_tier = max(tiers) if tiers else 0

        rank_dropped = tier_index < peak_tier
        multiplier_level = max(level - 1, 1) if rank_dropped else level

        tier_name = ProgressService.TIERS[tier_index][0]
        next_tier = (
            ProgressService.TIERS[tier_index + 1]
            if tier_index + 1 < len(ProgressService.TIERS) else None
        )
        streaks = ProgressService.daily_activity(facts)
        badge_progress = ProgressService.badge_progress(facts, tiers, streaks)

        return {
            "xp": xp,
            **level_info,
            "max_level": ProgressService.MAX_LEVEL,
            "multiplier": ProgressService.multiplier(multiplier_level),
            "rank_dropped": rank_dropped,
            "skill": {
                "rating": rating["rating"],
                "tier": tier_name,
                "tier_index": tier_index,
                "next_tier": next_tier[0] if next_tier else None,
                "next_tier_rating": next_tier[1] if next_tier else None,
                "rated_attempts": rating["rated_attempts"],
                "attempts_until_rated": max(ProgressService.MIN_RATED_ATTEMPTS - len(facts), 0),
                "missed_percent": rating["missed_percent"],
                "tiers": [
                    {"name": name, "min_rating": threshold}
                    for name, threshold in ProgressService.TIERS
                ],
            },
            "badges": [
                {
                    "key": key,
                    "group": group,
                    "name": name,
                    "description": description,
                    "how": how,
                    "earned": badge_progress[key] >= target,
                    "progress": min(badge_progress[key], target),
                    "target": target,
                }
                for key, group, name, description, target, how in ProgressService.BADGES
            ],
            **streaks,
        }

    @staticmethod
    def place_in(scores, own):
        """1-based position of `own` among (rated, rating, xp) scores, best first. Equal scores share a place."""
        return 1 + sum(score > own for score in scores)

    @staticmethod
    def top_percent(position, out_of):
        """The share of players at or above this position: #1 of 24 is the top 5%, #21 of 24 the top 88%.
        Small means good. Rounded up, because "top 5%" means within the best 5%."""
        return ceil(position / out_of * 100)

    @staticmethod
    def standing(player_id):
        """This player's position among ALL players. Rated players (10+ decisions) come first, by skill
        rating and then XP; players not yet rated follow, by XP. Only the position and the player count
        leave this method: never anyone else's name or score."""
        attempts_by_player = {player: [] for (player,) in db.session.query(Player.player_id)}
        for attempt in SimulationAttempt.query.all():
            attempts_by_player.setdefault(attempt.player_id, []).append(attempt)
        scenarios = {scenario.scenario_id: scenario for scenario in Scenario.query.all()}

        scores = {}
        for other_id, attempts in attempts_by_player.items():
            facts = ProgressService.attempt_facts(attempts, scenarios)
            rated = len(facts) >= ProgressService.MIN_RATED_ATTEMPTS
            rating = ProgressService.skill_rating(facts)["rating"] if rated else 0
            scores[other_id] = (rated, rating, ProgressService.running_xp(facts))

        out_of = len(scores)
        if player_id not in scores:
            return {"position": None, "out_of": out_of, "top_percent": None, "rated": False}
        position = ProgressService.place_in(scores.values(), scores[player_id])
        return {
            "position": position,
            "out_of": out_of,
            "top_percent": ProgressService.top_percent(position, out_of),
            "rated": scores[player_id][0],
        }

    @staticmethod
    def summary(attempts):
        """Progress summary for a player's attempts (training and campaign emails)."""
        return ProgressService.summary_from_facts(ProgressService.attempt_facts(attempts))
