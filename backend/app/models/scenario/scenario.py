from datetime import datetime

from app.extensions import db


class Scenario(db.Model):

    __tablename__ = "scenario"

    scenario_id = db.Column(
        db.Integer,
        primary_key=True
    )

    title = db.Column(
        db.String(255),
        nullable=False
    )

    simulation_type = db.Column(
        db.String(20),
        nullable=False
    )
    # EMAIL / SMS

    category = db.Column(
        db.String(100),
        nullable=False
    )

    difficulty = db.Column(
        db.String(20),
        nullable=False,
        default="Easy"
    )

    sender = db.Column(
        db.String(255)
    )

    subject = db.Column(
        db.String(255)
    )

    message = db.Column(
        db.Text,
        nullable=False
    )

    correct_answer = db.Column(
        db.String(50),
        nullable=False
    )

    phishing_cues = db.Column(
        db.Text
    )

    feedback = db.Column(
        db.Text
    )

    status = db.Column(
        db.String(20),
        default="ACTIVE"
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    def get_phishing_cues(self):

        if not self.phishing_cues:
            return []

        return self.phishing_cues.split(",")

    def set_phishing_cues(self, cues):

        self.phishing_cues = ",".join(cues)