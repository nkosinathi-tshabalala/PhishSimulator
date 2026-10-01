# Database table: training sessions

from datetime import datetime

from app.extensions import db


class SimulationSession(db.Model):
    """A training session that groups a player's attempts."""
    __tablename__ = "simulation_session"

    session_id = db.Column(
        db.Integer,
        primary_key=True
    )

    player_id = db.Column(
        db.Integer,
        db.ForeignKey("player.player_id"),
        nullable=False
    )

    simulation_type = db.Column(
        db.String(20),
        nullable=False
    )

    started_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    completed_at = db.Column(
        db.DateTime
    )

    total_score = db.Column(
        db.Integer,
        default=0
    )

    total_attempts = db.Column(
        db.Integer,
        default=0
    )