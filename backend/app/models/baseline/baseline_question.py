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

    # The baseline assessment this question belongs to (its role and on/off switch live there)
    template_id = db.Column(
        db.Integer,
        db.ForeignKey("baseline_template.template_id"),
        nullable=True
    )

    template = db.relationship(
        "BaselineTemplate",
        back_populates="questions"
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