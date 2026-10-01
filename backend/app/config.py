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
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)

    # Largest file the API accepts (dataset uploads). nginx uses the same limit in Docker.
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024

    SQLALCHEMY_DATABASE_URI = _database_url()

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
    # A delivered email with no click or report after this long counts as ignored
    CAMPAIGN_IGNORE_MINUTES = int(os.getenv("CAMPAIGN_IGNORE_MINUTES", "10"))
