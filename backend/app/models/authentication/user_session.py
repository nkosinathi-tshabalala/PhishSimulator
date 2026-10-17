# Database table: login sessions

from datetime import datetime

from app.extensions import db
from app.enums.session_status import SessionStatus


class UserSession(db.Model):
    """Stores user login session information."""

    __tablename__ = "user_session"

    session_id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.user_id"),
        nullable=False
    )

    login_time = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    logout_time = db.Column(
        db.DateTime,
        nullable=True
    )

    status = db.Column(
        db.Enum(SessionStatus),
        nullable=False,
        default=SessionStatus.ACTIVE
    )

    # SHA-256 of the random session key carried in this session's tokens (the key itself is never stored)
    key_hash = db.Column(
        db.String(64),
        unique=True,
        index=True
    )

    # SHA-256 of the current refresh token's id, and of the one before it (allowed briefly, when two tabs
    # refresh at the same moment). Any older refresh token means it was copied, so the session is revoked.
    refresh_hash = db.Column(
        db.String(64)
    )

    previous_refresh_hash = db.Column(
        db.String(64)
    )

    # Goes up with every refresh; an access token is only accepted with the current number
    generation = db.Column(
        db.Integer,
        nullable=False,
        default=0,
        server_default="0"
    )

    rotated_at = db.Column(
        db.DateTime
    )

    # Ends when not refreshed for the idle time, and at the latest at expires_at, however active
    idle_expires_at = db.Column(
        db.DateTime
    )

    expires_at = db.Column(
        db.DateTime
    )

    # SHA-256 of the browser's User-Agent at sign-in; a token used from another browser ends the session
    user_agent_hash = db.Column(
        db.String(64)
    )

    # Why the session ended: logout, idle_timeout, max_lifetime, password_changed, refresh_reuse...
    ended_reason = db.Column(
        db.String(40)
    )

    user = db.relationship(
        "User",
        back_populates="sessions"
    )

    def __repr__(self):
        """Short text shown when debugging."""
        return f"<UserSession {self.session_id}>"