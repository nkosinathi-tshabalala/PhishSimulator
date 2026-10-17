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
    # Phishing or genuine: balanced over the last 10 training messages, never more certain than 25%/75%
    ANSWER_WINDOW = 10
    MIN_PHISHING_CHANCE = 0.25
    MAX_PHISHING_CHANCE = 0.75

    @staticmethod
    def starting_difficulty(baseline_score=None):
        """CATCH Check stage: a baseline score of 70+ starts on Medium."""
        if baseline_score is not None and baseline_score >= AdaptiveEngine.BASELINE_PASS_SCORE:
            return "Medium"
        return "Easy"

    @staticmethod
    def baseline_in_effect(baselines, attempts):
        """The baseline score that sets the player's starting difficulty, or None.
        `baselines` holds (completed_at, score) pairs; `attempts` is the player's history.
        It is the latest baseline completed before the player's 5th training decision. From then on their
        answers decide the difficulty, so a baseline taken later is saved and shown but changes nothing:
        it can never jump an experienced player to another level."""
        training = sorted(
            attempt.attempted_at for attempt in attempts
            if not getattr(attempt, "campaign_recipient_id", None) and attempt.attempted_at
        )
        window = AdaptiveEngine.RECENT_ATTEMPT_COUNT
        cutoff = training[window - 1] if len(training) >= window else None
        eligible = [
            (completed_at, score) for completed_at, score in baselines
            if completed_at and (cutoff is None or completed_at <= cutoff)
        ]
        return max(eligible, key=lambda item: item[0])[1] if eligible else None

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
    def answer_of(attempt):
        """The right answer of a past decision ("REPORT" for phishing, "SAFE" for genuine)."""
        answer = (attempt.player_answer or "").upper()
        return answer if attempt.correct else ("SAFE" if answer == "REPORT" else "REPORT")

    @staticmethod
    def recommend_answer(attempts, rng=None):
        """Whether the next message is phishing ("REPORT") or genuine ("SAFE"), chosen before anything else so
        that its difficulty or category can never give the answer away. A weighted coin: the more phishing
        among the player's last 10 training messages, the likelier a genuine one next, but never certain
        either way (25% to 75%), so the order cannot be predicted. `attempts` are newest first."""
        rng = rng or SystemRandom()
        recent = [
            attempt for attempt in attempts if not getattr(attempt, "campaign_recipient_id", None)
        ][:AdaptiveEngine.ANSWER_WINDOW]
        if recent:
            phishing_share = sum(AdaptiveEngine.answer_of(a) == "REPORT" for a in recent) / len(recent)
            chance = min(max(1 - phishing_share, AdaptiveEngine.MIN_PHISHING_CHANCE), AdaptiveEngine.MAX_PHISHING_CHANCE)
        else:
            chance = 0.5
        return "REPORT" if rng.random() < chance else "SAFE"

    @staticmethod
    def recommend_category(category_attempts, occupation=None, rng=None):
        """Choose a varied, useful practice category without exposing a queue.
        `rng` makes the random pick repeatable (the demo seed passes one); the app uses SystemRandom."""
        rng = rng or SystemRandom()

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
                    rng.choice(unpractised),
                    f"Tailored for {occupation_name}: exploring a relevant category",
                )
            chosen = min(occupation_eligible, key=category_priority)
            return chosen, f"Tailored for {occupation_name}: reinforcing a relevant category"

        unpractised = [
            category for category in eligible
            if not category_attempts[category]
        ]
        if unpractised:
            return rng.choice(unpractised), "Exploring a new phishing category"

        chosen = min(eligible, key=category_priority)
        return chosen, "Targeting a category that needs more practice"
