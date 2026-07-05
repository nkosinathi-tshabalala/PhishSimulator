from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from app.services.auth_service import AuthService

print("Loading auth_routes.py...")

# Authentication Blueprint
auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)


@auth_bp.route("/register", methods=["POST"])
def register():

    print("Register endpoint reached")

    
    """Registers a new player."""

    data = request.get_json()

    try:
        success, message = AuthService.register(data)

        if not success:
            return jsonify({
                "success": False,
                "message": message
            }), 400

        return jsonify({
            "success": True,
            "message": message
        }), 201

    except Exception as error:
        return jsonify({
            "success": False,
            "message": "Registration failed.",
            "error": str(error)
        }), 500
    

@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticates a user."""

    data = request.get_json()

    try:

        success, message, response = AuthService.login(data)

        if not success:
            return jsonify({
                "success": False,
                "message": message
            }), 401

        return jsonify({
            "success": True,
            "message": message,
            "data": response
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "message": "Login failed.",
            "error": str(error)
        }), 500
    

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    """Returns the currently logged-in user."""

    try:

        success, message, user = AuthService.get_current_user()

        if not success:
            return jsonify({
                "success": False,
                "message": message
            }), 404

        return jsonify({
            "success": True,
            "message": message,
            "data": user
        }), 200

    except Exception as error:
        return jsonify({
            "success": False,
            "message": "Unable to retrieve user.",
            "error": str(error)
        }), 500