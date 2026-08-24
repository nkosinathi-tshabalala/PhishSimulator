from app.extensions import db


class BaselineResponse(db.Model):
    """Stores a player's response to a baseline assessment question."""

    __tablename__ = "baseline_response"

    # Primary Key
    response_id = db.Column(
        db.Integer,
        primary_key=True
    )

    # Foreign Keys
    assessment_id = db.Column(
        db.Integer,
        db.ForeignKey("baseline_assessment.assessment_id"),
        nullable=False
    )

    question_id = db.Column(
        db.Integer,
        db.ForeignKey("baseline_question.question_id"),
        nullable=False
    )

    # Player Response
    answer_text = db.Column(
        db.Text,
        nullable=False
    )

    # Evaluation Results
    matched_keywords = db.Column(
        db.Text,
        nullable=True
    )

    score = db.Column(
        db.Integer,
        default=0,
        nullable=False
    )

    passed = db.Column(
        db.Boolean,
        default=False,
        nullable=False
    )

    # Relationships
    assessment = db.relationship(
        "BaselineAssessment",
        back_populates="responses"
    )

    question = db.relationship(
        "BaselineQuestion",
        back_populates="responses"
    )

    def get_matched_keywords(self):
        """
        Returns the matched keywords as a list.

        Example:
        'sender,urgent,grammar'

        becomes

        ['sender', 'urgent', 'grammar']
        """

        if not self.matched_keywords:
            return []

        return [
            keyword.strip()
            for keyword in self.matched_keywords.split(",")
            if keyword.strip()
        ]

    def __repr__(self):
        return (
            f"<BaselineResponse "
            f"{self.response_id}>"
        )