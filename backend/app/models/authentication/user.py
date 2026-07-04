from datetime import datetime

from app.extensions import db


class User(db.Model):
    """Stores authentication details for all users."""

    __tablename__ = "user"

    # Primary Key
    user_id = db.Column(
        db.Integer,
        primary_key=True
    )

    # Authentication
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

    # Audit
    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # Relationships
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
        return f"<User {self.email}>"