from flask import Blueprint, jsonify, request

from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from app.services.scenario_service import ScenarioService


scenario_bp = Blueprint(
    "scenario",
    __name__,
    url_prefix="/api/scenarios"
)


def _require_admin():
    if get_jwt().get("role") != "ADMIN":
        return jsonify({
            "success": False,
            "message": "Administrator access is required.",
        }), 403

    return None


@scenario_bp.route("", methods=["GET"])
@jwt_required()
def get_scenarios():

    success, message, result = ScenarioService.get_scenarios(
        request.args.get("page", 1, type=int),
        request.args.get("per_page", 25, type=int),
    )

    status = 200 if success else 400

    return jsonify({

        "success": success,

        "message": message,

        "data": result

    }), status


@scenario_bp.route("", methods=["POST"])
@jwt_required()
def create_scenario():

    admin_error = _require_admin()
    if admin_error:
        return admin_error

    data = request.get_json()

    success, message, result = ScenarioService.create_scenario(data)

    status = 201 if success else 400

    return jsonify({

        "success": success,

        "message": message,

        "data": result

    }), status


@scenario_bp.route("/random/<simulation_type>", methods=["GET"])
@jwt_required()
def get_random_scenario(simulation_type):

    include_completed = request.args.get("include_completed", "false").lower() == "true"

    success, message, result = ScenarioService.get_random_scenario(
        simulation_type.upper(),
        int(get_jwt_identity()),
        include_completed,
    )

    status = 200 if success else 404

    return jsonify({

        "success": success,

        "message": message,

        "data": result

    }), status

@scenario_bp.route("/evaluate", methods=["POST"])
@jwt_required()
def evaluate_answer():

    data = request.get_json()

    success, message, result = ScenarioService.evaluate_answer(

        data

    )

    status = 200 if success else 400

    return jsonify({

        "success": success,

        "message": message,

        "data": result

    }), status

@scenario_bp.route("/<int:scenario_id>", methods=["GET"])
@jwt_required()
def get_scenario(scenario_id):

    success, message, result = ScenarioService.get_scenario(
        scenario_id
    )

    status = 200 if success else 404

    return jsonify({

        "success": success,

        "message": message,

        "data": result

    }), status


@scenario_bp.route("/<int:scenario_id>", methods=["PUT"])
@jwt_required()
def update_scenario(scenario_id):
    admin_error = _require_admin()
    if admin_error:
        return admin_error

    success, message, result = ScenarioService.update_scenario(
        scenario_id,
        request.get_json() or {},
    )
    return jsonify({
        "success": success,
        "message": message,
        "data": result,
    }), 200 if success else 400


@scenario_bp.route("/<int:scenario_id>", methods=["DELETE"])
@jwt_required()
def delete_scenario(scenario_id):
    admin_error = _require_admin()
    if admin_error:
        return admin_error

    success, message, result = ScenarioService.delete_scenario(scenario_id)
    return jsonify({
        "success": success,
        "message": message,
        "data": result,
    }), 200 if success else 400
