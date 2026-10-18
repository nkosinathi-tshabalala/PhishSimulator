# Application settings, read from backend/.env (PostgreSQL only)

import os
from datetime import timedelta

from dotenv import load_dotenv

load_dotenv()


def _database_url():
    """Build the PostgreSQL connection URL from the environment."""
    if os.getenv("DATABASE_URL"):
        return os.getenv("DATABASE_URL")

    settings = {name: os.getenv(name) for name in ("DB_USER", "DB_PASSWORD", "DB_HOST", "DB_PORT", "DB_NAME")}
    missing = [name for name, value in settings.items() if not value]
    if missing:
        raise RuntimeError(
            f"PostgreSQL is not configured. Add {', '.join(missing)} to backend/.env "
            "(see backend/.env.example)."
        )

    return (
        f"postgresql://{settings['DB_USER']}:{settings['DB_PASSWORD']}"
        f"@{settings['DB_HOST']}:{settings['DB_PORT']}/{settings['DB_NAME']}"
    )


def _secret(name):
    """A signing key from the environment. The app refuses to start with a missing or short one."""
    value = os.getenv(name) or ""
    if len(value) < 32:
        raise RuntimeError(
            f"{name} must be a random string of at least 32 characters in backend/.env. "
            'Create one with: python -c "import secrets; print(secrets.token_hex(32))"'
        )
    return value


def _list(name):
    """Read a comma-separated setting as a clean list."""
    return [item.strip().lower() for item in os.getenv(name, "").split(",") if item.strip()]


class Config:
    """Settings for Flask, the database, logins and email campaigns."""
    SECRET_KEY = _secret("SECRET_KEY")
    JWT_SECRET_KEY = _secret("JWT_SECRET_KEY")

    # ---- Logins: server-side sessions (the user_session table) with two signed tokens in cookies ----
    # The access token proves which session a request belongs to, for a few minutes. The refresh token
    # (sent only to /api/auth/refresh) gets a new access token and is replaced every time it is used.
    # Neither carries the user id, email or role: only a random session key the server looks up.
    SESSION_IDLE_MINUTES = int(os.getenv("SESSION_IDLE_MINUTES", "30"))     # signed out after this long idle
    SESSION_MAX_HOURS = int(os.getenv("SESSION_MAX_HOURS", "12"))           # and after this long, however active
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.getenv("ACCESS_TOKEN_MINUTES", "10")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(hours=SESSION_MAX_HOURS)
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_ALGORITHM = "HS256"
    JWT_DECODE_ALGORITHMS = ["HS256"]          # never accept another algorithm (or "none")
    JWT_ENCODE_ISSUER = JWT_DECODE_ISSUER = "phishsimulator-api"
    JWT_ENCODE_AUDIENCE = JWT_DECODE_AUDIENCE = "phishsimulator-web"
    # HttpOnly (page scripts cannot read them), sent only to this site (SameSite=Strict), and only over
    # HTTPS or to localhost, unless COOKIE_SECURE=false (plain http to another address, e.g. a phone on the LAN)
    JWT_COOKIE_SECURE = os.getenv("COOKIE_SECURE", "true").strip().lower() != "false"
    JWT_COOKIE_SAMESITE = "Strict"
    JWT_SESSION_COOKIE = True                  # the cookies go when the browser closes
    JWT_ACCESS_COOKIE_NAME = "ps_access"
    JWT_REFRESH_COOKIE_NAME = "ps_refresh"
    JWT_ACCESS_COOKIE_PATH = "/api/"
    JWT_REFRESH_COOKIE_PATH = "/api/auth/refresh"
    # Cross-site request forgery: every change (POST, PUT, PATCH, DELETE) must repeat the readable CSRF
    # cookie in the X-CSRF-Token header, which another site cannot do
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_CSRF_IN_COOKIES = True
    JWT_ACCESS_CSRF_COOKIE_NAME = "ps_csrf"
    JWT_REFRESH_CSRF_COOKIE_NAME = "ps_csrf_refresh"
    JWT_ACCESS_CSRF_COOKIE_PATH = "/"
    JWT_REFRESH_CSRF_COOKIE_PATH = "/"
    JWT_ACCESS_CSRF_HEADER_NAME = "X-CSRF-Token"
    JWT_REFRESH_CSRF_HEADER_NAME = "X-CSRF-Token"

    # How many proxies sit in front of the API (1 behind nginx in Docker), so the client's real address
    # is used for rate limits. 0 when the API is reached directly.
    TRUSTED_PROXY_COUNT = int(os.getenv("TRUSTED_PROXY_COUNT", "0"))
    # Per-address limits on sign-in, registration and password resets (off only for automated checks)
    RATE_LIMITS = os.getenv("RATE_LIMITS", "on").strip().lower() != "off"

    # Largest file the API accepts (dataset uploads). nginx uses the same limit in Docker.
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024

    SQLALCHEMY_DATABASE_URI = _database_url()
    # Test each pooled connection before use, so a database restart (or a laptop waking from sleep)
    # does not turn the next request into an error
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # "development" locally (from .env); anything else is treated as production
    FLASK_ENV = os.getenv("FLASK_ENV", "production")
    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
    PUBLIC_BACKEND_URL = os.getenv("PUBLIC_BACKEND_URL") or BACKEND_URL

    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = (os.getenv("SMTP_USERNAME") or "").strip() or None
    # Gmail shows app passwords as "abcd efgh ijkl mnop"; SMTP only accepts them without the spaces
    SMTP_PASSWORD = "".join((os.getenv("SMTP_PASSWORD") or "").split()) or None

    CAMPAIGN_ALLOWED_RECIPIENTS = _list("CAMPAIGN_ALLOWED_RECIPIENTS")
    # The inbox the demo's test players are plus-aliases of; the app hides it when showing their addresses
    DEMO_EMAIL = (os.getenv("DEMO_EMAIL") or "").strip().lower()
    # A delivered email with no click or report after this long counts as ignored
    CAMPAIGN_IGNORE_MINUTES = int(os.getenv("CAMPAIGN_IGNORE_MINUTES", "10"))
