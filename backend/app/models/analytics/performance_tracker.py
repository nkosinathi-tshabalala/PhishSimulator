# Database table: running totals of a player's attempts and score

from datetime import datetime

from app.extensions import db


class PerformanceTracker(db.Model):
    """Persisted performance totals, updated after every simulation attempt."""

    __tablename__ = "performance_tracker"

    tracker_id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(
        db.Integer, db.ForeignKey("player.player_id"), nullable=False, unique=True,
    )
    total_attempts = db.Column(db.Integer, nullable=False, default=0)
    correct_attempts = db.Column(db.Integer, nullable=False, default=0)
    total_score = db.Column(db.Integer, nullable=False, default=0)
    last_attempt_at = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    player = db.relationship("Player", backref=db.backref("performance_tracker", uselist=False))

    @property
    def accuracy(self):
        """Percentage of correct attempts."""
        return round((self.correct_attempts / self.total_attempts) * 100) if self.total_attempts else 0
