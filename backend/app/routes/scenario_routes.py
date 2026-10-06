# These are the endpoints for scenarios: playing them and reviewing them

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.routes.route_helpers import require_admin, respond
from app.services.scenario_service import ScenarioService


scenario_bp = Blueprint("scenario", __name__, url_prefix="/api/scenarios")


# GET /api/scenarios/random/<EMAIL|SMS> - the next scenario for the player (optional category)
@scenario_bp.route("/random/<simulation_type>", methods=["GET"])
@jwt_required()
def get_random_scenario(simulation_type):
    """Next adaptive scenario for the player (without the answer)."""
    include_completed = request.args.get("include_completed", "false").lower() == "true"
    success, message, result = ScenarioService.get_random_scenario(
        simulation_type,
        int(get_jwt_identity()),
        include_completed,
        request.args.get("category"),
    )
    return respond(success, message, result, error_status=404)


# GET /api/scenarios/review/<EMAIL|SMS> - a scenario the player got wrong before
@scenario_bp.route("/review/<simulation_type>", methods=["GET"])
@jwt_required()
def get_review_scenario(simulation_type):
    """A scenario the player got wrong before, for another try."""
    success, message, result = ScenarioService.get_review_scenario(
        simulation_type,
        int(get_jwt_identity()),
    )
    return respond(success, message, result, error_status=404)


# GET /api/scenarios/triage/<EMAIL|SMS> - a small inbox for Inbox Rush
@scenario_bp.route("/triage/<simulation_type>", methods=["GET"])
@jwt_required()
def get_triage_batch(simulation_type):
    """A mixed inbox of messages for the triage challenge (no answers)."""
    success, message, result = ScenarioService.get_triage_batch(
        simulation_type,
        int(get_jwt_identity()),
    )
    return respond(success, message, result, error_status=404)


# GET /api/scenarios - admin only: scenarios in pages, with filters and search
@scenario_bp.route("", methods=["GET"])
@jwt_required()
@require_admin
def get_scenarios():
    """Admin: list scenarios with filters and paging."""
    filters = {
        "simulation_type": request.args.get("simulation_type"),
        "status": request.args.get("status"),
        "dataset_id": request.args.get("dataset_id"),  # an id, or "none" for scenarios not from a dataset
        "difficulty": request.args.get("difficulty"),
        "category": request.args.get("category"),
        "answer": request.args.get("answer"),
        "search": request.args.get("search"),
        "min_quality": request.args.get("min_quality", type=int),
        "when": request.args.get("when"),
        "sort": request.args.get("sort"),
        "order": request.args.get("order"),
    }
    success, message, result = ScenarioService.get_scenarios(
        request.args.get("page", 1, type=int),
        request.args.get("per_page", 25, type=int),
        filters,
    )
    return respond(success, message, result)


# POST /api/scenarios - admin only: adds a scenario by hand
@scenario_bp.route("", methods=["POST"])
@jwt_required()
@require_admin
def create_scenario():
    """Admin: add a scenario by hand."""
    success, message, result = ScenarioService.create_scenario(request.get_json(silent=True) or {})
    return respond(success, message, result, ok_status=201)


# POST /api/scenarios/bulk-review - admin only: takes an action, filters, checklist and preview flag
@scenario_bp.route("/bulk-review", methods=["POST"])
@jwt_required()
@require_admin
def bulk_review():
    """Admin: review every scenario matching the filters (preview first)."""
    data = request.get_json(silent=True) or {}
    filters = data.get("filters") if isinstance(data.get("filters"), dict) else {}
    success, message, result = ScenarioService.bulk_review(
        data.get("action"),
        filters,
        data.get("checklist"),
        preview=data.get("preview") is True,
    )
    return respond(success, message, result)


# GET /api/scenarios/<id> - admin only: one scenario
@scenario_bp.route("/<int:scenario_id>", methods=["GET"])
@jwt_required()
@require_admin
def get_scenario(scenario_id):
    """Admin: get one scenario."""
    success, message, result = ScenarioService.get_scenario(scenario_id)
    return respond(success, message, result, error_status=404)


# PUT /api/scenarios/<id> - admin only: edits a scenario
@scenario_bp.route("/<int:scenario_id>", methods=["PUT"])
@jwt_required()
@require_admin
def update_scenario(scenario_id):
    """Admin: edit a scenario."""
    success, message, result = ScenarioService.update_scenario(
        scenario_id,
        request.get_json(silent=True) or {},
    )
    return respond(success, message, result)


# POST /api/scenarios/<id>/review - admin only: approve, reject, activate or archive
@scenario_bp.route("/<int:scenario_id>/review", methods=["POST"])
@jwt_required()
@require_admin
def review_scenario(scenario_id):
    """Move a scenario to its next review stage."""
    data = request.get_json(silent=True) or {}
    success, message, result = ScenarioService.review_scenario(
        scenario_id,
        data.get("action"),
        data.get("checklist"),
    )
    return respond(success, message, result)


# DELETE /api/scenarios/<id> - admin only: deletes a scenario nobody has attempted
@scenario_bp.route("/<int:scenario_id>", methods=["DELETE"])
@jwt_required()
@require_admin
def delete_scenario(scenario_id):
    """Admin: delete a scenario."""
    success, message, result = ScenarioService.delete_scenario(scenario_id)
    return respond(success, message, result)
