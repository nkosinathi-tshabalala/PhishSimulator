# Database table: one player's attempt at a baseline assessment

from datetime import datetime

from app.extensions import db


class BaselineAssessment(db.Model):
    """Stores a player's baseline assessment attempt."""

    __tablename__ = "baseline_assessment"

    assessment_id = db.Column(
        db.Integer,
        primary_key=True
    )

    player_id = db.Column(
        db.Integer,
        db.ForeignKey("player.player_id"),
        nullable=False
    )

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

    # Which baseline assessment was taken (empty for attempts from before assessments had names)
    template_id = db.Column(
        db.Integer,
        db.ForeignKey("baseline_template.template_id"),
        nullable=True
    )

    template = db.relationship(
        "BaselineTemplate",
        back_populates="assessments"
    )

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
        """Short text shown when debugging."""
        return (
            f"<BaselineAssessment "
            f"{self.assessment_id} "
            f"Player:{self.player_id}>"
        )