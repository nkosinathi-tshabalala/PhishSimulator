import logging
import smtplib
from email.message import EmailMessage
from ssl import create_default_context

from flask import current_app

from app.enums.delivery_status import DeliveryStatus


logger = logging.getLogger(__name__)


class EmailDispatcher:
	"""Boundary for a future SMTP or provider-backed mail integration."""

	@staticmethod
	def is_configured():
		required_settings = (
			"SMTP_HOST",
			"SMTP_USERNAME",
			"SMTP_PASSWORD",
			"SMTP_FROM_EMAIL",
		)
		return all(current_app.config.get(setting) for setting in required_settings)

	@staticmethod
	def send_password_reset(email, reset_url):
		if not EmailDispatcher.is_configured():
			logger.info("Password reset delivery pending SMTP configuration for %s", email)
			return DeliveryStatus.NOT_CONFIGURED

		# SMTP/provider delivery belongs here after credentials are configured.
		logger.info("Password reset delivery placeholder invoked for %s", email)
		return DeliveryStatus.PENDING

	@staticmethod
	def dispatch_campaign(scenario, recipients):
		if not EmailDispatcher.is_configured():
			return DeliveryStatus.NOT_CONFIGURED, "Email delivery is not configured. Add SMTP_* values to backend/.env."

		# Deliberately left as the provider integration boundary; do not send mail
		# until the organization supplies authorized SMTP/provider credentials.
		return DeliveryStatus.PENDING, "SMTP delivery placeholder is ready but no provider integration is configured."

	@staticmethod
	def send_campaign_email(recipient_email, scenario, tracking_url, report_url):
		"""Send one authorized training email with a recipient-specific tracking link."""

		if not EmailDispatcher.is_configured():
			return DeliveryStatus.NOT_CONFIGURED, "Email delivery is not configured."

		message = EmailMessage()
		message["From"] = current_app.config["SMTP_FROM_EMAIL"]
		message["To"] = recipient_email
		message["Subject"] = scenario.subject or scenario.title
		message.set_content(
			f"{scenario.message}\n\n"
			f"Open training message: {tracking_url}\n\n"
			f"Report this email: {report_url}\n\n"
			"This is an authorized phishing-awareness training campaign."
		)

		try:
			with smtplib.SMTP(
				current_app.config["SMTP_HOST"],
				int(current_app.config["SMTP_PORT"]),
				timeout=15,
			) as smtp:
				smtp.starttls(context=create_default_context())
				smtp.login(
					current_app.config["SMTP_USERNAME"],
					current_app.config["SMTP_PASSWORD"],
				)
				smtp.send_message(message)
		except (OSError, smtplib.SMTPException, ValueError) as error:
			logger.warning("Campaign email delivery failed for %s: %s", recipient_email, error)
			return DeliveryStatus.FAILED, "Provider rejected or could not deliver the email."

		return DeliveryStatus.SENT, "Email sent."
