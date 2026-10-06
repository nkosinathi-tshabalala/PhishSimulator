# Database tables: email campaigns and their recipients

from datetime import datetime

from app.extensions import db
from app.utils.labels import message_label


class EmailCampaign(db.Model):
    """An authorised phishing-awareness email campaign sent to the admin's own inboxes."""

    __tablename__ = "email_campaign"

    campaign_id = db.Column(db.Integer, primary_key=True)
    # The scenario the email came from; empty for a custom email written by the admin
    scenario_id = db.Column(db.Integer, db.ForeignKey("scenario.scenario_id"), nullable=True)
    created_by_user_id = db.Column(db.Integer, db.ForeignKey("user.user_id"), nullable=False)
    name = db.Column(db.String(150), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="DRAFT")
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    launched_at = db.Column(db.DateTime)

    # A copy of exactly what is sent, so the details stay right even if the scenario changes later
    sender = db.Column(db.String(255))
    subject = db.Column(db.String(255))
    message = db.Column(db.Text)
    is_phishing = db.Column(db.Boolean, nullable=False, default=True)
    phishing_cues = db.Column(db.Text)
    # File name of a look-alike attachment shown in the email. No real file is sent: opening it is tracked
    attachment = db.Column(db.String(255))

    scenario = db.relationship("Scenario")
    recipients = db.relationship(
        "EmailCampaignRecipient",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )

    def get_phishing_cues(self):
        """The warning signs as a list (stored comma-separated, like Scenario)."""
        return [cue.strip() for cue in (self.phishing_cues or "").split(",") if cue.strip()]

    @property
    def title(self):
        """The email's name as the recipient saw it: its subject, or the first words of the message.
        Never the scenario's admin title, which may say it is training."""
        return message_label(self.subject, self.message) or "Email"


class EmailCampaignRecipient(db.Model):
    """One recipient of a campaign, with what they did: opened, clicked, reported."""

    __tablename__ = "email_campaign_recipient"

    campaign_recipient_id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey("email_campaign.campaign_id"), nullable=False)
    recipient_email = db.Column(db.String(255), nullable=False)
    tracking_token = db.Column(db.String(128), nullable=False, unique=True)

    delivery_status = db.Column(db.String(20), nullable=False, default="PENDING")
    sent_at = db.Column(db.DateTime)
    opened_at = db.Column(db.DateTime)
    open_count = db.Column(db.Integer, nullable=False, default=0)
    clicked_at = db.Column(db.DateTime)
    click_count = db.Column(db.Integer, nullable=False, default=0)
    # LINK or ATTACHMENT: which lure they opened
    clicked_kind = db.Column(db.String(20))
    reported_at = db.Column(db.DateTime)

    # The result once it is final (first action, or none within the window). It is locked after that:
    # the outcome, the XP it earned or cost, when the result email went out, and when they read the feedback
    settled_outcome = db.Column(db.String(20))
    xp_awarded = db.Column(db.Integer, nullable=False, default=0)
    notified_at = db.Column(db.DateTime)
    feedback_seen_at = db.Column(db.DateTime)

    campaign = db.relationship("EmailCampaign", back_populates="recipients")
