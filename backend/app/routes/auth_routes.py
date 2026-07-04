from flask import Blueprint, jsonify, request

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