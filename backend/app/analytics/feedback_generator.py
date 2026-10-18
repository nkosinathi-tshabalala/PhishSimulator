# Builds the feedback a player sees after answering a scenario

from app.utils.clues import CLUE_TIPS, real_clues
from app.utils.links import explain_links


class FeedbackGenerator:
    """CATCH "Correct" stage: explains the result straight after each decision."""

    CATEGORY_GUIDANCE = {
        "Banking & Money": (
            "Money scams try to steal card details, or talk you into paying, lending or 'releasing' funds.",
            "Open your banking app yourself, and never send money because a message asks you to.",
        ),
        "Delivery": (
            "Parcel scams use small 'redelivery fees' to capture your card details.",
            "Track parcels on the courier's official website or app only.",
        ),
        "Government": (
            "Tax and government scams use authority and fines to rush you.",
            "Government bodies won't demand payment by SMS or email link. Phone them directly.",
        ),
        "Employment": (
            "Job scams collect ID documents or ask for 'training fees' up front.",
            "Check the company and recruiter independently before sharing documents.",
        ),
        "University": (
            "Student scams imitate campus IT or bursaries to steal university logins.",
            "Log in through the university portal you normally use, not an emailed link.",
        ),
        "Account Security": (
            "Fake account alerts ('unusual sign-in', 'account locked') capture your password on a look-alike page.",
            "If you didn't expect it, don't use the message: open the app or site yourself and check your account.",
        ),
        "Email & IT": (
            "Fake IT and mailbox alerts harvest work email passwords or get you to install malware.",
            "Report odd IT or Microsoft alerts to your IT team, and sign in only through the usual portal.",
        ),
        "Social Media": (
            "Social media scams hijack accounts or lure you with friend requests, dates and messages.",
            "Check alerts inside the app itself rather than through links you're sent.",
        ),
        "Prizes & Offers": (
            "Prize and offer scams promise something for nothing, then ask for fees, card details or a premium-rate call.",
            "You can't win a competition you never entered. Ignore it, or check on the company's own site.",
        ),
    }

    DEFAULT_GUIDANCE = (
        "Phishing messages imitate trusted senders to make you click, pay, or share details.",
        "When unsure, contact the organisation using details you already trust.",
    )

    LEGACY_DATASET_FEEDBACK = {
        "This message is labelled phishing. Review the listed indicators before reporting it.",
        "This message is labelled legitimate. Verify the sender and context before marking messages safe.",
    }

    LEGITIMATE_EXPLANATION = (
        "Real messages look different: a known sender, no password request, "
        "consistent branding and no artificial pressure."
    )

    TRAP_WARNINGS = {
        "LINK": (
            "In a real attack this click could install malware or open a fake login page "
            "that steals your password. Report the message to IT straight away."
        ),
        "ATTACHMENT": (
            "In a real attack this file could run malware or a fake login page the moment it "
            "opens. Risky types include .htm, .zip, .docm and .iso. Tell IT straight away."
        ),
    }

    @staticmethod
    def _headline(scenario, correct, trap=None):
        """One-line verdict shown at the top of the feedback."""
        is_phishing = scenario.correct_answer.upper() == "REPORT"
        kind = "smishing" if scenario.simulation_type.upper() == "SMS" else "phishing"

        if trap == "LINK" and is_phishing:
            return f"You've been phished: that link was part of a {kind} attack"
        if trap == "ATTACHMENT" and is_phishing:
            return "You've been phished: that attachment was malicious"
        if trap:
            return "Safe choice: this message was genuine"

        if correct and is_phishing:
            return f"Correct: this was {kind}"
        if correct:
            return "Correct: this message was safe"
        if is_phishing:
            return f"Missed: this was {kind} (the safe choice was Report)"
        return "Not quite: this message was legitimate (the right choice was Mark Safe)"

    @staticmethod
    def build(scenario, correct, clue_result, trap=None):
        """Return the full feedback shown to the player after an attempt."""
        is_phishing = scenario.correct_answer.upper() == "REPORT"
        threat, tip = FeedbackGenerator.CATEGORY_GUIDANCE.get(
            scenario.category, FeedbackGenerator.DEFAULT_GUIDANCE,
        )

        # Name the fake link and say what gives it away, e.g. "m1crosoft.com imitates Microsoft ..."
        link_reasons = explain_links(scenario.message or "")

        def with_tips(clues):
            """Pair each clue with its tip (for a suspicious link: which link, and why)."""
            return [{
                "name": clue,
                "tip": " ".join(link_reasons) if clue == "Suspicious link" and link_reasons else CLUE_TIPS.get(clue, ""),
            } for clue in clues]

        return {
            "headline": FeedbackGenerator._headline(scenario, correct, trap),
            "trap": trap,
            "trap_warning": FeedbackGenerator.TRAP_WARNINGS.get(trap) if is_phishing else None,
            "summary": FeedbackGenerator.for_attempt(scenario, correct),
            "threat_explanation": threat if is_phishing else FeedbackGenerator.LEGITIMATE_EXPLANATION,
            "safe_tip": tip,
            "clues_spotted": with_tips(clue_result["spotted"]),
            "clues_missed": with_tips(clue_result["missed"]),
            "also_present": with_tips(clue_result["also_present"]),
            "wrong_picks": clue_result["wrong_picks"],
            "admin_note": (
                scenario.feedback
                if scenario.feedback and scenario.feedback not in FeedbackGenerator.LEGACY_DATASET_FEEDBACK
                else None
            ),
        }

    @staticmethod
    def for_attempt(scenario, correct):
        """One-sentence feedback, stored with the attempt and shown in history."""
        headline = FeedbackGenerator._headline(scenario, correct)
        clues = real_clues(scenario)
        if not clues:
            return f"{headline}."

        label = "Key clues" if scenario.correct_answer.upper() == "REPORT" else "Trust signals"
        return f"{headline}. {label}: {', '.join(clues)}."
