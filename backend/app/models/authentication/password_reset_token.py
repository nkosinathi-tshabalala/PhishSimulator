from datetime import datetime, timedelta

from app.extensions import db

class PasswordResetToken(db.Model):
    """Stores password reset tokens."""

    __tablename__ = "password_reset_token"

    # Primary Key
    reset_token_id = db.Column(
        db.Integer,
        primary_key=True
    )

    # Foreign Key
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.user_id"),
        nullable=False
    )

    # Reset Token
    token = db.Column(
        db.String(255),
        unique=True,
        nullable=False
    )

    expires_at = db.Column(
        db.DateTime,
        default=lambda: datetime.utcnow() + timedelta(minutes=30),
        nullable=False
    )

    used = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    # Relationship
    user = db.relationship(
        "User",
        back_populates="reset_tokens"
    )

    def __repr__(self):
        return f"<PasswordResetToken {self.reset_token_id}>"