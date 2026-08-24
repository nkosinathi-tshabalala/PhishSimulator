from app.enums.action_type import ActionType
from app.enums.difficulty_level import DifficultyLevel
from app.enums.scenario_type import ScenarioType


class ScenarioSchema:

    @staticmethod
    def validate_create(data):

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

        return True, None


    @staticmethod
    def validate_update(data):

        return ScenarioSchema.validate_create(data)