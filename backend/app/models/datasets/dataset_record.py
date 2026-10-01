# Database table: rows imported from a dataset

from app.extensions import db


class DatasetRecord(db.Model):
    """One email or SMS row imported from a dataset."""

    __tablename__ = "dataset_record"

    record_id = db.Column(
        db.Integer,
        primary_key=True
    )

    dataset_id = db.Column(
        db.Integer,
        db.ForeignKey("dataset.dataset_id"),
        nullable=False
    )

    message_type = db.Column(
        db.String(20),
        nullable=False
    )

    category = db.Column(
        db.String(100)
    )

    difficulty = db.Column(
        db.String(20),
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

    label = db.Column(
        db.String(30)
    )

    processed = db.Column(
        db.Boolean,
        default=False
    )

    dataset = db.relationship(
        "Dataset",
        back_populates="records"
    )

    def __repr__(self):
        """Short text shown when debugging."""
        return f"<DatasetRecord {self.record_id}>"