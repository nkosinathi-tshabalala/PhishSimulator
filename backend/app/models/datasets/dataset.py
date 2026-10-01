# Database table: uploaded datasets

from datetime import datetime

from app.extensions import db


class Dataset(db.Model):
    """
    Stores uploaded phishing datasets.
    """

    __tablename__ = "dataset"

    dataset_id = db.Column(
        db.Integer,
        primary_key=True
    )

    name = db.Column(
        db.String(255),
        nullable=False
    )

    dataset_type = db.Column(
        db.String(20),
        nullable=False
    )

    file_format = db.Column(
        db.String(10),
        nullable=False
    )

    filename = db.Column(
        db.String(255),
        nullable=False
    )

    record_count = db.Column(
        db.Integer,
        default=0
    )

    uploaded_at = db.Column(
        db.DateTime,
        default=datetime.utcnow
    )

    status = db.Column(
        db.String(30),
        default="UPLOADED"
    )

    quality_report = db.Column(
        db.Text
    )

    records = db.relationship(
        "DatasetRecord",
        back_populates="dataset",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        """Short text shown when debugging."""
        return f"<Dataset {self.name}>"