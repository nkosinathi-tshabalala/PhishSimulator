from flask import Blueprint, jsonify, request

from flask_jwt_extended import jwt_required, get_jwt_identity

from app.services.simulation_service import SimulationService


simulation_bp = Blueprint(

    "simulation",

    __name__,

    url_prefix="/api/simulation"

)


@simulation_bp.route("/attempt", methods=["POST"])
@jwt_required()
def save_attempt():

    user_id = int(get_jwt_identity())

    data = request.get_json()

    success, message, result = SimulationService.save_attempt(

        user_id,

        data

    )

    return jsonify({

        "success": success,

        "message": message,

        "data": result

    }), 201 if success else 400