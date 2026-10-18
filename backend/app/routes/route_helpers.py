# Small helpers shared by the route files

from functools import wraps

from flask import jsonify
from flask_jwt_extended import current_user

from app.enums.role import Role


def current_user_id():
    """The signed-in user's id. It comes from the server-side session the token points to, never from the
    token itself (which carries no user id). Use inside @jwt_required() routes."""
    return current_user.user_id


def require_admin(view):
    """Allow the route only for administrators. Place it below @jwt_required(). The role is read from the
    database for every request, so a role change or a deleted account takes effect at once."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        """Reject the request unless the user is an admin."""
        if not current_user or current_user.role != Role.ADMIN.value:
            return jsonify({
                "success": False,
                "message": "You do not have access to this.",
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
