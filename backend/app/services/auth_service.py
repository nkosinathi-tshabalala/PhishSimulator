# Registration, login, profiles, passwords and logout

import hashlib
import secrets
from datetime import datetime, timedelta
from math import ceil

from flask import current_app, g
from flask_jwt_extended import current_user

from app.email.mailer import Mailer
from app.enums.occupation import Occupation
from app.enums.role import Role
from app.extensions import bcrypt, db
from app.models.authentication import PasswordResetToken, Player, User, UserProfile
from app.schemas.auth_schema import AuthSchema
from app.services.session_service import SessionService

# Wrong passwords allowed in a row before the account is locked for LOCK_MINUTES
MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 15
RESET_LINK_MINUTES = 30

# The same reply whether the email or the password was wrong, so accounts cannot be guessed
WRONG_LOGIN = "Invalid email or password."
RESET_REQUESTED = "If that account exists, reset instructions will be sent."


def hash_token(token):
    """Reset tokens are stored hashed, so a leaked database cannot be used to reset passwords."""
    return hashlib.sha256(token.encode()).hexdigest()


_dummy_hash = None


def _check_password(user, password):
    """Check a password with bcrypt. For an unknown email a dummy hash is checked instead, so the reply takes
    as long either way and its timing does not reveal which emails have accounts."""
    global _dummy_hash
    if user is None:
        if _dummy_hash is None:
            _dummy_hash = bcrypt.generate_password_hash(secrets.token_urlsafe(16)).decode("utf-8")
        bcrypt.check_password_hash(_dummy_hash, password)
        return False
    return bcrypt.check_password_hash(user.password_hash, password)


