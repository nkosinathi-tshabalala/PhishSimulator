# Checks registration, login and password data before it is used.
# These are the rules that count: the frontend repeats them only to help the user, since anyone can send
# requests without the page. (SQL injection is prevented separately: every query goes through SQLAlchemy
# with bound parameters, never by pasting text into SQL.)

import re

from app.enums.occupation import Occupation

EMAIL_PATTERN = re.compile(r"^[\w.+-]+@[\w-]+(\.[\w-]+)+$")
MAX_EMAIL_LENGTH = 254
# Letters (any language) and digits, joined by single spaces, apostrophes, hyphens or full stops:
# "Lee-Ann Davids", "Nompumelelo O'Neil", "John Smith 3rd". No markup or code characters (< > ; ( ) = ").
NAME_PATTERN = re.compile(r"^[^\W_]+(?:(?:\. |[ '.-])[^\W_]+)*\.?$")
MAX_NAME_LENGTH = 100
MIN_PASSWORD_LENGTH = 8
# bcrypt reads at most 72 bytes and this version refuses longer ones, so passwords are capped below that
MAX_PASSWORD_LENGTH = 64
MAX_PASSWORD_BYTES = 72
MIN_AGE = 16
MAX_AGE = 120


class AuthSchema:
    """Validates authentication requests."""

    @staticmethod
    def clean_email(value):
        """Emails are stored and compared in lower case without spaces."""
        return str(value or "").strip().lower()

    @staticmethod
    def too_long_for_bcrypt(password):
        password = str(password or "")
        return len(password) > MAX_PASSWORD_LENGTH or len(password.encode("utf-8")) > MAX_PASSWORD_BYTES

    @staticmethod
    def password_problem(password):
        """Why a new password is too weak or too long, or None when it is fine."""
        password = str(password or "")
        if len(password) < MIN_PASSWORD_LENGTH:
            return f"Password must be at least {MIN_PASSWORD_LENGTH} characters."
        if AuthSchema.too_long_for_bcrypt(password):
            return f"Password must be at most {MAX_PASSWORD_LENGTH} characters."
        if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
            return "Password must contain at least one letter and one number."
        return None

    @staticmethod
    def email_problem(email):
        email = AuthSchema.clean_email(email)
        if len(email) > MAX_EMAIL_LENGTH or not EMAIL_PATTERN.match(email):
            return "Invalid email address."
        return None

    @staticmethod
    def name_problem(name):
        name = " ".join(str(name or "").split())
        if not name:
            return "Full name is required."
        if len(name) > MAX_NAME_LENGTH:
            return f"Full name must be at most {MAX_NAME_LENGTH} characters."
        if not NAME_PATTERN.match(name):
            return "Full name may only contain letters, numbers, spaces, apostrophes, hyphens and full stops."
        return None

    @staticmethod
    def age_problem(age):
        text = str(age).strip()
        if not text.isdigit() or not MIN_AGE <= int(text) <= MAX_AGE:
            return f"Age must be a whole number from {MIN_AGE} to {MAX_AGE}."
        return None

    @staticmethod
    def missing_field(data, fields):
        """A message for the first required field that is empty, or None."""
        if not isinstance(data, dict):
            return "The request is missing its details."
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
        error = AuthSchema.name_problem(data["full_name"]) or AuthSchema.email_problem(data["email"])
        if error:
            return False, error
        if data["password"] != data["confirm_password"]:
            return False, "Passwords do not match."
        error = AuthSchema.password_problem(data["password"]) or AuthSchema.age_problem(data["age"])
        if error:
            return False, error
        if data["occupation"] not in Occupation.__members__:
            return False, "Invalid occupation selected."
        return True, None

    @staticmethod
    def validate_login(data):
        """Check that an email and password were given and are not absurdly long. Returns (is_valid, error)."""
        error = AuthSchema.missing_field(data, ("email", "password"))
        if error:
            return False, error
        if len(AuthSchema.clean_email(data["email"])) > MAX_EMAIL_LENGTH or AuthSchema.too_long_for_bcrypt(data["password"]):
            # The same reply as a wrong password: nothing to learn from it
            return False, "Invalid email or password."
        return True, None

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
