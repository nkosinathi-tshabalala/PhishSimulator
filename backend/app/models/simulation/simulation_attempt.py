# Database table: every decision a player makes

from datetime import datetime

from app.extensions import db


class SimulationAttempt(db.Model):
    """One decision a player made on a scenario, with its score."""
    __tablename__ = "simulation_attempt"

    attempt_id = db.Column(
        db.Integer,
        primary_key=True
    )

    player_id = db.Column(
        db.Integer,
        db.ForeignKey("player.player_id"),
        nullable=False
    )

    scenario_id = db.Column(
        db.Integer,
        db.ForeignKey("scenario.scenario_id"),
        nullable=False
    )

    simulation_type = db.Column(
        db.String(20),
        nullable=False
    )

    player_answer = db.Column(
        db.String(20),
        nullable=False
    )

    correct = db.Column(
        db.Boolean,
        nullable=False
    )

    score = db.Column(
        db.Integer,
        default=0
    )

    difficulty = db.Column(
        db.String(20)
    )

    selected_clues = db.Column(
        db.Text
    )

    justification = db.Column(
        db.Text
    )

    clue_score = db.Column(
        db.Integer
    )

    attempted_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    # Set when this decision came from a real campaign email rather than in-app training
    campaign_recipient_id = db.Column(
        db.Integer,
        db.ForeignKey("email_campaign_recipient.campaign_recipient_id"),
        unique=True
    )