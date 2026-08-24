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
    # EMAIL or SMS

    file_format = db.Column(
        db.String(10),
        nullable=False
    )
    # CSV or JSON

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

    records = db.relationship(
        "DatasetRecord",
        back_populates="dataset",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Dataset {self.name}>"