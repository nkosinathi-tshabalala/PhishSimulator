# These are the endpoints for authentication.
# Tokens never appear in a response body: they are set as HttpOnly cookies that page scripts cannot read.

from flask import Blueprint, g, request
from flask_jwt_extended import (
    get_jwt, jwt_required, set_access_cookies, set_refresh_cookies, unset_jwt_cookies,
)

from app.routes.route_helpers import respond
from app.security import rate_limit
from app.services.auth_service import AuthService
from app.services.session_service import SessionService


auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


def _body():
    """The JSON body of the request, or an empty dict when there is none."""
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


def _with_cookies(response, access, refresh):
    set_access_cookies(response, access)
    set_refresh_cookies(response, refresh)
    return response


# POST /api/auth/register - creates a player from name, email, password, age, IT background and occupation
@auth_bp.route("/register", methods=["POST"])
@rate_limit(10, 60 * 60)
def register():
    """Register a new player."""
    success, message = AuthService.register(_body())
    return respond(success, message, None, ok_status=201)


# POST /api/auth/login - checks email and password, then starts a session (cookies, no token in the body)
@auth_bp.route("/login", methods=["POST"])
@rate_limit(10, 60)
def login():
    """Sign a user in."""
    success, message, result = AuthService.login(_body())
    if not success:
        return respond(False, message, None, error_status=401)
    access, refresh, timing = result
    response, status = respond(True, message, {"session": timing})
    return _with_cookies(response, access, refresh), status


# POST /api/auth/refresh - swaps the refresh cookie for new cookies (the old refresh token stops working)
@auth_bp.route("/refresh", methods=["POST"])
@rate_limit(60, 60)
@jwt_required(refresh=True)
def refresh():
    """Keep an active user signed in. A refresh token used twice ends the session (it was copied)."""
    tokens = SessionService.refresh(get_jwt())
    if not tokens:
        response, status = respond(False, "Please sign in to continue.", None, error_status=401)
        unset_jwt_cookies(response)
        return response, status
    response, status = respond(True, "Session renewed.", {"session": SessionService.timing(g.auth_session)})
    return _with_cookies(response, *tokens), status


# GET /api/auth/me - returns the signed-in user's details
@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def get_current_user():
    """The signed-in user's details, and when the session ends if idle."""
    success, message, user = AuthService.get_current_user()
    if success:
        user = {**user, "session": SessionService.timing(g.auth_session)}
    return respond(success, message, user, error_status=404)


# PUT /api/auth/update-profile - saves a player's name, age, occupation and IT background
@auth_bp.route("/update-profile", methods=["PUT"])
@jwt_required()
def update_profile():
    """Update the signed-in player's profile."""
    success, message, user = AuthService.update_profile(_body())
    return respond(success, message, user)


# PUT /api/auth/change-password - takes the current password and the new one; signs out other devices
@auth_bp.route("/change-password", methods=["PUT"])
@rate_limit(10, 15 * 60)
@jwt_required()
def change_password():
    """Change the signed-in user's password."""
    success, message = AuthService.change_password(_body())
    return respond(success, message, None)


# POST /api/auth/logout - ends this session on the server and clears the cookies
@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    """Sign the user out."""
    success, message = AuthService.logout()
    response, status = respond(success, message, None)
    unset_jwt_cookies(response)
    return response, status


# POST /api/auth/forgot-password - takes an email and sends a reset link if the account exists
@auth_bp.route("/forgot-password", methods=["POST"])
@rate_limit(5, 15 * 60)
def forgot_password():
    """Start a password reset without revealing whether the email exists."""
    email = str(_body().get("email", ""))
    if not email:
        return respond(False, "Email is required.", None)
    success, message = AuthService.request_password_reset(email[:254])
    return respond(success, message, None)


# POST /api/auth/reset-password - takes the emailed token and the new password; signs out every device
@auth_bp.route("/reset-password", methods=["POST"])
@rate_limit(10, 15 * 60)
def reset_password():
    """Set a new password from a reset link."""
    success, message = AuthService.reset_password(_body())
    return respond(success, message, None)
