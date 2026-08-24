from datetime import datetime

from app.extensions import db


class EmailCampaign(db.Model):
    """An authorized security-awareness email delivery campaign."""

    __tablename__ = "email_campaign"

    campaign_id = db.Column(db.Integer, primary_key=True)
    scenario_id = db.Column(
        db.Integer,
        db.ForeignKey("scenario.scenario_id"),
        nullable=False,
    )
    created_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey("user.user_id"),
        nullable=False,
    )
    name = db.Column(db.String(150), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="DRAFT")
    target_occupation = db.Column(db.String(30))
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    launched_at = db.Column(db.DateTime)

    scenario = db.relationship("Scenario")
    recipients = db.relationship(
        "EmailCampaignRecipient",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )


class EmailCampaignRecipient(db.Model):
    """Delivery and click telemetry for one approved campaign recipient."""

    __tablename__ = "email_campaign_recipient"

    campaign_recipient_id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(
        db.Integer,
        db.ForeignKey("email_campaign.campaign_id"),
        nullable=False,
    )
    player_id = db.Column(db.Integer, db.ForeignKey("player.player_id"), nullable=False)
    recipient_email = db.Column(db.String(255), nullable=False)
    tracking_token = db.Column(db.String(128), nullable=False, unique=True)
    delivery_status = db.Column(db.String(20), nullable=False, default="PENDING")
    sent_at = db.Column(db.DateTime)
    clicked_at = db.Column(db.DateTime)
    click_count = db.Column(db.Integer, nullable=False, default=0)
    reported_at = db.Column(db.DateTime)

    campaign = db.relationship("EmailCampaign", back_populates="recipients")
    player = db.relationship("Player")