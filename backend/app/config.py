import os

from dotenv import load_dotenv
from sqlalchemy import create_engine

# Load environment variables from the .env file
load_dotenv()


class Config:
    """Application configuration."""

    SECRET_KEY = os.getenv("SECRET_KEY")

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")

    FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
    SMTP_HOST = os.getenv("SMTP_HOST")
    SMTP_PORT = os.getenv("SMTP_PORT", "587")
    SMTP_USERNAME = os.getenv("SMTP_USERNAME")
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL")

    _database_url = os.getenv("DATABASE_URL")
    _postgres_settings = (
        os.getenv("DB_USER"),
        os.getenv("DB_PASSWORD"),
        os.getenv("DB_HOST"),
        os.getenv("DB_PORT"),
        os.getenv("DB_NAME"),
    )

    _postgres_uri = (
        f"postgresql://{_postgres_settings[0]}:"
        f"{_postgres_settings[1]}@"
        f"{_postgres_settings[2]}:"
        f"{_postgres_settings[3]}/"
        f"{_postgres_settings[4]}"
        if all(_postgres_settings)
        else None
    )

    @staticmethod
    def _postgres_is_available(database_uri):
        try:
            with create_engine(
                database_uri,
                connect_args={"connect_timeout": 2},
            ).connect():
                return True
        except Exception:
            return False

    if _database_url:
        SQLALCHEMY_DATABASE_URI = _database_url
    elif _postgres_uri and _postgres_is_available(_postgres_uri):
        SQLALCHEMY_DATABASE_URI = _postgres_uri
    else:
        SQLALCHEMY_DATABASE_URI = "sqlite:///phishsimulator.db"

    SQLALCHEMY_TRACK_MODIFICATIONS = False