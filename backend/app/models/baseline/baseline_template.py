# Database table: a named baseline assessment (a set of at least 5 questions) written for one role

from datetime import datetime

from app.extensions import db


class BaselineTemplate(db.Model):
    """A baseline assessment such as "Student · Student Money and Campus Accounts". The admin switches it on for its role."""

    __tablename__ = "baseline_template"

    template_id = db.Column(
        db.Integer,
        primary_key=True
    )

    name = db.Column(
        db.String(120),
        nullable=False
    )

    # The role it is written for ("Student", "Employee", "Other"); None = every role
    occupation = db.Column(
        db.String(20),
        nullable=True
    )

    description = db.Column(
        db.Text,
        nullable=True
    )

    # Only active assessments are offered to players
    is_active = db.Column(
        db.Boolean,
        nullable=False,
        default=False
    )

    activated_at = db.Column(
        db.DateTime,
        nullable=True
    )

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow
    )

    updated_at = db.Column(
        db.DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    questions = db.relationship(
        "BaselineQuestion",
        back_populates="template",
        order_by="BaselineQuestion.question_id"
    )

    assessments = db.relationship(
        "BaselineAssessment",
        back_populates="template"
    )

    def __repr__(self):
        """Short text shown when debugging."""
        return f"<BaselineTemplate {self.template_id} {self.name}>"
