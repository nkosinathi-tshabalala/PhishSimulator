class FeedbackGenerator:
    """Creates consistent learner feedback from a scenario and answer result."""

    LEGACY_DATASET_FEEDBACK = {
        "This message is labelled phishing. Review the listed indicators before reporting it.",
        "This message is labelled legitimate. Verify the sender and context before marking messages safe.",
    }

    @staticmethod
    def for_attempt(scenario, correct):
        cues = scenario.get_phishing_cues()
        is_phishing = scenario.correct_answer.upper() == "REPORT"
        message_kind = "smishing" if scenario.simulation_type.upper() == "SMS" else "phishing"

        if correct:
            result = (
                f"Correct — reporting this {message_kind} message was the safe choice."
                if is_phishing
                else "Correct — marking this legitimate message as safe was appropriate."
            )
        elif is_phishing:
            result = (
                f"This was a {message_kind} attempt. The safer choice was REPORT, not SAFE."
            )
        else:
            result = "This message was legitimate. The appropriate choice was SAFE, not REPORT."

        if cues:
            result += f" Key indicators: {', '.join(cues)}."
        elif is_phishing:
            result += " Review the sender, request, and context for subtle warning signs."
        else:
            result += " Legitimate messages should still be checked for an expected sender and context."

        # Administrator-authored guidance supplements, rather than replaces,
        # the decision-specific feedback above.
        if scenario.feedback and scenario.feedback not in FeedbackGenerator.LEGACY_DATASET_FEEDBACK:
            result += f" {scenario.feedback}"

        return result
