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

    user = db.relationship(
        "User",
        back_populates="sessions"
    )

    def __repr__(self):
        """Short text shown when debugging."""
        return f"<UserSession {self.session_id}>"