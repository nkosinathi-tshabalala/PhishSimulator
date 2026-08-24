from datetime import datetime

from app.extensions import db


class SimulationAttempt(db.Model):

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

    attempted_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )