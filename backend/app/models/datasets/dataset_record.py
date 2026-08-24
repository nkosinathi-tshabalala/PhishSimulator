from app.extensions import db


class DatasetRecord(db.Model):
    """
    Stores every email or SMS imported
    from a dataset.
    """

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
    # EMAIL / SMS

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
    # phishing / legitimate

    processed = db.Column(
        db.Boolean,
        default=False
    )

    dataset = db.relationship(
        "Dataset",
        back_populates="records"
    )

    def __repr__(self):
        return f"<DatasetRecord {self.record_id}>"