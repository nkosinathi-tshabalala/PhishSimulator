# Security for every API request: response headers, safe error replies and signed-out tokens

from flask import jsonify, request
from werkzeug.exceptions import HTTPException

from app.enums.session_status import SessionStatus
from app.extensions import db, jwt
from app.models.authentication import UserSession

# Added to every response: no MIME sniffing, no framing, no referrer leaks, no caching of private data
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}

# Plain messages for the HTTP errors a user can run into
ERROR_MESSAGES = {
    404: "That address does not exist.",
    405: "That action is not allowed here.",
    413: "That file is too large to upload.",
}


def register_security(app):
    """Connect the security headers, error replies and sign-out check to the app."""

    @app.after_request
    def add_security_headers(response):
        """Harden every response the API sends."""
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        return response

    @app.errorhandler(HTTPException)
    def http_error(error):
        """Known HTTP errors as the standard JSON reply."""
        message = ERROR_MESSAGES.get(error.code, error.name)
        return jsonify({"success": False, "message": message, "data": None}), error.code

    @app.errorhandler(Exception)
    def unexpected_error(error):
        """Log the details on the server; the client only learns that something failed."""
        db.session.rollback()
        app.logger.exception("Unhandled error on %s %s", request.method, request.path)
        return jsonify({"success": False, "message": "Something went wrong. Please try again.", "data": None}), 500

    @jwt.token_in_blocklist_loader
    def is_signed_out(_header, claims):
        """A token works only while its login session is active, so logging out ends it at once."""
        session = db.session.get(UserSession, claims.get("session_id") or 0)
        return session is None or session.status != SessionStatus.ACTIVE
