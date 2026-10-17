# These are the endpoints for the baseline quiz

from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from app.routes.route_helpers import current_user_id, require_admin, respond
from app.services.baseline_service import BaselineService


baseline_bp = Blueprint("baseline", __name__, url_prefix="/api/baseline")


# GET /api/baseline/latest-result - the player's last completed quiz
@baseline_bp.route("/latest-result", methods=["GET"])
@jwt_required()
def get_latest_result():
    """The player's most recent completed quiz."""
    success, message, result = BaselineService.get_latest_result(current_user_id())
    return respond(success, message, result)


# GET /api/baseline/available - the player's baseline assessments: new ones and ones already taken
@baseline_bp.route("/available", methods=["GET"])
@jwt_required()
def get_available():
    """The baseline assessments offered to the player's role."""
    success, message, result = BaselineService.get_available(current_user_id())
    return respond(success, message, result)


# GET /api/baseline/assessments/<id> - one of the player's own completed results
@baseline_bp.route("/assessments/<int:assessment_id>", methods=["GET"])
@jwt_required()
def get_result(assessment_id):
    """A completed baseline assessment with its marked answers."""
    success, message, result = BaselineService.get_result(assessment_id, current_user_id())
    return respond(success, message, result, error_status=404)


# POST /api/baseline/start - takes an optional template_id; returns the questions (no answers)
@baseline_bp.route("/start", methods=["POST"])
@jwt_required()
def start_assessment():
    """Start a baseline assessment the player has not taken yet."""
    success, message, result = BaselineService.start_assessment(
        current_user_id(), request.get_json(silent=True) or {},
    )
    return respond(success, message, result)


# POST /api/baseline/submit-response - takes assessment_id, question_id and answer_text
@baseline_bp.route("/submit-response", methods=["POST"])
@jwt_required()
def submit_response():
    """Save and mark one quiz answer."""
    success, message, result = BaselineService.submit_response(
        request.get_json(silent=True) or {},
        current_user_id(),
    )
    return respond(success, message, result, ok_status=201)


# POST /api/baseline/complete - takes assessment_id, marks the quiz and sets the starting difficulty
@baseline_bp.route("/complete", methods=["POST"])
@jwt_required()
def complete_assessment():
    """Finish the quiz and set the starting difficulty."""
    success, message, result = BaselineService.complete_assessment(
        request.get_json(silent=True) or {},
        current_user_id(),
    )
    return respond(success, message, result)


# GET /api/baseline/templates - admin only: every baseline assessment with its questions
@baseline_bp.route("/templates", methods=["GET"])
@jwt_required()
@require_admin
def get_templates():
    """Admin: the baseline assessments by role."""
    success, message, result = BaselineService.get_templates()
    return respond(success, message, result)


# POST /api/baseline/templates - admin only: takes name (optional), occupation, description
@baseline_bp.route("/templates", methods=["POST"])
@jwt_required()
@require_admin
def create_template():
    """Admin: add an empty baseline assessment for a role."""
    success, message, result = BaselineService.create_template(request.get_json(silent=True) or {})
    return respond(success, message, result, ok_status=201)


# PUT /api/baseline/templates/<id> - admin only: rename or describe an assessment
@baseline_bp.route("/templates/<int:template_id>", methods=["PUT"])
@jwt_required()
@require_admin
def update_template(template_id):
    """Admin: edit a baseline assessment's name, role or description."""
    success, message, result = BaselineService.update_template(template_id, request.get_json(silent=True) or {})
    return respond(success, message, result)


# DELETE /api/baseline/templates/<id> - admin only: only while no player has taken it
@baseline_bp.route("/templates/<int:template_id>", methods=["DELETE"])
@jwt_required()
@require_admin
def delete_template(template_id):
    """Admin: delete a baseline assessment nobody has taken."""
    success, message, result = BaselineService.delete_template(template_id)
    return respond(success, message, result)


# POST /api/baseline/templates/<id>/active - admin only: takes {"active": true|false}
@baseline_bp.route("/templates/<int:template_id>/active", methods=["POST"])
@jwt_required()
@require_admin
def set_template_active(template_id):
    """Admin: switch a baseline assessment on or off for its role."""
    success, message, result = BaselineService.set_template_active(template_id, request.get_json(silent=True) or {})
    return respond(success, message, result)


# POST /api/baseline/templates/load-bank - admin only: adds missing assessments and questions from the bank
@baseline_bp.route("/templates/load-bank", methods=["POST"])
@jwt_required()
@require_admin
def load_template_bank():
    """Admin: add the template-bank assessments and questions that are not here yet."""
    success, message, result = BaselineService.load_templates()
    return respond(success, message, result)


# POST /api/baseline/questions - admin only: templateId, question, instruction, keywords, example answer, feedback
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
