# Checks scenario data entered by admins

from app.enums.action_type import ActionType
from app.enums.difficulty_level import DifficultyLevel
from app.enums.scenario_type import ScenarioType


class ScenarioSchema:
    """Validation for scenarios created or edited by admins."""

    # Longest text accepted per field (the database columns, and a sensible cap for the message)
    TEXT_LIMITS = {"title": 255, "category": 100, "sender": 255, "subject": 255, "message": 10_000, "feedback": 2_000}
    MAX_CUES = 20
    MAX_CUE_LENGTH = 100

    @staticmethod
    def validate_create(data):
        """Check a new scenario has every required field."""
        required_fields = [

            "title",

            "simulation_type",

            "category",

            "difficulty",

            "message",

            "correct_answer"

        ]

        if not isinstance(data, dict):
            return False, "The scenario details are missing."
        for field in required_fields:
            if not data.get(field):
                return False, f"{field} is required."
        for field, limit in ScenarioSchema.TEXT_LIMITS.items():
            value = data.get(field)
            if value is not None and not isinstance(value, str):
                return False, f"{field} must be text."
            if isinstance(value, str) and len(value) > limit:
                return False, f"{field} must be at most {limit} characters."
        cues = data.get("phishing_cues", [])
        if not isinstance(cues, list) or len(cues) > ScenarioSchema.MAX_CUES or not all(
            isinstance(cue, str) and len(cue) <= ScenarioSchema.MAX_CUE_LENGTH for cue in cues
        ):
            return False, f"phishing_cues must be a list of at most {ScenarioSchema.MAX_CUES} short clue names."

        valid_types = {member.value for member in ScenarioType}
        if data["simulation_type"] not in valid_types:
            return False, f"simulation_type must be one of {sorted(valid_types)}."

        valid_difficulties = {member.value for member in DifficultyLevel}
        if data["difficulty"] not in valid_difficulties:
            return False, f"difficulty must be one of {sorted(valid_difficulties)}."

        valid_answers = {member.value for member in ActionType}
        if data["correct_answer"] not in valid_answers:
            return False, f"correct_answer must be one of {sorted(valid_answers)}."

        # The training categories the app sorts imports into (the admin form offers the same list), so a typo
        # cannot create a category players see once and can never practise
        from app.datasets.scenario_parser import ScenarioParser
        valid_categories = [*ScenarioParser.CATEGORY_KEYWORDS, ScenarioParser.GENERAL_CATEGORY]
        if data["category"] not in valid_categories:
            return False, f"category must be one of {valid_categories}."

        attachment = data.get("attachment")
        if attachment is not None and not isinstance(attachment, str):
            return False, "attachment must be a file name."
        if attachment and (len(attachment) > 255 or "/" in attachment or "\\" in attachment):
            return False, "attachment must be a plain file name of 255 characters or fewer."

        return True, None

    @staticmethod
    def validate_update(data):
        """Edits follow the same rules as new scenarios."""
        return ScenarioSchema.validate_create(data)