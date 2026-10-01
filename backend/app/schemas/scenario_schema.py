# Checks scenario data entered by admins

from app.enums.action_type import ActionType
from app.enums.difficulty_level import DifficultyLevel
from app.enums.scenario_type import ScenarioType


class ScenarioSchema:
    """Validation for scenarios created or edited by admins."""

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

        for field in required_fields:
            if not data.get(field):
                return False, f"{field} is required."

        valid_types = {member.value for member in ScenarioType}
        if data["simulation_type"] not in valid_types:
            return False, f"simulation_type must be one of {sorted(valid_types)}."

        valid_difficulties = {member.value for member in DifficultyLevel}
        if data["difficulty"] not in valid_difficulties:
            return False, f"difficulty must be one of {sorted(valid_difficulties)}."

        valid_answers = {member.value for member in ActionType}
        if data["correct_answer"] not in valid_answers:
            return False, f"correct_answer must be one of {sorted(valid_answers)}."

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