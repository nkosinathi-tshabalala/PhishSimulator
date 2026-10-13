# Database table: extra player details (age, occupation, IT background)

from datetime import datetime
from app.extensions import db
from app.enums.occupation import Occupation


class UserProfile(db.Model):
    """Stores player demographic information."""

    __tablename__ = "user_profile"

    profile_id = db.Column(
        db.Integer,
        primary_key=True
    )

    player_id = db.Column(
        db.Integer,
        db.ForeignKey("player.player_id"),
        nullable=False,
        unique=True
    )

    age = db.Column(
        db.Integer,
        nullable=False
    )

    it_background = db.Column(
        db.Boolean,
        nullable=False
    )

    occupation = db.Column(
    db.Enum(Occupation),
    nullable=False
    )

    # Opt-in to simulated phishing emails in the player's real inbox; withdrawable at any time
    campaign_consent = db.Column(
        db.Boolean,
        nullable=False,
        default=False
    )

    campaign_consent_at = db.Column(
        db.DateTime,
        nullable=True
    )

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    player = db.relationship(
        "Player",
        back_populates="profile"
    )

    def __repr__(self):
        """Short text shown when debugging."""
        return f"<UserProfile {self.profile_id}>"