import re

class AuthSchema:
    """Validates authentication requests."""

    @staticmethod
    def validate_registration(data):
        """Validate registration data."""

        required_fields = [
            "full_name",
            "email",
            "password",
            "confirm_password",
            "age",
            "it_background",
            "occupation"
        ]

        # Check required fields
        for field in required_fields:
            if field not in data:
                return False, f"{field} is required."

            if data[field] in ("", None):
                return False, f"{field} cannot be empty."

        # Email format
        email_pattern = r"^[\w\.-]+@[\w\.-]+\.\w+$"

        if not re.match(email_pattern, data["email"]):
            return False, "Invalid email address."

        # Password confirmation
        if data["password"] != data["confirm_password"]:
            return False, "Passwords do not match."

        # Minimum password length
        if len(data["password"]) < 8:
            return False, "Password must be at least 8 characters."

        # Age validation
        if data["age"] < 16:
            return False, "Age must be at least 16."

        return True, None