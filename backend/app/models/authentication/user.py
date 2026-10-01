# Database table: user accounts (email, password hash, role)

from datetime import datetime

from app.extensions import db


class User(db.Model):
    """Stores authentication details for all users."""

    __tablename__ = "user"

    user_id = db.Column(
        db.Integer,
        primary_key=True
    )

    email = db.Column(
        db.String(255),
        unique=True,
        nullable=False
    )

    password_hash = db.Column(
        db.String(255),
        nullable=False
    )

    role = db.Column(
        db.String(20),
        nullable=False,
        default="PLAYER"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # Wrong passwords in a row; too many locks the account until locked_until
    failed_logins = db.Column(
        db.Integer,
        default=0,
        server_default="0",
        nullable=False
    )

    locked_until = db.Column(
        db.DateTime,
        nullable=True
    )

    player = db.relationship(
        "Player",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )

    sessions = db.relationship(
        "UserSession",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    reset_tokens = db.relationship(
        "PasswordResetToken",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        """Short text shown when debugging."""
        return f"<User {self.email}>"