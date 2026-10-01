# Checks registration, login and password data before it is used

import re

from app.enums.occupation import Occupation

EMAIL_PATTERN = re.compile(r"^[\w.+-]+@[\w-]+(\.[\w-]+)+$")
MIN_PASSWORD_LENGTH = 8
MIN_AGE = 16


class AuthSchema:
    """Validates authentication requests."""

    @staticmethod
    def clean_email(value):
        """Emails are stored and compared in lower case without spaces."""
        return str(value or "").strip().lower()

    @staticmethod
    def password_problem(password):
        """Why a new password is too weak, or None when it is strong enough."""
        password = str(password or "")
        if len(password) < MIN_PASSWORD_LENGTH:
            return f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
            return "Password must contain at least one letter and one number."
        return None

    @staticmethod
    def missing_field(data, fields):
        """A message for the first required field that is empty, or None."""
        for field in fields:
            if data.get(field) in ("", None):
                return f"{field.replace('_', ' ').capitalize()} is required."
        return None

    @staticmethod
    def validate_registration(data):
        """Check a new player's details. Returns (is_valid, error)."""
        error = AuthSchema.missing_field(data, (
            "full_name", "email", "password", "confirm_password", "age", "it_background", "occupation",
        ))
        if error:
            return False, error
        if not EMAIL_PATTERN.match(AuthSchema.clean_email(data["email"])):
            return False, "Invalid email address."
        if data["password"] != data["confirm_password"]:
            return False, "Passwords do not match."
        error = AuthSchema.password_problem(data["password"])
        if error:
            return False, error
        if not str(data["age"]).isdigit() or int(data["age"]) < MIN_AGE:
            return False, f"Age must be at least {MIN_AGE}."
        if data["occupation"] not in Occupation.__members__:
            return False, "Invalid occupation selected."
        return True, None

    @staticmethod
    def validate_login(data):
        """Check that an email and password were given. Returns (is_valid, error)."""
        error = AuthSchema.missing_field(data, ("email", "password"))
        return (False, error) if error else (True, None)

    @staticmethod
    def validate_new_password(data, required=("new_password", "confirm_password")):
        """Check a new password and its confirmation. Returns (is_valid, error)."""
        error = AuthSchema.missing_field(data, required)
        if error:
            return False, error
        if data["new_password"] != data["confirm_password"]:
            return False, "New passwords do not match."
        error = AuthSchema.password_problem(data["new_password"])
        return (False, error) if error else (True, None)
