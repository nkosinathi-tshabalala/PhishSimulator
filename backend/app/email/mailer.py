# Sends real email through Gmail, only to allow-listed addresses

import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from fnmatch import fnmatch
from ssl import create_default_context

from flask import current_app


logger = logging.getLogger(__name__)


class Mailer:
    """Sends email through Gmail SMTP, only to allow-listed addresses."""

    @staticmethod
    def is_configured():
        """True when Gmail credentials are present."""
        return bool(current_app.config.get("SMTP_USERNAME") and current_app.config.get("SMTP_PASSWORD"))

    @staticmethod
    def is_allowed(recipient):
        """True when this address is on the safety allow-list."""
        recipient = (recipient or "").strip().lower()
        patterns = current_app.config.get("CAMPAIGN_ALLOWED_RECIPIENTS", [])
        return any(fnmatch(recipient, pattern) for pattern in patterns)

    @staticmethod
    def send(recipient, subject, body, from_name=None, html_body=None, inline_images=None):
        """Send one email and return (sent, reason).
        inline_images maps a content id to PNG bytes; the HTML shows it with <img src="cid:ID">.
        Embedding (rather than linking) means it displays even though the server is not public."""
        if not Mailer.is_configured():
            return False, "Email sending is not configured. Add SMTP_USERNAME and SMTP_PASSWORD to backend/.env."
        if not Mailer.is_allowed(recipient):
            return False, f"{recipient} is not on CAMPAIGN_ALLOWED_RECIPIENTS, so nothing was sent."

        sender_address = current_app.config["SMTP_USERNAME"]
        message = EmailMessage()
        message["From"] = formataddr((from_name, sender_address)) if from_name else sender_address
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)
        if html_body:
            message.add_alternative(html_body, subtype="html")
            html_part = message.get_payload()[-1]
            for content_id, data in (inline_images or {}).items():
                html_part.add_related(data, maintype="image", subtype="png", cid=f"<{content_id}>")

        try:
            with smtplib.SMTP(current_app.config["SMTP_HOST"], current_app.config["SMTP_PORT"], timeout=20) as smtp:
                smtp.starttls(context=create_default_context())
                smtp.login(sender_address, current_app.config["SMTP_PASSWORD"])
                smtp.send_message(message)
        except smtplib.SMTPAuthenticationError as error:
            logger.warning("Gmail rejected the login for %s: %s", sender_address, error)
            return False, (
                f"Gmail rejected the sign-in for {sender_address}. Generate a fresh app password at "
                "https://myaccount.google.com/apppasswords (2-Step Verification must be on) and put it in "
                "SMTP_PASSWORD in backend/.env."
            )
        except smtplib.SMTPRecipientsRefused:
            logger.warning("Gmail refused the address %s", recipient)
            return False, f"Gmail would not accept the address {recipient}."
        except (OSError, smtplib.SMTPException) as error:
            logger.warning("Email to %s could not be sent: %s", recipient, error)
            return False, f"The mail server could not be reached ({type(error).__name__}). Check SMTP_HOST and SMTP_PORT."

        return True, "Email sent."
