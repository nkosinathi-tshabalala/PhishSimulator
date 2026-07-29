from app.extensions import db
from app.models.authentication import Player
from app.models.baseline import (
    BaselineAssessment,
    BaselineQuestion,
    BaselineResponse
)
from app.schemas.baseline_schema import BaselineSchema
from datetime import datetime

class BaselineService:

    """Handles baseline assessment business logic."""
    #Player
    # Player
    @staticmethod
    def start_assessment(data, current_user_id):
        """Creates a new baseline assessment and returns the assessment questions."""

        try:

            player = Player.query.filter_by(
                user_id=current_user_id
            ).first()

            if not player:
                return False, "Player profile not found.", None

            # Create assessment
            assessment = BaselineAssessment(
                player_id=player.player_id
            )

            db.session.add(assessment)
            db.session.commit()

            # Retrieve all baseline questions
            questions = BaselineQuestion.query.order_by(
                BaselineQuestion.question_id.asc()
            ).all()

            # Convert questions into JSON format
            serialized_questions = [

                BaselineService._serialize_question(question)

                for question in questions

            ]

            return True, "Baseline assessment started successfully.", {

                "assessment_id": assessment.assessment_id,

                "questions": serialized_questions

            }

        except Exception:

            db.session.rollback()

            raise


    @staticmethod
    def _serialize_question(question):
        """Converts a BaselineQuestion model into a frontend-friendly dictionary."""

        return {
            "id": question.question_id,
            "question": question.question_text,
            "instruction": question.instruction,
            "expectedKeywords": question.get_expected_keywords(),
            "exampleAnswer": question.example_answer,
            "feedback": question.feedback,
            "confidenceThreshold": question.confidence_threshold
        }

    @staticmethod
    def get_questions():
        """Returns all baseline assessment questions."""

        questions = BaselineQuestion.query.order_by(
            BaselineQuestion.question_id.asc()
        ).all()

        serialized_questions = [

            BaselineService._serialize_question(question)

            for question in questions
        ]

        return (
            True,
            "Baseline questions retrieved successfully.",
            serialized_questions
        )
    
    @staticmethod
    def submit_response(data):
        """Saves a player's response to a baseline question."""

        # Validate request
        is_valid, error = BaselineSchema.validate_submit_response(data)

        if not is_valid:
            return False, error, None

        # Retrieve question
        question = BaselineQuestion.query.get(
            data["question_id"]
        )

        if not question:
            return False, "Question not found.", None

        try:

            # Convert answer to lowercase
            answer = data["answer_text"].lower()

            # Get expected keywords
            expected_keywords = question.get_expected_keywords()

            matched_keywords = []

            for keyword in expected_keywords:

                if keyword.lower() in answer:

                    matched_keywords.append(keyword)

            score = len(matched_keywords)

            passed = (
                score >= question.confidence_threshold
            )

            # Create response
            response = BaselineResponse(
                assessment_id=data["assessment_id"],
                question_id=data["question_id"],
                answer_text=data["answer_text"],
                matched_keywords=",".join(matched_keywords),
                score=score,
                passed=passed
            )

            db.session.add(response)

            db.session.commit()

            return True, "Response submitted successfully.", {
                "questionId": question.question_id,
                "userAnswer": response.answer_text,
                "matchedKeywords": matched_keywords,
                "score": score,
                "maxScore": len(
                    question.get_expected_keywords()
                ),
                "passed": passed
            }

        except Exception:
            db.session.rollback()
            raise

    
    @staticmethod
    def complete_assessment(data):
        """Completes a baseline assessment and calculates the final results."""

        # Validate request
        is_valid, error = BaselineSchema.validate_complete_assessment(data)

        if not is_valid:
            return False, error, None

        assessment = BaselineAssessment.query.get(
            data["assessment_id"]
        )

        if not assessment:
            return False, "Assessment not found.", None

        responses = BaselineResponse.query.filter_by(
            assessment_id=assessment.assessment_id
        ).all()

        if not responses:
            return False, "No responses found.", None

        try:

            total_score = 0
            total_max_score = 0
            questions_passed = 0

            results = []

            for response in responses:

                question = response.question

                max_score = len(
                    question.get_expected_keywords()
                )

                total_score += response.score
                total_max_score += max_score

                if response.passed:
                    questions_passed += 1

                results.append({

                    "questionId": question.question_id,

                    "userAnswer": response.answer_text,

                    "matchedKeywords": response.get_matched_keywords(),

                    "score": response.score,

                    "maxScore": max_score,

                    "passed": response.passed

                })

            overall_percent = 0

            if total_max_score > 0:
                overall_percent = round(
                    (total_score / total_max_score) * 100
                )

            if overall_percent >= 70:
                confidence_level = "Intermediate"
                starting_difficulty = "Medium"

            elif overall_percent >= 40:
                confidence_level = "Beginner"
                starting_difficulty = "Easy"

            else:
                confidence_level = "Novice"
                starting_difficulty = "Easy"

            assessment.completed_at = datetime.utcnow()

            assessment.score = overall_percent

            db.session.commit()

            return True, "Assessment completed successfully.", {

                "assessmentId": assessment.assessment_id,

                "overallScore": overall_percent,

                "questionsPassed": questions_passed,

                "totalKeywordsMatched": total_score,

                "confidenceLevel": confidence_level,

                "startingDifficulty": starting_difficulty,

                "results": results

            }

        except Exception:
            db.session.rollback()
            raise


    @staticmethod
    def get_latest_result(current_user_id):
        """
        Returns the authenticated player's latest completed
        baseline assessment.
        """

        try:
            # Find the Player linked to the authenticated User
            player = Player.query.filter_by(
                user_id=current_user_id
            ).first()

            if not player:
                return False, "Player profile not found.", None

            # Find the latest COMPLETED assessment only
            assessment = BaselineAssessment.query.filter(
                BaselineAssessment.player_id == player.player_id,
                BaselineAssessment.completed_at.isnot(None)
            ).order_by(
                BaselineAssessment.completed_at.desc()
            ).first()

            # Player has never completed a baseline assessment
            if not assessment:
                return True, "No completed baseline assessment found.", None

            # Retrieve responses belonging to this assessment
            responses = BaselineResponse.query.filter_by(
                assessment_id=assessment.assessment_id
            ).all()

            total_score = 0
            questions_passed = 0
            results = []

            for response in responses:
                question = response.question

                max_score = len(
                    question.get_expected_keywords()
                )

                total_score += response.score

                if response.passed:
                    questions_passed += 1

                results.append({
                    "questionId": question.question_id,
                    "userAnswer": response.answer_text,
                    "matchedKeywords": response.get_matched_keywords(),
                    "score": response.score,
                    "maxScore": max_score,
                    "passed": response.passed
                })

            # Use the final score already stored on the assessment
            overall_percent = round(assessment.score)

            # Reconstruct confidence/difficulty from stored score
            if overall_percent >= 70:
                confidence_level = "Intermediate"
                starting_difficulty = "Medium"

            elif overall_percent >= 40:
                confidence_level = "Beginner"
                starting_difficulty = "Easy"

            else:
                confidence_level = "Novice"
                starting_difficulty = "Easy"

            return True, "Latest baseline result retrieved successfully.", {
                "assessmentId": assessment.assessment_id,
                "overallScore": overall_percent,
                "questionsPassed": questions_passed,
                "totalKeywordsMatched": total_score,
                "confidenceLevel": confidence_level,
                "startingDifficulty": starting_difficulty,
                "completedAt": (
                    assessment.completed_at.isoformat()
                    if assessment.completed_at
                    else None
                ),
                "results": results
            }

        except Exception:
            raise    
    

    #Administrator
    @staticmethod
    def create_question(data):
        """Creates a new baseline assessment question."""

        is_valid, error = BaselineSchema.validate_question(data)

        if not is_valid:
            return False, error, None

        try:

            question = BaselineQuestion(
                question_text=data["question"],
                instruction=data["instruction"],
                expected_keywords=",".join(data["expectedKeywords"]),
                example_answer=data["exampleAnswer"],
                feedback=data["feedback"],
                confidence_threshold=data["confidenceThreshold"]
            )

            db.session.add(question)
            db.session.commit()

            return True, "Question created successfully.", \
                BaselineService._serialize_question(question)

        except Exception:
            db.session.rollback()
            raise
    
    @staticmethod
    def get_question(question_id):
        """Returns a single baseline question."""

        is_valid, error = BaselineSchema.validate_question_exists(
            question_id
        )

        if not is_valid:
            return False, error, None

        question = BaselineQuestion.query.get(question_id)

        return (
            True,
            "Question retrieved successfully.",
            BaselineService._serialize_question(question)
        )
    

    @staticmethod
    def update_question(question_id, data):
        """Updates an existing baseline question."""

        is_valid, error = BaselineSchema.validate_question_exists(
            question_id
        )

        if not is_valid:
            return False, error, None

        is_valid, error = BaselineSchema.validate_question(data)

        if not is_valid:
            return False, error, None

        question = BaselineQuestion.query.get(question_id)

        try:

            question.question_text = data["question"]
            question.instruction = data["instruction"]
            question.expected_keywords = ",".join(
                data["expectedKeywords"]
            )
            question.example_answer = data["exampleAnswer"]
            question.feedback = data["feedback"]
            question.confidence_threshold = data[
                "confidenceThreshold"
            ]

            db.session.commit()

            return (
                True,
                "Question updated successfully.",
                BaselineService._serialize_question(question)
            )

        except Exception:
            db.session.rollback()
            raise
    
    @staticmethod
    def delete_question(question_id):
        """Deletes a baseline assessment question."""

        is_valid, error = BaselineSchema.validate_delete_question(
            question_id
        )

        if not is_valid:
            return False, error, None

        question = BaselineQuestion.query.get(question_id)

        try:

            db.session.delete(question)

            db.session.commit()

            return True, "Question deleted successfully.", None

        except Exception:
            db.session.rollback()
            raise