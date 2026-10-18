# Checks baseline quiz data before it is saved

from app.enums.occupation import Occupation
from app.models.baseline import (
    BaselineAssessment,
    BaselineQuestion,
)

class BaselineSchema:
    """Validation rules for baseline assessment requests."""

    @staticmethod
    def validate_submit_response(data):
        """Check a quiz answer submission."""
        assessment_id = data.get("assessment_id")
        question_id = data.get("question_id")
        answer_text = str(data.get("answer_text") or "").strip()

        if not assessment_id:
            return False, "Assessment ID is required."

        if not question_id:
            return False, "Question ID is required."

        if not answer_text:
            return False, "Answer is required."

        if len(answer_text) < 10:
            return False, "Answer must contain at least 10 characters."

        if len(answer_text) > 2000:
            return False, "Answer must be at most 2000 characters."

        if not BaselineAssessment.query.get(assessment_id):
            return False, "Assessment not found."

        if not BaselineQuestion.query.get(question_id):
            return False, "Question not found."

        return True, None

    @staticmethod
    def validate_complete_assessment(data):
        """Check a quiz completion request."""
        assessment_id = data.get("assessment_id")

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

        if "templateId" in data and not isinstance(data["templateId"], int):
            return False, "Choose the baseline assessment this question belongs to."

        return True, None

    @staticmethod
    def validate_template(data, require_name=True):
        """Check a baseline assessment's name, role and description."""
        name = str(data.get("name") or "").strip()
        if require_name and not name:
            return False, "Give the baseline assessment a name that says what it covers, e.g. Workplace Email and Payments."
        if len(name) > 120:
            return False, "The name can be at most 120 characters."
        occupation = data.get("occupation")
        if occupation not in (None, "", *(role.value for role in Occupation)):
            return False, "Role must be Student, Employee, Other, or empty for every role."
        if len(str(data.get("description") or "")) > 500:
            return False, "The description can be at most 500 characters."
        return True, None
    
    @staticmethod
    def validate_question_exists(question_id):
        """Check a question id was given."""
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
        """Check a question can be deleted."""
        return BaselineSchema.validate_question_exists(
            question_id
        )