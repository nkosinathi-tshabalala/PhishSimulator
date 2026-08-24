from app.extensions import db


class UserAction(db.Model):

    __tablename__ = "user_action"

    action_id = db.Column(
        db.Integer,
        primary_key=True
    )

    attempt_id = db.Column(
        db.Integer,
        db.ForeignKey("simulation_attempt.attempt_id")
    )

    action = db.Column(
        db.String(30)
    )