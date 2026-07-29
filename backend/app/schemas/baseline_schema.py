from app.models.authentication import Player
from app.models.baseline import (
    BaselineAssessment,
    BaselineQuestion,
)

class BaselineSchema:
    """Validation rules for baseline assessment requests."""

    @staticmethod
    def validate_start_assessment(data):
        player_id = data.get("player_id")

        if not player_id:
            return False, "Player ID is required."

        if not isinstance(player_id, int):
            return False, "Player ID must be an integer."

        if not Player.query.get(player_id):
            return False, "Player not found."

        return True, None

    @staticmethod
    def validate_submit_response(data):
        assessment_id = data.get("assessment_id")
        question_id = data.get("question_id")
        answer_text = data.get("answer_text", "").strip()

        if not assessment_id:
            return False, "Assessment ID is required."

        if not question_id:
            return False, "Question ID is required."

        if not answer_text:
            return False, "Answer is required."

        if len(answer_text) < 10:
            return False, "Answer must contain at least 10 characters."

        if not BaselineAssessment.query.get(assessment_id):
            return False, "Assessment not found."

        if not BaselineQuestion.query.get(question_id):
            return False, "Question not found."

        return True, None

    @staticmethod
    def validate_complete_assessment(data):
        assessment_id = data.get("assessment_id")

        if not assessment_id:
            return False, "Assessment ID is required."

        if not isinstance(assessment_id, int):
            return False, "Assessment ID must be an integer."

        if not BaselineAssessment.query.get(assessment_id):
            return False, "Assessment not found."

        return True, None

    @staticmethod
    def validate_get_results(assessment_id):
        if not assessment_id:
            return False, "Assessment ID is required."

        if not isinstance(assessment_id, int):
            return False, "Assessment ID must be an integer."

        if not BaselineAssessment.query.get(assessment_id):
            return False, "Assessment not found."

        return True, None
    
    @staticmethod
    def validate_question(data):
        """Validate creating/updating a baseline question."""

        question = data.get("question", "").strip()
        instruction = data.get("instruction", "").strip()
        expected_keywords = data.get("expectedKeywords", [])
        example_answer = data.get("exampleAnswer", "").strip()
        feedback = data.get("feedback", "").strip()
        confidence_threshold = data.get("confidenceThreshold")

        if not question:
            return False, "Question is required."

        if len(question) < 10:
            return False, "Question must contain at least 10 characters."

        if not instruction:
            return False, "Instruction is required."

        if not expected_keywords:
            return False, "At least one expected keyword is required."

        if not isinstance(expected_keywords, list):
            return False, "Expected keywords must be a list."

        if not example_answer:
            return False, "Example answer is required."

        if not feedback:
            return False, "Feedback is required."

        if confidence_threshold is None:
            return False, "Confidence threshold is required."

        if not isinstance(confidence_threshold, int):
            return False, "Confidence threshold must be an integer."

        if confidence_threshold < 1:
            return False, "Confidence threshold must be at least 1."

        if confidence_threshold > len(expected_keywords):
            return False, (
                "Confidence threshold cannot exceed the number "
                "of expected keywords."
            )

        return True, None
    
    @staticmethod
    def validate_question_exists(question_id):

        if not question_id:
            return False, "Question ID is required."

        if not isinstance(question_id, int):
            return False, "Question ID must be an integer."

        question = BaselineQuestion.query.get(question_id)

        if not question:
            return False, "Question not found."

        return True, None
    
    @staticmethod
    def validate_delete_question(question_id):

        return BaselineSchema.validate_question_exists(
            question_id
        )