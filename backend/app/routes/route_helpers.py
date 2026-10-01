# Small helpers shared by the route files

from functools import wraps

from flask import jsonify
from flask_jwt_extended import get_jwt


def require_admin(view):
    """Allow the route only for administrators. Place it below @jwt_required()."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        """Reject the request unless the user is an admin."""
        if get_jwt().get("role") != "ADMIN":
            return jsonify({
                "success": False,
                "message": "Administrator access is required.",
                "data": None,
            }), 403
        return view(*args, **kwargs)

    return wrapper


def respond(success, message, result, ok_status=200, error_status=400):
    """Standard JSON response: {"success", "message", "data"} with a status code."""
    return jsonify({
        "success": success,
        "message": message,
        "data": result,
    }), ok_status if success else error_status
