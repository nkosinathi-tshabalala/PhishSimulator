# These are the endpoints for authentication

from datetime import datetime, timedelta, timezone

from flask import Blueprint, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required, verify_jwt_in_request

from app.routes.route_helpers import respond
from app.services.auth_service import AuthService, issue_token

# Active users get a new token once theirs has less than this time left
RENEW_WHEN_LESS_THAN = timedelta(minutes=10)


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _body():
    """The JSON body of the request, or an empty dict when there is none."""
    return request.get_json(silent=True) or {}


# POST /api/auth/register - creates a player from name, email, password, age, IT background and occupation
@auth_bp.route("/register", methods=["POST"])
def register():
    """Register a new player."""
    success, message = AuthService.register(_body())
    return respond(success, message, None, ok_status=201)


# POST /api/auth/login - checks email and password, then returns a login token
@auth_bp.route("/login", methods=["POST"])
def login():
    """Sign a user in."""
    success, message, result = AuthService.login(_body())
    return respond(success, message, result, error_status=401)


# GET /api/auth/me - returns the signed-in user's details
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    """The signed-in user's details."""
    success, message, user = AuthService.get_current_user()
    return respond(success, message, user, error_status=404)


# PUT /api/auth/update-profile - saves a player's name, age, occupation and IT background
@auth_bp.route("/update-profile", methods=["PUT"])
@jwt_required()
def update_profile():
    """Update the signed-in player's profile."""
    success, message, user = AuthService.update_profile(_body())
    return respond(success, message, user)


# PUT /api/auth/change-password - takes the current password and the new one
@auth_bp.route("/change-password", methods=["PUT"])
@jwt_required()
def change_password():
    """Change the signed-in user's password."""
    success, message = AuthService.change_password(_body())
    return respond(success, message, None)


# POST /api/auth/logout - ends this login session so its token stops working
@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """Sign the user out."""
    success, message = AuthService.logout()
    return respond(success, message, None)


# POST /api/auth/forgot-password - takes an email and sends a reset link if the account exists
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    """Start a password reset without revealing whether the email exists."""
    email = _body().get("email", "")
    if not email:
        return respond(False, "Email is required.", None)
    success, message = AuthService.request_password_reset(email)
    return respond(success, message, None)


# POST /api/auth/reset-password - takes the emailed token and the new password
@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    """Set a new password from a reset link."""
    success, message = AuthService.reset_password(_body())
    return respond(success, message, None)


# Runs after every request: gives active users a fresh token so they stay signed in
@auth_bp.after_app_request
def renew_active_session(response):
    """Send a fresh token in a response header when the current one is close to expiring."""
    if request.method == "OPTIONS" or request.path.endswith("/logout"):
        return response

    try:
        verify_jwt_in_request(optional=True)
        claims = get_jwt()
    except Exception:
        return response

    if not claims:
        return response

    expires_at = datetime.fromtimestamp(claims["exp"], timezone.utc)
    if expires_at - datetime.now(timezone.utc) < RENEW_WHEN_LESS_THAN:
        response.headers["X-New-Token"] = issue_token(get_jwt_identity(), claims.get("role"), claims.get("session_id"))
    return response
