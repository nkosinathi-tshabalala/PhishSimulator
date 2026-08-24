from datetime import datetime

from app.extensions import db


class FeedbackReport(db.Model):
    """Stores the feedback delivered for an individual simulation attempt."""

    __tablename__ = "feedback_report"

    report_id = db.Column(db.Integer, primary_key=True)
    attempt_id = db.Column(
        db.Integer, db.ForeignKey("simulation_attempt.attempt_id"), nullable=False, unique=True,
    )
    feedback = db.Column(db.Text, nullable=False)
    phishing_cues = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    attempt = db.relationship("SimulationAttempt", backref=db.backref("feedback_report", uselist=False))
