"""Permanently remove every PhishSimulator database record.

The command preserves the database itself but drops and recreates all tables.
Use it only when you want to begin with no users, datasets, scenarios,
simulation attempts, campaigns, or analytics history.
"""

import argparse
import sys

from sqlalchemy.engine import make_url

from app import create_app
from app.extensions import db


def display_database_url(database_uri):
    """Return the configured target without exposing a database password."""
    url = make_url(database_uri)
    return str(url.set(password="***")) if url.password else str(url)


def main():
    parser = argparse.ArgumentParser(
        description="Permanently remove all PhishSimulator application data."
    )
    parser.add_argument(
        "--confirm-reset",
        action="store_true",
        help="Required acknowledgement before data is permanently deleted.",
    )
    arguments = parser.parse_args()

    if not arguments.confirm_reset:
        parser.error(
            "Refusing to reset the database. Re-run with --confirm-reset."
        )

    app = create_app()
    with app.app_context():
        database_uri = app.config["SQLALCHEMY_DATABASE_URI"]
        print(f"Resetting database: {display_database_url(database_uri)}")
        db.session.remove()
        db.drop_all()
        db.create_all()
        print("Database reset complete. All application data has been removed.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Database reset failed: {error}", file=sys.stderr)
        raise
