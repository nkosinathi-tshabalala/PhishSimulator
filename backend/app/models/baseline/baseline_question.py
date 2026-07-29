from app.extensions import db


class BaselineQuestion(db.Model):
    """Stores a baseline assessment question."""

    __tablename__ = "baseline_question"

    # Primary Key
    question_id = db.Column(
        db.Integer,
        primary_key=True
    )

    # Question Details
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

    # Relationships
    responses = db.relationship(
        "BaselineResponse",
        back_populates="question",
        cascade="all, delete-orphan"
    )

    def get_expected_keywords(self):
        """
        Returns the expected keywords as a list.

        Example:
        "urgent,password,verify"becomes ["urgent", "password", "verify"]
        """

        return [
            keyword.strip()
            for keyword in self.expected_keywords.split(",")
            if keyword.strip()
        ]

    def __repr__(self):
        return (
            f"<BaselineQuestion "
            f"{self.question_id}>"
        )