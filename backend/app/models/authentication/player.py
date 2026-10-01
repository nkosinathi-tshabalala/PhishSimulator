# Database table: the player profile linked to a user account

from datetime import datetime

from app.extensions import db


class Player(db.Model):
    """Stores player information."""

    __tablename__ = "player"

    player_id = db.Column(
        db.Integer,
        primary_key=True
    )

    user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.user_id"),
        nullable=False,
        unique=True
    )

    full_name = db.Column(
        db.String(150),
        nullable=False
    )

    joined_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    user = db.relationship(
        "User",
        back_populates="player"
    )

    profile = db.relationship(
        "UserProfile",
        back_populates="player",
        uselist=False,
        cascade="all, delete-orphan"
    )

    baseline_assessments = db.relationship(
    "BaselineAssessment",
    back_populates="player",
    cascade="all, delete-orphan"
    )   

    def __repr__(self):
        """Short text shown when debugging."""
        return f"<Player {self.full_name}>"