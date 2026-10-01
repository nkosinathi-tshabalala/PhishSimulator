# Database table: training scenarios (email and SMS messages)

from datetime import datetime

from app.extensions import db


class Scenario(db.Model):
    """A training message (email or SMS) with its answer, clues and review status."""
    __tablename__ = "scenario"

    # Status of the hidden scenario behind a custom campaign email: it lets the player's result count
    # as a normal decision, but it is never served in training or listed for review
    CAMPAIGN_STATUS = "CAMPAIGN"

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

    attachment = db.Column(
        db.String(255)
    )

    quality_score = db.Column(
        db.Integer
    )

    feedback = db.Column(
        db.Text
    )

    status = db.Column(
        db.String(20),
        default="DRAFT"
    )

    dataset_id = db.Column(
        db.Integer,
        db.ForeignKey("dataset.dataset_id")
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    def get_phishing_cues(self):
        """Return the stored clues as a list."""
        if not self.phishing_cues:
            return []

        return [cue.strip() for cue in self.phishing_cues.split(",") if cue.strip()]

    def set_phishing_cues(self, cues):
        """Store a list of clues as comma-separated text."""
        self.phishing_cues = ",".join(cues)