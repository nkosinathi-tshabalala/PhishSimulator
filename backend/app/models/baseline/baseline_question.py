# Database table: baseline quiz questions and their marking guide

from app.extensions import db


class BaselineQuestion(db.Model):
    """Stores a baseline assessment question."""

    __tablename__ = "baseline_question"

    question_id = db.Column(
        db.Integer,
        primary_key=True
    )

    question_text = db.Column(
        db.Text,
        nullable=False
    )

    instruction = db.Column(
        db.Text,
        nullable=False
    )

    expected_keywords = db.Column(
        db.Text,
        nullable=False
    )

    example_answer = db.Column(
        db.Text,
        nullable=False
    )

    feedback = db.Column(
        db.Text,
        nullable=False
    )

    confidence_threshold = db.Column(
        db.Integer,
        nullable=False,
        default=2
    )

    # The role this question is written for ("Student", "Employee", "Other"); None = any role
    occupation = db.Column(
        db.String(20),
        nullable=True
    )

    # Only active questions are given to players
    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=True
    )

    responses = db.relationship(
        "BaselineResponse",
        back_populates="question",
        cascade="all, delete-orphan"
    )

    def get_expected_keywords(self):
        """Return the expected keywords as a list."""

        return [
            keyword.strip()
            for keyword in self.expected_keywords.split(",")
            if keyword.strip()
        ]

    def __repr__(self):
        """Short text shown when debugging."""
        return (
            f"<BaselineQuestion "
            f"{self.question_id}>"
        )