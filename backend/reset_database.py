# Wipes the database and recreates empty tables
# Usage: .venv\Scripts\python.exe reset_database.py --confirm-reset

import argparse
import sys

from flask_migrate import stamp
from sqlalchemy.engine import make_url

from app import create_app
from app.extensions import db


def safe_url(database_uri):
    """Show the target database without printing its password."""
    url = make_url(database_uri)
    return str(url.set(password="***")) if url.password else str(url)


def main():
    """Drop and recreate every table after confirmation."""
    parser = argparse.ArgumentParser(description="Delete all data and recreate empty tables.")
    parser.add_argument("--confirm-reset", action="store_true", help="Required before anything is deleted.")
    args = parser.parse_args()
    if not args.confirm_reset:
        parser.error("Refusing to reset. Re-run with --confirm-reset.")

    app = create_app()
    with app.app_context():
        print(f"Resetting database: {safe_url(app.config['SQLALCHEMY_DATABASE_URI'])}")
        db.session.remove()
        db.drop_all()
        db.create_all()
        stamp(revision="head")
        print("Done. All data removed and empty tables recreated.")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Database reset failed: {error}", file=sys.stderr)
        raise
