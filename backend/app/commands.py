# Command-line tasks for the server, run with "flask --app run.py <command>"

import click
from flask.cli import with_appcontext

from app.enums.role import Role
from app.extensions import bcrypt, db
from app.models.authentication import User
from app.schemas.auth_schema import AuthSchema


@click.command("create-admin")
@click.argument("email")
@click.password_option(help="Asked for twice when not given, so it never appears in the shell history.")
@with_appcontext
def create_admin(email, password):
    """Create an administrator account. Registration in the app only creates players, so a database
    without the demo data needs this once. Example: flask --app run.py create-admin admin@example.com"""
    error = AuthSchema.email_problem(email) or AuthSchema.password_problem(password)
    if error:
        raise click.ClickException(error)
    email = AuthSchema.clean_email(email)
    if User.query.filter_by(email=email).first():
        raise click.ClickException(f"An account for {email} already exists.")

    db.session.add(User(email=email, password_hash=bcrypt.generate_password_hash(password).decode("utf-8"),
                        role=Role.ADMIN.value))
    db.session.commit()
    click.echo(f"Administrator {email} created.")


def register_commands(app):
    """Add the server's commands to the flask command line."""
    app.cli.add_command(create_admin)