class AuthService:
    """Handles authentication business logic."""

    @staticmethod
    def register(data):
        """Create a player with their profile."""
        is_valid, error = AuthSchema.validate_registration(data)
        if not is_valid:
            return False, error

        email = AuthSchema.clean_email(data["email"])
        if User.query.filter_by(email=email).first():
            return False, "An account with this email already exists."

        user = User(email=email, password_hash=AuthService._hash(data["password"]), role=Role.PLAYER.value)
        db.session.add(user)
        db.session.flush()
        player = Player(user_id=user.user_id, full_name=" ".join(str(data["full_name"]).split()))
        db.session.add(player)
        db.session.flush()
        db.session.add(UserProfile(
            player_id=player.player_id,
            age=int(data["age"]),
            it_background=bool(data["it_background"]),
            occupation=data["occupation"],
            **AuthService._consent_fields(data.get("campaign_consent")),
        ))
        db.session.commit()
        return True, "Registration successful."

    @staticmethod
    def login(data):
        """Check the email and password, then start a new server-side session.
        Returns (success, message, (access token, refresh token, session timing) or None)."""
        is_valid, error = AuthSchema.validate_login(data)
        if not is_valid:
            return False, error, None

        user = User.query.filter_by(email=AuthSchema.clean_email(data["email"])).first()
        now = datetime.utcnow()
        if user and user.locked_until and user.locked_until > now:
            minutes = ceil((user.locked_until - now).total_seconds() / 60)
            return False, f"Too many failed attempts. Try again in {minutes} minute(s).", None

        if not _check_password(user, data["password"]):
            if user:
                AuthService._record_failed_login(user, now)
            return False, WRONG_LOGIN, None

        user.failed_logins = 0
        user.locked_until = None
        session, access, refresh = SessionService.start(user)
        return True, "Login successful.", (access, refresh, SessionService.timing(session))

    @staticmethod
    def logout():
        """End this login session, so its tokens stop working straight away."""
        SessionService.end(g.auth_session, "logout")
        db.session.commit()
        return True, "Logged out successfully."

    @staticmethod
    def request_password_reset(email):
        """Email a one-time reset link. The reply is the same whether or not the account exists."""
        user = User.query.filter_by(email=AuthSchema.clean_email(email)).first()
        if not user:
            return True, RESET_REQUESTED

        # Only the newest link works
        PasswordResetToken.query.filter_by(user_id=user.user_id, used=False).update({PasswordResetToken.used: True})
        token = secrets.token_urlsafe(32)
        db.session.add(PasswordResetToken(
            user_id=user.user_id,
            token=hash_token(token),
            expires_at=datetime.utcnow() + timedelta(minutes=RESET_LINK_MINUTES),
        ))
        db.session.commit()

        # The token goes after "#", which browsers never send to a server, so it stays out of web server
        # logs and Referer headers; the page reads it and clears the address bar
        reset_url = f"{current_app.config['FRONTEND_URL']}/reset-password#token={token}"
        Mailer.send(
            user.email,
            "Reset your PhishSimulator password",
            f"Use this link within {RESET_LINK_MINUTES} minutes to reset your password:\n\n{reset_url}\n\n"
            "If you did not request this, you can ignore this email.",
            from_name="PhishSimulator",
        )
        return True, RESET_REQUESTED

    @staticmethod
    def reset_password(data):
        """Set a new password from an emailed link, then sign out every session of that account."""
        is_valid, error = AuthSchema.validate_new_password(data, ("token", "new_password", "confirm_password"))
        if not is_valid:
            return False, error

        reset = PasswordResetToken.query.filter_by(token=hash_token(str(data["token"])), used=False).first()
        if not reset or reset.expires_at < datetime.utcnow():
            return False, "This reset link is invalid or has expired. Please request a new one."

        user = reset.user
        user.password_hash = AuthService._hash(data["new_password"])
        user.failed_logins = 0
        user.locked_until = None
        reset.used = True
        SessionService.end_all(user.user_id, "password_reset")
        db.session.commit()
        return True, "Password updated. You can now sign in."

    @staticmethod
    def get_current_user():
        """The signed-in user's account and profile details."""
        user = current_user
        if not user:
            return False, "User not found.", None
        if user.role == Role.ADMIN.value:
            return True, "User retrieved successfully.", AuthService._details(user)

        profile = user.player.profile if user.player else None
        if not profile:
            return False, "Player profile not found.", None
        return True, "User retrieved successfully.", AuthService._details(user, user.player, profile)

    @staticmethod
    def update_profile(data):
        """Save a player's name, age, occupation, IT background and campaign consent."""
        user = current_user
        if not user or not user.player or not user.player.profile:
            return False, "Only players have profile details to edit.", None

        error = AuthSchema.missing_field(data, ("full_name", "age", "occupation"))
        if error:
            return False, error, None
        error = AuthSchema.name_problem(data["full_name"]) or AuthSchema.age_problem(data["age"])
        if error:
            return False, error, None
        try:
            occupation = Occupation(data["occupation"])
        except ValueError:
            return False, "Invalid occupation selected.", None

        player, profile = user.player, user.player.profile
        player.full_name = " ".join(str(data["full_name"]).split())
        profile.age = int(data["age"])
        profile.it_background = bool(data.get("it_background"))
        profile.occupation = occupation
        if "campaign_consent" in data:
            consent = bool(data["campaign_consent"])
            if consent != profile.campaign_consent:
                for name, value in AuthService._consent_fields(consent).items():
                    setattr(profile, name, value)
        db.session.commit()
        return True, "Profile updated successfully.", AuthService._details(user, player, profile)

    @staticmethod
    def change_password(data):
        """Change the signed-in user's password after checking the current one."""
        user = current_user
        if not user:
            return False, "User not found."

        is_valid, error = AuthSchema.validate_new_password(data, ("current_password", "new_password", "confirm_password"))
        if not is_valid:
            return False, error
        if AuthSchema.too_long_for_bcrypt(data["current_password"]) or not _check_password(user, data["current_password"]):
            return False, "Current password is incorrect."

        user.password_hash = AuthService._hash(data["new_password"])
        # Anyone signed in elsewhere with the old password is signed out; this browser stays signed in
        SessionService.end_all(user.user_id, "password_changed", keep=g.auth_session)
        db.session.commit()
        return True, "Password updated successfully."

    @staticmethod
    def _record_failed_login(user, now):
        """Count a wrong password and lock the account after too many in a row."""
        user.failed_logins += 1
        if user.failed_logins >= MAX_FAILED_LOGINS:
            user.failed_logins = 0
            user.locked_until = now + timedelta(minutes=LOCK_MINUTES)
        db.session.commit()

    @staticmethod
    def _hash(password):
        """A bcrypt hash of a password, ready to store."""
        return bcrypt.generate_password_hash(password).decode("utf-8")

    @staticmethod
    def _details(user, player=None, profile=None):
        """The account fields the frontend shows. Admins have no player profile."""
        # Only for the signed-in user, about themselves: the page needs the role to show the right menu.
        # Every admin action is still checked on the server. No ids or security fields are sent.
        return {
            "email": user.email,
            "role": user.role,
            "full_name": player.full_name if player else "Administrator",
            "age": profile.age if profile else None,
            "it_background": profile.it_background if profile else None,
            "occupation": profile.occupation.value if profile else None,
            "campaign_consent": profile.campaign_consent if profile else None,
            "campaign_consent_at": profile.campaign_consent_at.isoformat() if profile and profile.campaign_consent_at else None,
        }

    @staticmethod
    def _consent_fields(consent):
        """Profile fields for a campaign-email consent choice: when it was given, or none once withdrawn."""
        consent = bool(consent)
        return {"campaign_consent": consent, "campaign_consent_at": datetime.utcnow() if consent else None}
