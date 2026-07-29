from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    jwt_required,
    get_jwt_identity
)

from app.services.baseline_service import BaselineService

baseline_bp = Blueprint(
    "baseline",
    __name__,
    url_prefix="/api/baseline"
)

# Player API

@baseline_bp.route("/latest-result", methods=["GET"])
@jwt_required()
def get_latest_result():

    current_user_id = get_jwt_identity()

    success, message, result = BaselineService.get_latest_result(
        current_user_id
    )

    if success:
        return jsonify({
            "success": True,
            "message": message,
            "data": result
        }), 200

    return jsonify({
        "success": False,
        "message": message,
        "data": None
    }), 400


@baseline_bp.route("/start", methods=["POST"])
@jwt_required()
def start_assessment():

    data = request.get_json() or {}

    current_user_id = get_jwt_identity()

    success, message, result = BaselineService.start_assessment(
        data,
        current_user_id
    )

    status_code = 200 if success else 400

    return jsonify({
        "success": success,
        "message": message,
        "data": result
    }), status_code

@baseline_bp.route("/questions", methods=["GET"])
@jwt_required()
def get_questions():

    success, message, questions = BaselineService.get_questions()

    return jsonify({
        "success": success,
        "message": message,
        "data": questions
    }), 200


@baseline_bp.route("/submit-response", methods=["POST"])
@jwt_required()
def submit_response():

    data = request.get_json()

    success, message, result = BaselineService.submit_response(data)

    if success:
        return jsonify({
            "success": True,
            "message": message,
            "data": result
        }), 201

    return jsonify({
        "success": False,
        "message": message
    }), 400


@baseline_bp.route("/complete", methods=["POST"])
@jwt_required()
def complete_assessment():

    data = request.get_json()

    success, message, result = BaselineService.complete_assessment(data)

    if success:
        return jsonify({
            "success": True,
            "message": message,
            "data": result
        }), 200

    return jsonify({
        "success": False,
        "message": message
    }), 400


# Admin API
@baseline_bp.route("/questions", methods=["POST"])
@jwt_required()
def create_question():

    data = request.get_json()

    success, message, result = BaselineService.create_question(data)

    if success:
        return jsonify({
            "success": True,
            "message": message,
            "data": result
        }), 201

    return jsonify({
        "success": False,
        "message": message
    }), 400


@baseline_bp.route("/questions/<int:question_id>", methods=["GET"])
@jwt_required()
def get_question(question_id):

    success, message, result = BaselineService.get_question(
        question_id
    )

    if success:
        return jsonify({
            "success": True,
            "message": message,
            "data": result
        }), 200

    return jsonify({
        "success": False,
        "message": message
    }), 404


@baseline_bp.route("/questions/<int:question_id>", methods=["PUT"])
@jwt_required()
def update_question(question_id):

    data = request.get_json()

    success, message, result = BaselineService.update_question(
        question_id,
        data
    )

    if success:
        return jsonify({
            "success": True,
            "message": message,
            "data": result
        }), 200

    return jsonify({
        "success": False,
        "message": message
    }), 400

@baseline_bp.route("/questions/<int:question_id>", methods=["DELETE"])
@jwt_required()
def delete_question(question_id):

    success, message, result = BaselineService.delete_question(
        question_id
    )

    if success:
        return jsonify({
            "success": True,
            "message": message
        }), 200

    return jsonify({
        "success": False,
        "message": message
    }), 400