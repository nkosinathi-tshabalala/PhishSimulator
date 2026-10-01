# These are the endpoints for submitting answers

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.services.simulation_service import SimulationService


simulation_bp = Blueprint("simulation", __name__, url_prefix="/api/simulation")


# POST /api/simulation/attempt - takes the decision, clues, reason and any click, then scores it
@simulation_bp.route("/attempt", methods=["POST"])
@jwt_required()
def save_attempt():
    """Submit a decision (Report / Safe) with its justification."""
    success, message, result = SimulationService.save_attempt(
        int(get_jwt_identity()),
        request.get_json(silent=True),
    )
    return jsonify({
        "success": success,
        "message": message,
        "data": result,
    }), 201 if success else 400
