class SimulationSchema:
    """Validation rules for simulation attempt requests."""

    VALID_ANSWERS = {"REPORT", "SAFE"}

    @staticmethod
    def validate_attempt(data):
        if not isinstance(data, dict):
            return False, "A JSON request body is required."

        scenario_id = data.get("scenario_id")
        if not isinstance(scenario_id, int) or isinstance(scenario_id, bool):
            return False, "scenario_id must be an integer."

        answer = str(data.get("player_answer", "")).upper().strip()
        if answer not in SimulationSchema.VALID_ANSWERS:
            return False, "player_answer must be either REPORT or SAFE."

        return True, None
