from datetime import datetime
import secrets

from app.email.email_dispatcher import EmailDispatcher
from app.enums.delivery_status import DeliveryStatus
from app.enums.occupation import Occupation
from app.models.authentication import Player
from app.models.authentication.user_profile import UserProfile
from app.models.email import EmailCampaign, EmailCampaignRecipient
from app.models.scenario import Scenario
from app.extensions import db


class EmailService:
	"""Provides email simulation dispatch context and delivery integration."""

	@staticmethod
	def get_dispatcher_context():
		scenarios = Scenario.query.filter_by(
			simulation_type="EMAIL",
			status="ACTIVE",
		).order_by(Scenario.created_at.desc()).all()

		campaigns = EmailCampaign.query.order_by(
			EmailCampaign.created_at.desc()
		).limit(10).all()
		all_recipients = [
			recipient for campaign in campaigns for recipient in campaign.recipients
		]
		sent = sum(
			recipient.delivery_status == DeliveryStatus.SENT.value
			for recipient in all_recipients
		)
		clicked = sum(recipient.clicked_at is not None for recipient in all_recipients)
		reported = sum(recipient.reported_at is not None for recipient in all_recipients)

		return {
			"delivery_configured": EmailDispatcher.is_configured(),
			"smtp_host": "Configured" if EmailDispatcher.is_configured() else "Not configured",
			"recipient_count": Player.query.count(),
			"target_groups": [occupation.value for occupation in Occupation],
			"scenarios": [{
				"scenario_id": scenario.scenario_id,
				"title": scenario.title,
				"sender": scenario.sender,
				"subject": scenario.subject,
				"message": scenario.message,
				"category": scenario.category,
				"difficulty": scenario.difficulty,
			} for scenario in scenarios],
			"overview": {
				"campaigns": len(campaigns),
				"sent": sent,
				"clicked": clicked,
				"reported": reported,
				"click_rate": round((clicked / sent) * 100) if sent else 0,
				"report_rate": round((reported / sent) * 100) if sent else 0,
			},
			"campaigns": [EmailService._serialize_campaign(campaign) for campaign in campaigns],
		}

	@staticmethod
	def create_campaign(data, created_by_user_id):
		scenario = Scenario.query.filter_by(
			scenario_id=data.get("scenario_id"),
			simulation_type="EMAIL",
			status="ACTIVE",
		).first()

		if not scenario:
			return False, "Choose an active email scenario.", None

		name = str(data.get("name") or f"{scenario.title} campaign").strip()
		if not name or len(name) > 150:
			return False, "Campaign name must contain between 1 and 150 characters.", None

		target_occupation = str(data.get("target_occupation") or "").strip()
		valid_targets = {occupation.value for occupation in Occupation}
		if target_occupation and target_occupation not in valid_targets:
			return False, "Choose a valid target group.", None

		recipients_query = Player.query
		if target_occupation:
			recipients_query = recipients_query.join(UserProfile).filter(
				UserProfile.occupation == Occupation(target_occupation)
			)
		recipients = recipients_query.all()
		if not recipients:
			return False, "No player recipients match the selected target group.", None

		campaign = EmailCampaign(
			scenario_id=scenario.scenario_id,
			created_by_user_id=created_by_user_id,
			name=name,
			target_occupation=target_occupation or None,
		)
		db.session.add(campaign)
		db.session.flush()

		for player in recipients:
			db.session.add(EmailCampaignRecipient(
				campaign_id=campaign.campaign_id,
				player_id=player.player_id,
				recipient_email=player.user.email,
				tracking_token=secrets.token_urlsafe(32),
			))

		db.session.commit()
		return True, "Campaign draft created.", EmailService._serialize_campaign(campaign)

	@staticmethod
	def launch_campaign(campaign_id):
		campaign = db.session.get(EmailCampaign, campaign_id)
		if not campaign:
			return False, "Campaign not found.", None
		if campaign.status != "DRAFT":
			return False, "Only draft campaigns can be launched.", None
		if not EmailDispatcher.is_configured():
			return False, "Email delivery is not configured. Add SMTP_* values to backend/.env.", None

		for recipient in campaign.recipients:
			tracking_url = (
				f"{EmailService._backend_url()}/api/email/click/"
				f"{recipient.tracking_token}"
			)
			report_url = (
				f"{EmailService._backend_url()}/api/email/report/"
				f"{recipient.tracking_token}"
			)
			status, _ = EmailDispatcher.send_campaign_email(
				recipient.recipient_email,
				campaign.scenario,
				tracking_url,
				report_url,
			)
			recipient.delivery_status = status.value
			if status == DeliveryStatus.SENT:
				recipient.sent_at = datetime.utcnow()

		sent_count = sum(
			recipient.delivery_status == DeliveryStatus.SENT.value
			for recipient in campaign.recipients
		)
		campaign.status = "LAUNCHED" if sent_count else "FAILED"
		campaign.launched_at = datetime.utcnow()
		db.session.commit()
		return True, "Campaign launch completed.", EmailService._serialize_campaign(campaign)

	@staticmethod
	def get_campaign_report(campaign_id):
		campaign = db.session.get(EmailCampaign, campaign_id)
		return EmailService._serialize_campaign(campaign, include_recipients=True) if campaign else None

	@staticmethod
	def record_click(tracking_token):
		recipient = EmailCampaignRecipient.query.filter_by(
			tracking_token=tracking_token
		).first()
		if not recipient:
			return None

		recipient.click_count += 1
		if recipient.clicked_at is None:
			recipient.clicked_at = datetime.utcnow()
		db.session.commit()
		return recipient

	@staticmethod
	def record_report(tracking_token):
		recipient = EmailCampaignRecipient.query.filter_by(
			tracking_token=tracking_token
		).first()
		if not recipient:
			return None

		if recipient.reported_at is None:
			recipient.reported_at = datetime.utcnow()
			db.session.commit()
		return recipient

	@staticmethod
	def _serialize_campaign(campaign, include_recipients=False):
		recipients = campaign.recipients
		total_recipients = len(recipients)
		sent = sum(recipient.delivery_status == DeliveryStatus.SENT.value for recipient in recipients)
		failed = sum(recipient.delivery_status == DeliveryStatus.FAILED.value for recipient in recipients)
		clicked = sum(recipient.clicked_at is not None for recipient in recipients)
		reported = sum(recipient.reported_at is not None for recipient in recipients)
		data = {
			"campaign_id": campaign.campaign_id,
			"name": campaign.name,
			"status": campaign.status,
			"scenario_title": campaign.scenario.title,
			"target_group": campaign.target_occupation or "All players",
			"created_at": campaign.created_at.isoformat(),
			"launched_at": campaign.launched_at.isoformat() if campaign.launched_at else None,
			"recipients": total_recipients,
			"sent": sent,
			"failed": failed,
			"clicked": clicked,
			"click_rate": round((clicked / sent) * 100) if sent else 0,
			"reported": reported,
			"report_rate": round((reported / sent) * 100) if sent else 0,
		}
		if include_recipients:
			data["recipient_details"] = [{
				"email": recipient.recipient_email,
				"delivery_status": recipient.delivery_status,
				"sent_at": recipient.sent_at.isoformat() if recipient.sent_at else None,
				"clicked_at": recipient.clicked_at.isoformat() if recipient.clicked_at else None,
				"click_count": recipient.click_count,
				"reported_at": recipient.reported_at.isoformat() if recipient.reported_at else None,
			} for recipient in recipients]
		return data

	@staticmethod
	def _backend_url():
		from flask import current_app
		return current_app.config["BACKEND_URL"].rstrip("/")
