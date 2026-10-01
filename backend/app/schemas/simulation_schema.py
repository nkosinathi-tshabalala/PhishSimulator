# Checks a player's answer before it is scored

class SimulationSchema:
    """Validation rules for simulation attempt requests."""

    VALID_ANSWERS = {"REPORT", "SAFE"}
    MAX_CLUES = 6
    MAX_JUSTIFICATION_LENGTH = 500

    @staticmethod
    def validate_attempt(data):
        """Check a submitted decision before it is scored."""
        if not isinstance(data, dict):
            return False, "A JSON request body is required."

        scenario_id = data.get("scenario_id")
        if not isinstance(scenario_id, int) or isinstance(scenario_id, bool):
            return False, "scenario_id must be an integer."

        answer = str(data.get("player_answer", "")).upper().strip()
        if answer not in SimulationSchema.VALID_ANSWERS:
            return False, "player_answer must be either REPORT or SAFE."

        selected_clues = data.get("selected_clues", [])
        if not isinstance(selected_clues, list) or not all(
            isinstance(clue, str) for clue in selected_clues
        ):
            return False, "selected_clues must be a list of clue names."
        if len(selected_clues) > SimulationSchema.MAX_CLUES:
            return False, f"Choose at most {SimulationSchema.MAX_CLUES} clues."

        justification = data.get("justification", "")
        if not isinstance(justification, str):
            return False, "justification must be text."
        if len(justification) > SimulationSchema.MAX_JUSTIFICATION_LENGTH:
            return False, "justification must be 500 characters or fewer."

        clicked_link = data.get("clicked_link", False)
        opened_attachment = data.get("opened_attachment", False)
        if not isinstance(clicked_link, bool) or not isinstance(opened_attachment, bool):
            return False, "clicked_link and opened_attachment must be true or false."
        if clicked_link and opened_attachment:
            return False, "Record either a clicked link or an opened attachment, not both."
        if (clicked_link or opened_attachment) and answer != "SAFE":
            return False, "A click or opened file is recorded as trusting the message (SAFE)."

        if not selected_clues and not justification.strip():
            return False, "Explain your decision: pick at least one clue or write a reason."

        return True, None
