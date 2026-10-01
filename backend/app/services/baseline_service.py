# Baseline quiz: marking answers and managing questions (CATCH "Check")

from datetime import datetime
from random import SystemRandom

from app.extensions import db
from app.adaptive.adaptive_engine import AdaptiveEngine
from app.models.authentication import Player
from app.models.baseline import BaselineAssessment, BaselineQuestion, BaselineResponse
from app.schemas.baseline_schema import BaselineSchema


class BaselineService:
    """CATCH "Check" stage: a keyword-scored quiz that sets the starting difficulty."""

    @staticmethod
    def _serialize_question(question, include_answers=False):
        """Players only see the question; admins also see the hint and marking guide."""
        data = {
            "id": question.question_id,
            "question": question.question_text,
            "confidenceThreshold": question.confidence_threshold,
        }
        if include_answers:
            data.update({
                "instruction": question.instruction,
                "expectedKeywords": question.get_expected_keywords(),
                "exampleAnswer": question.example_answer,
                "feedback": question.feedback,
            })
        return data

    @staticmethod
    def _serialize_result(response):
        """A marked answer, including the marking guide now that it's answered."""
        question = response.question
        return {
            "questionId": question.question_id,
            "question": question.question_text,
            "userAnswer": response.answer_text,
            "matchedKeywords": response.get_matched_keywords(),
            "expectedKeywords": question.get_expected_keywords(),
            "exampleAnswer": question.example_answer,
            "feedback": question.feedback,
            "score": response.score,
            "maxScore": len(question.get_expected_keywords()),
            "passed": response.passed,
        }

    @staticmethod
    def _confidence_level(overall_percent):
        """Label the overall quiz score."""
        if overall_percent >= AdaptiveEngine.BASELINE_PASS_SCORE:
            return "Intermediate"
        if overall_percent >= 40:
            return "Beginner"
        return "Novice"

    @staticmethod
    def _summary(assessment, responses):
        """The quiz result with every marked answer."""
        results = [BaselineService._serialize_result(response) for response in responses]
        overall_percent = round(assessment.score or 0)
        return {
            "assessmentId": assessment.assessment_id,
            "overallScore": overall_percent,
            "questionsPassed": sum(1 for response in responses if response.passed),
            "totalKeywordsMatched": sum(response.score for response in responses),
            "confidenceLevel": BaselineService._confidence_level(overall_percent),
            "startingDifficulty": AdaptiveEngine.starting_difficulty(overall_percent),
            "completedAt": (
                assessment.completed_at.isoformat() if assessment.completed_at else None
            ),
            "results": results,
        }

    @staticmethod
    def _player_for(user_id):
        """The player profile for a user id."""
        return Player.query.filter_by(user_id=int(user_id)).first()

    @staticmethod
    def _owned_assessment(assessment_id, user_id):
        """Return the assessment only if it belongs to this user's player."""
        player = BaselineService._player_for(user_id)
        assessment = db.session.get(BaselineAssessment, assessment_id)
        if not player or not assessment or assessment.player_id != player.player_id:
            return None
        return assessment

    @staticmethod
    def _randomised_questions(player_id):
        """Return a new question order, avoiding the player's last order."""
        questions = BaselineQuestion.query.order_by(BaselineQuestion.question_id.asc()).all()
        SystemRandom().shuffle(questions)
        if len(questions) < 2:
            return questions

        previous_assessment = BaselineAssessment.query.filter(
            BaselineAssessment.player_id == player_id,
            BaselineAssessment.completed_at.isnot(None),
        ).order_by(BaselineAssessment.completed_at.desc()).first()
        if not previous_assessment:
            return questions

        previous_order = [
            response.question_id
            for response in BaselineResponse.query.filter_by(
                assessment_id=previous_assessment.assessment_id,
            ).order_by(BaselineResponse.response_id.asc()).all()
        ]
        if previous_order == [question.question_id for question in questions]:
            questions = questions[1:] + questions[:1]
        return questions

    @staticmethod
    def start_assessment(user_id):
        """Create a new assessment and return its questions (without answers)."""
        player = BaselineService._player_for(user_id)
        if not player:
            return False, "Player profile not found.", None

        assessment = BaselineAssessment(player_id=player.player_id)
        db.session.add(assessment)
        db.session.commit()

        questions = BaselineService._randomised_questions(player.player_id)
        return True, "Baseline assessment started successfully.", {
            "assessment_id": assessment.assessment_id,
            "questions": [BaselineService._serialize_question(question) for question in questions],
        }

    @staticmethod
    def submit_response(data, user_id):
        """Mark one answer by counting the expected keywords it contains."""
        is_valid, error = BaselineSchema.validate_submit_response(data)
        if not is_valid:
            return False, error, None

        assessment = BaselineService._owned_assessment(data["assessment_id"], user_id)
        if not assessment:
            return False, "Assessment not found.", None
        if assessment.completed_at:
            return False, "This assessment is already complete.", None

        question = db.session.get(BaselineQuestion, data["question_id"])
        if not question:
            return False, "Question not found.", None

        answer = data["answer_text"].lower()
        matched_keywords = [
            keyword for keyword in question.get_expected_keywords()
            if keyword.lower() in answer
        ]
        score = len(matched_keywords)

        response = BaselineResponse.query.filter_by(
            assessment_id=assessment.assessment_id,
            question_id=question.question_id,
        ).first() or BaselineResponse(
            assessment_id=assessment.assessment_id,
            question_id=question.question_id,
        )
        response.answer_text = data["answer_text"]
        response.matched_keywords = ",".join(matched_keywords)
        response.score = score
        response.passed = score >= question.confidence_threshold
        db.session.add(response)
        db.session.commit()

        return True, "Response submitted successfully.", BaselineService._serialize_result(response)

    @staticmethod
    def complete_assessment(data, user_id):
        """Work out the overall percentage and the starting difficulty."""
        is_valid, error = BaselineSchema.validate_complete_assessment(data)
        if not is_valid:
            return False, error, None

        assessment = BaselineService._owned_assessment(data["assessment_id"], user_id)
        if not assessment:
            return False, "Assessment not found.", None

        responses = BaselineResponse.query.filter_by(
            assessment_id=assessment.assessment_id
        ).order_by(BaselineResponse.response_id.asc()).all()
        if not responses:
            return False, "No responses found.", None

        total_score = sum(response.score for response in responses)
        total_max = sum(len(response.question.get_expected_keywords()) for response in responses)

        assessment.score = round(total_score / total_max * 100) if total_max else 0
        assessment.completed_at = datetime.utcnow()
        db.session.commit()

        return True, "Assessment completed successfully.", BaselineService._summary(
            assessment, responses,
        )

    @staticmethod
    def get_latest_result(user_id):
        """Return the player's latest completed assessment, or None."""
        player = BaselineService._player_for(user_id)
        if not player:
            return False, "Player profile not found.", None

        assessment = BaselineAssessment.query.filter(
            BaselineAssessment.player_id == player.player_id,
            BaselineAssessment.completed_at.isnot(None),
        ).order_by(BaselineAssessment.completed_at.desc()).first()
        if not assessment:
            return True, "No completed baseline assessment found.", None

        responses = BaselineResponse.query.filter_by(
            assessment_id=assessment.assessment_id
        ).order_by(BaselineResponse.response_id.asc()).all()
        return True, "Latest baseline result retrieved successfully.", BaselineService._summary(
            assessment, responses,
        )

    @staticmethod
    def get_questions():
        """All questions with their marking guides (admin)."""
        questions = BaselineQuestion.query.order_by(BaselineQuestion.question_id.asc()).all()
        return True, "Baseline questions retrieved successfully.", [
            BaselineService._serialize_question(question, include_answers=True)
            for question in questions
        ]

    @staticmethod
    def get_question(question_id):
        """One question with its marking guide (admin)."""
        question = db.session.get(BaselineQuestion, question_id)
        if not question:
            return False, "Question not found.", None
        return True, "Question retrieved successfully.", BaselineService._serialize_question(
            question, include_answers=True,
        )

    @staticmethod
    def _apply_question_fields(question, data):
        """Copy form fields onto a question."""
        question.question_text = data["question"]
        question.instruction = data["instruction"]
        question.expected_keywords = ",".join(data["expectedKeywords"])
        question.example_answer = data["exampleAnswer"]
        question.feedback = data["feedback"]
        question.confidence_threshold = data["confidenceThreshold"]

    @staticmethod
    def create_question(data):
        """Add a new quiz question."""
        is_valid, error = BaselineSchema.validate_question(data)
        if not is_valid:
            return False, error, None

        question = BaselineQuestion()
        BaselineService._apply_question_fields(question, data)
        db.session.add(question)
        db.session.commit()
        return True, "Question created successfully.", BaselineService._serialize_question(
            question, include_answers=True,
        )

    @staticmethod
    def update_question(question_id, data):
        """Edit a quiz question."""
        question = db.session.get(BaselineQuestion, question_id)
        if not question:
            return False, "Question not found.", None

        is_valid, error = BaselineSchema.validate_question(data)
        if not is_valid:
            return False, error, None

        BaselineService._apply_question_fields(question, data)
        db.session.commit()
        return True, "Question updated successfully.", BaselineService._serialize_question(
            question, include_answers=True,
        )

    @staticmethod
    def delete_question(question_id):
        """Delete a quiz question."""
        is_valid, error = BaselineSchema.validate_delete_question(question_id)
        if not is_valid:
            return False, error, None

        db.session.delete(db.session.get(BaselineQuestion, question_id))
        db.session.commit()
        return True, "Question deleted successfully.", None
