from datetime import datetime
from app.extensions import db
from app.enums.occupation import Occupation



class UserProfile(db.Model):
    """Stores player demographic information."""

    __tablename__ = "user_profile"

    # Primary Key
    profile_id = db.Column(
        db.Integer,
        primary_key=True
    )

    # Foreign Key
    player_id = db.Column(
        db.Integer,
        db.ForeignKey("player.player_id"),
        nullable=False,
        unique=True
    )

    # Profile Information
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

    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # Relationship
    player = db.relationship(
        "Player",
        back_populates="profile"
    )

    def __repr__(self):
        return f"<UserProfile {self.profile_id}>"