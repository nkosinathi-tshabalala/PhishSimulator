# Security for every API request: login checks against the session table, cross-site request checks,
# rate limits, response headers and safe error replies

import os
import threading
import time
from collections import defaultdict, deque
from functools import wraps
from urllib.parse import urlsplit

from flask import current_app, g, jsonify, request
from flask_jwt_extended import unset_jwt_cookies
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from app.extensions import db, jwt

# Added to every API response. The API only returns JSON, files and redirects, so its pages may load
# nothing and may not be framed; nothing private is cached; no referrer leaves the site.
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}
# Campaign emails load the open pixel and follow links from mail apps on other sites, so only the rest of
# the API is marked same-origin for other sites' pages
CROSS_SITE_PATHS = ("/api/campaigns/open/", "/api/campaigns/click/", "/api/campaigns/report/")

# Plain messages for the HTTP errors a user can run into
ERROR_MESSAGES = {
    400: "That request could not be understood.",
    403: "You do not have access to this.",
    404: "That address does not exist.",
    405: "That action is not allowed here.",
    413: "That file is too large to upload.",
    429: "Too many attempts. Please wait a minute and try again.",
}

SIGNED_OUT = "Please sign in to continue."
STATE_CHANGING = {"POST", "PUT", "PATCH", "DELETE"}
GETTING_READY = "PhishSimulator is still getting ready. Please try again in a few minutes."


def setting_up():
    """True while the container's first start is still loading the demo data (entrypoint.sh holds the file)."""
    marker = os.getenv("SETUP_MARKER_FILE")
    return bool(marker) and os.path.exists(marker)


def _reply(message, status):
    return jsonify({"success": False, "message": message, "data": None}), status


# ---------------------------------------------------------------- rate limits

class RateLimiter:
    """Counts requests per client address in a sliding window, in memory. Each Gunicorn worker keeps its own
    count, so with 3 workers the real limit is up to 3 times higher; the per-account lock after 5 wrong
    passwords (auth_service) still applies on top."""

    def __init__(self):
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key, limit, seconds):
        now = time.monotonic()
        with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - seconds:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            if len(self._hits) > 10_000:   # forget idle addresses so memory stays small
                for stale in [k for k, v in self._hits.items() if not v][:5_000]:
                    del self._hits[stale]
            return True


limiter = RateLimiter()


def rate_limit(limit, per_seconds):
    """Allow a route `limit` times per client address in `per_seconds`, then reply 429."""
    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            if current_app.config.get("RATE_LIMITS", True):
                key = (view.__name__, request.remote_addr or "unknown")
                if not limiter.allow(key, limit, per_seconds):
                    current_app.logger.warning("Rate limit hit on %s", request.path)
                    return _reply(ERROR_MESSAGES[429], 429)
            return view(*args, **kwargs)
        return wrapper
    return decorator


# ---------------------------------------------------------------- cross-site requests

def _origin(url):
    parts = urlsplit(url or "")
    return f"{parts.scheme}://{parts.netloc}".lower() if parts.scheme and parts.netloc else ""


def allowed_origins():
    """The page addresses allowed to change data: the frontend, and the address the API was reached on."""
    return {_origin(current_app.config["FRONTEND_URL"]), _origin(request.host_url)} - {""}


def register_security(app):
    """Connect the login checks, cross-site checks, headers and error replies to the app."""
    if app.config["TRUSTED_PROXY_COUNT"]:
        # Behind nginx: take the client address and https from the proxy's headers (only that many hops)
        count = app.config["TRUSTED_PROXY_COUNT"]
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=count, x_proto=count)

    @app.before_request
    def wait_for_setup():
        """While the demo data loads, every request gets a plain 'getting ready' reply and nothing touches
        the database."""
        if setting_up():
            return _reply(GETTING_READY, 503)
        return None

    @app.before_request
    def reject_cross_site_changes():
        """Browsers name the page a request comes from (Origin). A change sent from any other site is refused,
        on top of the SameSite cookies and the CSRF token."""
        if request.method in STATE_CHANGING and request.path.startswith("/api/"):
            origin = request.headers.get("Origin")
            if origin and _origin(origin) not in allowed_origins():
                app.logger.warning("Blocked a %s to %s from another site", request.method, request.path)
                return _reply("Requests from other websites are not allowed.", 403)
        return None

    @app.after_request
    def add_security_headers(response):
        """Harden every response the API sends."""
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        if not request.path.startswith(CROSS_SITE_PATHS):
            response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        if request.is_secure:
            response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        return response

    @app.errorhandler(HTTPException)
    def http_error(error):
        """Known HTTP errors as the standard JSON reply."""
        return _reply(ERROR_MESSAGES.get(error.code, error.name), error.code)

    @app.errorhandler(Exception)
    def unexpected_error(error):
        """Log the details on the server; the client only learns that something failed."""
        db.session.rollback()
        app.logger.exception("Unhandled error on %s %s", request.method, request.path)
        return _reply("Something went wrong on our side and we're fixing it. Please try again in a few minutes.", 500)

    # ---- tokens: every one is checked against its session row; replies never say why a token failed ----

    @jwt.token_in_blocklist_loader
    def is_revoked(_header, claims):
        """A token works only while its session is active, in time, in the same browser, and (for an access
        token) from the latest refresh."""
        from app.services.session_service import SessionService
        return not SessionService.check(claims)

    @jwt.user_lookup_loader
    def load_user(_header, _claims):
        """The signed-in user, found through the session (the token itself names no user)."""
        session = getattr(g, "auth_session", None)
        return session.user if session else None

    @jwt.user_lookup_error_loader
    def user_missing(_header, _claims):
        return _reply(SIGNED_OUT, 401)

    def _csrf_or_signed_out(reason):
        # A missing or wrong CSRF header is a forbidden change (403), not a signed-out user (401), so the page
        # does not try to renew a session that is fine
        if "csrf" in str(reason).lower():
            return _reply("This change could not be verified. Reload the page and try again.", 403)
        return _reply(SIGNED_OUT, 401)

    @jwt.unauthorized_loader
    def missing_token(reason):
        return _csrf_or_signed_out(reason)

    @jwt.invalid_token_loader
    def bad_token(reason):
        return _csrf_or_signed_out(reason)

    def _session_over():
        """The session cannot continue: clear its cookies too."""
        response, status = _reply(SIGNED_OUT, 401)
        unset_jwt_cookies(response)
        return response, status

    @jwt.expired_token_loader
    def expired_token(_header, claims):
        # An expired access token is normal (the page refreshes it); an expired refresh token ends the session
        return _session_over() if claims.get("type") == "refresh" else _reply(SIGNED_OUT, 401)

    @jwt.revoked_token_loader
    def revoked_token(_header, _claims):
        return _session_over()
