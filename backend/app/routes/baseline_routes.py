# These are the endpoints for the baseline quiz

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.routes.route_helpers import require_admin, respond
from app.services.baseline_service import BaselineService


baseline_bp = Blueprint("baseline", __name__, url_prefix="/api/baseline")


# GET /api/baseline/latest-result - the player's last completed quiz
@baseline_bp.route("/latest-result", methods=["GET"])
@jwt_required()
def get_latest_result():
    """The player's most recent completed quiz."""
    success, message, result = BaselineService.get_latest_result(get_jwt_identity())
    return respond(success, message, result)


# POST /api/baseline/start - starts a quiz and returns the questions (no answers)
@baseline_bp.route("/start", methods=["POST"])
@jwt_required()
def start_assessment():
    """Start a new quiz attempt."""
    success, message, result = BaselineService.start_assessment(get_jwt_identity())
    return respond(success, message, result)


# POST /api/baseline/submit-response - takes assessment_id, question_id and answer_text
@baseline_bp.route("/submit-response", methods=["POST"])
@jwt_required()
def submit_response():
    """Save and mark one quiz answer."""
    success, message, result = BaselineService.submit_response(
        request.get_json(silent=True) or {},
        get_jwt_identity(),
    )
    return respond(success, message, result, ok_status=201)


# POST /api/baseline/complete - takes assessment_id, marks the quiz and sets the starting difficulty
@baseline_bp.route("/complete", methods=["POST"])
@jwt_required()
def complete_assessment():
    """Finish the quiz and set the starting difficulty."""
    success, message, result = BaselineService.complete_assessment(
        request.get_json(silent=True) or {},
        get_jwt_identity(),
    )
    return respond(success, message, result)


# GET /api/baseline/questions - admin only: every question with its marking guide
@baseline_bp.route("/questions", methods=["GET"])
@jwt_required()
@require_admin
def get_questions():
    """Admin: list the quiz questions."""
    success, message, result = BaselineService.get_questions()
    return respond(success, message, result)


# POST /api/baseline/questions - admin only: question, instruction, keywords, example answer, feedback
@baseline_bp.route("/questions", methods=["POST"])
@jwt_required()
@require_admin
def create_question():
    """Admin: add a quiz question."""
    success, message, result = BaselineService.create_question(request.get_json(silent=True) or {})
    return respond(success, message, result, ok_status=201)


# GET /api/baseline/questions/<id> - admin only: one question
@baseline_bp.route("/questions/<int:question_id>", methods=["GET"])
@jwt_required()
@require_admin
def get_question(question_id):
    """Admin: get one quiz question."""
    success, message, result = BaselineService.get_question(question_id)
    return respond(success, message, result, error_status=404)


# PUT /api/baseline/questions/<id> - admin only: edits a question
@baseline_bp.route("/questions/<int:question_id>", methods=["PUT"])
@jwt_required()
@require_admin
def update_question(question_id):
    """Admin: edit a quiz question."""
    success, message, result = BaselineService.update_question(
        question_id,
        request.get_json(silent=True) or {},
    )
    return respond(success, message, result)


# DELETE /api/baseline/questions/<id> - admin only: deletes a question
@baseline_bp.route("/questions/<int:question_id>", methods=["DELETE"])
@jwt_required()
@require_admin
def delete_question(question_id):
    """Admin: delete a quiz question."""
    success, message, result = BaselineService.delete_question(question_id)
    return respond(success, message, result)
