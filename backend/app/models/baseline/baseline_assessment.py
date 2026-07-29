from datetime import datetime

from app.extensions import db


class BaselineAssessment(db.Model):
    """Stores a player's baseline assessment attempt."""

    __tablename__ = "baseline_assessment"

    # Primary Key
    assessment_id = db.Column(
        db.Integer,
        primary_key=True
    )

    # Foreign Key
    player_id = db.Column(
        db.Integer,
        db.ForeignKey("player.player_id"),
        nullable=False
    )

    # Assessment Details
    started_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    completed_at = db.Column(
        db.DateTime,
        nullable=True
    )

    score = db.Column(
        db.Float,
        default=0.0,
        nullable=False
    )

    # Relationships
    player = db.relationship(
        "Player",
        back_populates="baseline_assessments"
    )

    responses = db.relationship(
        "BaselineResponse",
        back_populates="assessment",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return (
            f"<BaselineAssessment "
            f"{self.assessment_id} "
            f"Player:{self.player_id}>"
        )