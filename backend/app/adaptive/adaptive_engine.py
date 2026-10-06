# Adaptive engine: picks the next difficulty and category for each player

from random import SystemRandom


class AdaptiveEngine:
    """Determines a player's next scenario difficulty from recorded results."""

    RECENT_ATTEMPT_COUNT = 5
    RECENT_CATEGORY_COUNT = 2
    OCCUPATION_CATEGORY_PRIORITIES = {
        "Student": ("University", "Social Media", "Password Reset", "Delivery"),
        "Employee": ("Microsoft 365", "Employment", "Banking", "Password Reset"),
        "Other": ("Government", "Banking", "Delivery", "Social Media"),
    }

    DIFFICULTY_LEVELS = ("Easy", "Medium", "Hard")
    BASELINE_PASS_SCORE = 70
    STEP_UP_ACCURACY = 80
    STEP_DOWN_ACCURACY = 60

    @staticmethod
    def starting_difficulty(baseline_score=None):
        """CATCH Check stage: a baseline score of 70+ starts on Medium."""
        if baseline_score is not None and baseline_score >= AdaptiveEngine.BASELINE_PASS_SCORE:
            return "Medium"
        return "Easy"

    @staticmethod
    def step(difficulty, recent_accuracy):
        """Move one level up, one level down, or stay, based on the last five answers."""
        levels = AdaptiveEngine.DIFFICULTY_LEVELS
        index = levels.index(difficulty)

        if recent_accuracy >= AdaptiveEngine.STEP_UP_ACCURACY:
            return levels[min(index + 1, len(levels) - 1)]
        if recent_accuracy < AdaptiveEngine.STEP_DOWN_ACCURACY:
            return levels[max(index - 1, 0)]
        return difficulty

    @staticmethod
    def recommend_difficulty(attempts, baseline_score=None):
        """Replay the player's training history (newest first) to find their current difficulty.

        The baseline sets the start. After every 5 answers at a level, accuracy on those answers moves
        difficulty one step. After a change the window starts again, so the next decision is based on
        5 answers at the new level, never on answers given at the old one. Real-inbox campaign results
        are left out: those emails are not chosen at the player's difficulty."""
        window = AdaptiveEngine.RECENT_ATTEMPT_COUNT
        difficulty = AdaptiveEngine.starting_difficulty(baseline_score)
        training = [attempt for attempt in attempts if not getattr(attempt, "campaign_recipient_id", None)]

        if len(training) < window:
            reason = (
                "Baseline score is 70 or more"
                if difficulty == "Medium"
                else "New player: starting on Easy"
            )
            return difficulty, reason

        reason = ""
        at_this_level = []
        for attempt in reversed(training):  # oldest first
            at_this_level.append(attempt)
            if len(at_this_level) < window:
                continue
            recent = at_this_level[-window:]
            accuracy = sum(attempt.correct for attempt in recent) / window * 100
            new_difficulty = AdaptiveEngine.step(difficulty, accuracy)

            if new_difficulty != difficulty:
                direction = "up" if accuracy >= AdaptiveEngine.STEP_UP_ACCURACY else "down"
                reason = f"Last 5 accuracy {round(accuracy)}%: stepped {direction} to {new_difficulty}"
                difficulty = new_difficulty
                at_this_level = []  # judge the new level on its own answers
            else:
                reason = f"Last 5 accuracy {round(accuracy)}%: staying on {difficulty}"

        if len(at_this_level) < window:
            reason += f" ({window - len(at_this_level)} more at this level before the next check)"
        return difficulty, reason

    @staticmethod
    def recommend_category(category_attempts, occupation=None):
        """Choose a varied, useful practice category without exposing a queue."""

        if not category_attempts:
            return None, "No category-specific scenarios are available"

        recent_categories = [
            category for category, attempts in category_attempts.items()
            if attempts and attempts[0].attempted_at
        ]
        recent_categories.sort(
            key=lambda category: category_attempts[category][0].attempted_at,
            reverse=True,
        )
        recent_categories = set(recent_categories[:AdaptiveEngine.RECENT_CATEGORY_COUNT])

        eligible = [
            category for category in category_attempts
            if category not in recent_categories
        ] or list(category_attempts)

        def category_priority(category):
            """Sort key: lowest accuracy first, then fewest attempts."""
            attempts = category_attempts[category]
            accuracy = sum(attempt.correct for attempt in attempts) / len(attempts)
            return accuracy, len(attempts), category

        occupation_name = getattr(occupation, "value", occupation)
        occupation_categories = [
            category for category in AdaptiveEngine.OCCUPATION_CATEGORY_PRIORITIES.get(
                occupation_name, ()
            )
            if category in category_attempts
        ]
        if occupation_categories:
            occupation_eligible = [
                category for category in occupation_categories if category in eligible
            ] or occupation_categories
            unpractised = [
                category for category in occupation_eligible
                if not category_attempts[category]
            ]
            if unpractised:
                return (
                    SystemRandom().choice(unpractised),
                    f"Tailored for {occupation_name}: exploring a relevant category",
                )
            chosen = min(occupation_eligible, key=category_priority)
            return chosen, f"Tailored for {occupation_name}: reinforcing a relevant category"

        unpractised = [
            category for category in eligible
            if not category_attempts[category]
        ]
        if unpractised:
            return SystemRandom().choice(unpractised), "Exploring a new phishing category"

        chosen = min(eligible, key=category_priority)
        return chosen, "Targeting a category that needs more practice"
