# Email campaigns (phishing or genuine), sent only to the author's own inboxes

import html
import logging
import re
import secrets
import threading
import time
from datetime import datetime, timedelta
from urllib.parse import quote

from flask import current_app
from sqlalchemy import func, text, update

from app.email.mailer import Mailer
from app.email.templates import result_email
from app.extensions import db
from app.models.authentication import User, UserProfile
from app.models.authentication.player import Player
from app.models.analytics import PerformanceTracker
from app.models.email import EmailCampaign, EmailCampaignRecipient
from app.models.scenario import Scenario
from app.models.simulation import SimulationAttempt, UserAction
from app.services.scenario_service import ScenarioService
from app.utils.labels import message_label

TRACKING_PIXEL = bytes.fromhex(
    "47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b"
)
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
# Shown on every campaign email, phishing or genuine, like a mail system's report button.
# It makes no claim about the email, so it never contradicts a genuine one or gives a phish away.
REPORT_NOTICE = "Suspicious email? Report it to IT security."
LINK_PATTERN = re.compile(r"\[([^\]\n]+)\]\((?:https?://|www\.)[^\s)]+\)|(?:https?://|www\.)[^\s<>\"']+")
# A believable file name for the look-alike attachment (no real file is ever sent or downloaded)
ATTACHMENT_PATTERN = re.compile(r"^[\w .()'&-]{1,120}\.(pdf|docx?|xlsx?|pptx?|zip|html?|csv|txt|jpe?g|png)$", re.IGNORECASE)
ATTACHMENT_PRESETS = [
    "Invoice_INV-20931.pdf", "Payslip_September_2026.pdf", "Bank_Statement_Q3.pdf", "Delivery_Label_PUDO.pdf",
    "Updated_Leave_Policy.docx", "Salary_Adjustments_2026.xlsx", "Tax_Refund_Form.html", "Scanned_Documents.zip",
]

FINAL_OUTCOMES = ("CLICKED", "REPORTED", "IGNORED")
# XP for each final outcome, by whether the email was phishing. Like training, a mistake earns 0 XP:
# XP measures effort and never goes down. Mistakes still count against skill (accuracy and rank).
POINTS = {
    (True, "REPORTED"): 30,    # spotted the phish and warned IT
    (True, "IGNORED"): 10,     # did not fall for it
    (True, "CLICKED"): 0,      # fell for it: no XP, and it counts as missed phishing
    (False, "CLICKED"): 10,    # trusted a genuine email
    (False, "IGNORED"): 0,     # no harm done
    (False, "REPORTED"): 0,    # false alarm: no XP, and it counts as a wrong decision
}
# Each final result as a decision: (player_answer, correct). Ignoring is not a "report" or "safe" call,
# so it gets its own answer; it counts as correct because nothing bad happened.
DECISIONS = {
    (True, "CLICKED"): ("SAFE", False),     # trusted a phish: counts as missed phishing
    (True, "REPORTED"): ("REPORT", True),
    (True, "IGNORED"): ("IGNORED", True),
    (False, "CLICKED"): ("SAFE", True),
    (False, "REPORTED"): ("REPORT", False),  # false alarm
    (False, "IGNORED"): ("IGNORED", True),
}
MAX_MESSAGE_LENGTH = 5000
SWEEP_LOCK_KEY = 734001  # Postgres advisory lock, so only one server process sweeps at a time
logger = logging.getLogger(__name__)
MAX_CUES = 10


class CampaignService:
    """Creates, sends and tracks email campaigns, and turns each result into a player notification."""

    # ---------- admin: build and send ----------

    @staticmethod
    def get_context():
        """Everything the campaign page needs to load."""
        scenarios = Scenario.query.filter_by(
            simulation_type="EMAIL", status="ACTIVE",
        ).order_by(Scenario.created_at.desc()).all()
        campaigns = EmailCampaign.query.order_by(EmailCampaign.created_at.desc()).limit(30).all()

        return {
            "sending_enabled": Mailer.is_configured(),
            "allowed_recipients": current_allowed(),
            "ignore_minutes": current_app.config["CAMPAIGN_IGNORE_MINUTES"],
            "attachment_presets": ATTACHMENT_PRESETS,
            "points": {f"{'phishing' if phishing else 'genuine'}_{outcome.lower()}": xp
                       for (phishing, outcome), xp in POINTS.items()},
            "players": CampaignService.list_players(),
            "scenarios": [{
                "scenario_id": scenario.scenario_id,
                "title": ScenarioService.display_title(scenario),
                "sender": scenario.sender,
                "subject": scenario.subject,
                "message": scenario.message,
                "attachment": scenario.attachment,
                "category": scenario.category,
                "difficulty": scenario.difficulty,
                "is_phishing": (scenario.correct_answer or "").upper() == "REPORT",
                "cues": scenario.get_phishing_cues(),
            } for scenario in scenarios],
            "campaigns": [CampaignService._summary(campaign) for campaign in campaigns],
        }

    @staticmethod
    def list_players():
        """Every registered player, with whether they can be emailed: they must have agreed to campaign
        emails, and their address must be on the safety allow-list."""
        players = Player.query.order_by(Player.full_name).all()
        listed = []
        for player in players:
            consented = bool(player.profile and player.profile.campaign_consent)
            allowed = Mailer.is_allowed(player.user.email)
            listed.append({
                "player_id": player.player_id,
                "full_name": player.full_name,
                "email": player.user.email,
                "occupation": player.profile.occupation.value if player.profile else "Other",
                "consented": consented,
                "allowed": allowed,
                # Everyone is listed, but only consenting, allow-listed players can be picked
                "selectable": consented and allowed,
                "blocked_reason": None if consented and allowed else (
                    "Has not agreed to campaign emails" if not consented else "Not on the safety allow-list"
                ),
            })
        return listed

    @staticmethod
    def _without_consent(addresses):
        """The addresses that may not receive a campaign: no player account, or no consent given."""
        consenting = {
            email.lower() for (email,) in db.session.query(User.email)
            .join(Player, Player.user_id == User.user_id)
            .join(UserProfile, UserProfile.player_id == Player.player_id)
            .filter(func.lower(User.email).in_([address.lower() for address in addresses]),
                    UserProfile.campaign_consent.is_(True))
        }
        return [address for address in addresses if address.lower() not in consenting]

    @staticmethod
    def create_campaign(data, created_by_user_id):
        """Create a draft from an active email scenario, or from a custom email the admin wrote."""
        if data.get("custom"):
            valid, message, email = CampaignService._custom_email(data["custom"])
            if not valid:
                return False, message, None
        else:
            scenario = Scenario.query.filter_by(
                scenario_id=data.get("scenario_id"), simulation_type="EMAIL", status="ACTIVE",
            ).first()
            if not scenario:
                return False, "Choose an active email scenario, or write a custom email.", None
            email = {
                "scenario_id": scenario.scenario_id,
                "sender": scenario.sender,
                # A real inbox must never see the admin's title (it may say "training")
                "subject": scenario.subject or message_label(None, scenario.message),
                "message": scenario.message,
                "is_phishing": (scenario.correct_answer or "").upper() == "REPORT",
                "phishing_cues": scenario.phishing_cues,
                "attachment": scenario.attachment,
            }

        default_name = f"{email['subject']} campaign"
        name = str(data.get("name") or default_name).strip()[:150]
        if not name:
            return False, "Campaign name must be between 1 and 150 characters.", None

        recipients = CampaignService._clean_recipients(data.get("recipients"))
        if not recipients:
            return False, "Add at least one valid recipient email address.", None

        blocked = [address for address in recipients if not Mailer.is_allowed(address)]
        if blocked:
            return False, (
                f"These addresses are not on the safety allow-list: {', '.join(blocked)}. "
                "Campaigns can only be sent to your own approved inboxes."
            ), None

        no_consent = CampaignService._without_consent(recipients)
        if no_consent:
            return False, (
                f"These recipients have not agreed to campaign emails: {', '.join(no_consent)}. "
                "Only registered players who opted in (on registration or in their profile) can be added."
            ), None

        campaign = EmailCampaign(created_by_user_id=created_by_user_id, name=name, **email)
        db.session.add(campaign)
        db.session.flush()
        for address in recipients:
            db.session.add(EmailCampaignRecipient(
                campaign_id=campaign.campaign_id,
                recipient_email=address,
                tracking_token=secrets.token_urlsafe(32),
            ))
        db.session.commit()
        return True, f"Draft created for {len(recipients)} recipient(s).", CampaignService._summary(campaign)

    @staticmethod
    def _custom_email(custom):
        """Check an admin-written email. Returns (valid, message, email fields)."""
        if not isinstance(custom, dict):
            return False, "The custom email is missing.", None
        sender = str(custom.get("sender") or "").strip()
        subject = str(custom.get("subject") or "").strip()
        message = str(custom.get("message") or "").strip()
        if not sender or len(sender) > 255:
            return False, "Add who the email is from (up to 255 characters).", None
        if not subject or len(subject) > 255:
            return False, "Add a subject (up to 255 characters).", None
        if not message or len(message) > MAX_MESSAGE_LENGTH:
            return False, f"Write the email body (up to {MAX_MESSAGE_LENGTH} characters).", None

        is_phishing = bool(custom.get("is_phishing", True))
        raw_cues = custom.get("cues") or []
        if isinstance(raw_cues, str):
            raw_cues = re.split(r"[\n,]+", raw_cues)
        # Cues are stored comma-separated (like Scenario), so commas inside a cue are dropped
        cues = [str(cue).replace(",", " ").strip()[:120] for cue in raw_cues if str(cue).strip()][:MAX_CUES]

        attachment = str(custom.get("attachment") or "").strip()
        if attachment and not ATTACHMENT_PATTERN.match(attachment):
            return False, "The attachment name must look like a file, e.g. Invoice_2026.pdf.", None

        # The email must have something to click: a link in the body, or an attachment
        if not attachment and not LINK_PATTERN.search(message):
            return False, "Add a link in the body (e.g. [Verify](https://...)) or an attachment to track.", None

        return True, "", {
            "scenario_id": None,
            "sender": sender,
            "subject": subject,
            "message": message,
            "is_phishing": is_phishing,
            "phishing_cues": ",".join(cues) if is_phishing else None,
            "attachment": attachment or None,
        }

    @staticmethod
    def launch_campaign(campaign_id):
        """Send the campaign email to every recipient."""
        campaign = db.session.get(EmailCampaign, campaign_id)
        if not campaign:
            return False, "Campaign not found.", None
        if campaign.status != "DRAFT":
            return False, "This campaign has already been launched.", None
        if not Mailer.is_configured():
            return False, "Email sending is not configured. Add SMTP_USERNAME and SMTP_PASSWORD to backend/.env.", None

        failures = []
        for recipient in campaign.recipients:
            reason = CampaignService._send_to(campaign, recipient)
            if reason and reason not in failures:
                failures.append(reason)

        sent = sum(recipient.delivery_status == "SENT" for recipient in campaign.recipients)
        campaign.status = "LAUNCHED" if sent else "FAILED"
        campaign.launched_at = datetime.utcnow()
        db.session.commit()

        message = f"Sent to {sent} of {len(campaign.recipients)} recipient(s)."
        if failures:
            # The real SMTP reason, so the page can say why rather than just "FAILED"
            message = f"{message} {' '.join(failures)}"
        return True, message, CampaignService._summary(campaign)

    @staticmethod
    def delete_campaign(campaign_id):
        """Delete a campaign and its recipients. Launched campaigns hold real results, so they stay."""
        campaign = db.session.get(EmailCampaign, campaign_id)
        if not campaign:
            return False, "Campaign not found.", None
        if campaign.status == "LAUNCHED":
            return False, "Launched campaigns hold real results and are kept as a record. They cannot be deleted.", None

        db.session.delete(campaign)
        db.session.commit()
        return True, f'Deleted "{campaign.name}".', None

    @staticmethod
    def _send_to(campaign, recipient):
        """Send one recipient their tracking email and record the outcome. Returns a failure reason or None."""
        # Consent is checked again at send time: a player may have withdrawn it after the draft was made
        if CampaignService._without_consent([recipient.recipient_email]):
            recipient.delivery_status = "NO_CONSENT"
            return f"{recipient.recipient_email} withdrew consent to campaign emails, so nothing was sent to them."

        base = f"{_public_backend_url()}/api/campaigns"
        token = recipient.tracking_token
        urls = {
            "link": f"{base}/click/{token}",
            "attachment": f"{base}/click/{token}?kind=attachment",
            "pixel": f"{base}/open/{token}",
            "report": f"{base}/report/{token}",
        }

        text_lines = [campaign.message, "", f"Open: {urls['link']}"]
        if campaign.attachment:
            text_lines += ["", f"Attachment {campaign.attachment}: {urls['attachment']}"]
        text_lines += ["", f"{REPORT_NOTICE} {urls['report']}"]
        html_body = CampaignService._html_email(campaign.message, campaign.attachment, urls)

        sent, reason = Mailer.send(
            recipient.recipient_email,
            campaign.subject or message_label(None, campaign.message),
            "\n".join(text_lines),
            from_name=_sender_display_name(campaign.sender),
            html_body=html_body,
        )
        if sent:
            recipient.delivery_status = "SENT"
            recipient.sent_at = datetime.utcnow()
            return None

        recipient.delivery_status = "BLOCKED" if not Mailer.is_allowed(recipient.recipient_email) else "FAILED"
        return reason

    @staticmethod
    def _html_email(message, attachment, urls):
        """Build the HTML email: links go through the tracker, a pixel records the open,
        an optional look-alike attachment card is clickable, and a neutral footer offers a report link."""
        pieces = []
        last = 0
        for match in LINK_PATTERN.finditer(message):
            pieces.append(html.escape(message[last:match.start()]))
            label = match.group(1) or match.group(0)
            pieces.append(f'<a href="{urls["link"]}">{html.escape(label)}</a>')
            last = match.end()
        pieces.append(html.escape(message[last:]))
        body = "".join(pieces).replace("\n", "<br>")

        attachment_card = _attachment_card(attachment, urls["attachment"]) if attachment else ""
        return (
            f'<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f2937">{body}</div>'
            f'{attachment_card}'
            '<div style="margin-top:24px;padding:8px 0;border-top:1px solid #e5e7eb;'
            'font-family:Arial,sans-serif;font-size:11px;color:#6b7280">'
            f'{html.escape(REPORT_NOTICE)} <a href="{urls["report"]}" style="color:#6b7280">Report this email</a></div>'
            f'<img src="{urls["pixel"]}" width="1" height="1" alt="">'
        )

    # ---------- tracking links ----------

    @staticmethod
    def record_open(token):
        """Record that a recipient opened the email."""
        recipient = EmailCampaignRecipient.query.filter_by(tracking_token=token).first()
        if not recipient:
            return False
        recipient.open_count += 1
        if recipient.opened_at is None:
            recipient.opened_at = datetime.utcnow()
        db.session.commit()
        return True

    @staticmethod
    def _act(token, action, kind=None):
        """Record the recipient's first action. Once there is a final result the email is closed:
        later clicks or reports change nothing. Returns the recipient, or None for an unknown token."""
        recipient = EmailCampaignRecipient.query.filter_by(tracking_token=token).first()
        if not recipient:
            return None
        ignore_after = _ignore_after()
        # Close an email whose window ran out before this action arrived (counts as ignored)
        CampaignService._settle(recipient, ignore_after)
        if recipient.settled_outcome or recipient.delivery_status != "SENT":
            db.session.commit()
            CampaignService._finish(recipient)
            return recipient

        now = datetime.utcnow()
        if action == "CLICKED":
            recipient.click_count += 1
            recipient.clicked_at = now
            recipient.clicked_kind = "ATTACHMENT" if kind == "attachment" else "LINK"
        else:
            recipient.reported_at = now
        CampaignService._settle(recipient, ignore_after)
        db.session.commit()
        CampaignService._finish(recipient)
        return recipient

    @staticmethod
    def record_click(token, kind=None):
        """The link or the attachment was opened. Returns True when the token is known."""
        return CampaignService._act(token, "CLICKED", kind) is not None

    @staticmethod
    def record_report(token):
        """The report link was used. Returns True when the token is known."""
        return CampaignService._act(token, "REPORTED") is not None

    @staticmethod
    def _finish(recipient):
        """After a result is final: count it as the player's decision, then send the result email once."""
        if not recipient.settled_outcome:
            return
        CampaignService._sync_one(recipient)
        db.session.commit()
        CampaignService._notify(recipient)

    @staticmethod
    def _notify(recipient):
        """Send the result email (good or bad) exactly once. Claiming notified_at first means two
        server processes can never both send it."""
        if not recipient.settled_outcome or recipient.notified_at:
            return
        claimed = db.session.execute(
            update(EmailCampaignRecipient)
            .where(EmailCampaignRecipient.campaign_recipient_id == recipient.campaign_recipient_id,
                   EmailCampaignRecipient.notified_at.is_(None))
            .values(notified_at=datetime.utcnow())
        ).rowcount
        db.session.commit()
        if claimed:
            CampaignService._send_result(recipient)

    @staticmethod
    def _send_result(recipient):
        """Email the recipient their result with feedback, in the PhishSimulator style."""
        campaign = recipient.campaign
        user = User.query.filter(func.lower(User.email) == recipient.recipient_email.lower()).first()
        first_name = user.player.full_name.split()[0] if user and user.player and user.player.full_name else None
        feedback_url = f"{current_app.config['FRONTEND_URL'].rstrip('/')}/?login={quote(recipient.recipient_email)}"

        subject, text_body, html_body, images = result_email(
            outcome=recipient.settled_outcome,
            is_phishing=campaign.is_phishing,
            via_attachment=recipient.clicked_kind == "ATTACHMENT",
            first_name=first_name,
            sender=campaign.sender,
            subject=campaign.subject or message_label(None, campaign.message),
            attachment=campaign.attachment,
            cues=campaign.get_phishing_cues() if campaign.is_phishing else [],
            xp=recipient.xp_awarded,
            feedback_url=feedback_url,
        )
        Mailer.send(recipient.recipient_email, subject, text_body, from_name="PhishSimulator Training",
                    html_body=html_body, inline_images=images)

    @staticmethod
    def sweep():
        """Close emails whose window has run out (they count as ignored), record them as decisions,
        and send any result emails still due. Only one server process sweeps at a time."""
        if not db.session.execute(text("SELECT pg_try_advisory_xact_lock(:key)"), {"key": SWEEP_LOCK_KEY}).scalar():
            db.session.rollback()
            return 0
        deadline = datetime.utcnow() - _ignore_after()
        due = EmailCampaignRecipient.query.filter(
            EmailCampaignRecipient.delivery_status == "SENT",
            EmailCampaignRecipient.settled_outcome.is_(None),
            EmailCampaignRecipient.sent_at <= deadline,
        ).all()
        for recipient in due:
            if CampaignService._settle(recipient, _ignore_after()):
                CampaignService._sync_one(recipient)
        db.session.commit()

        pending = EmailCampaignRecipient.query.filter(
            EmailCampaignRecipient.settled_outcome.is_not(None),
            EmailCampaignRecipient.notified_at.is_(None),
        ).all()
        for recipient in pending:
            CampaignService._notify(recipient)
        return len(due)

    @staticmethod
    def landing_info(token):
        """What the click / report landing page shows. Only the holder of the email's token can see it."""
        recipient = EmailCampaignRecipient.query.filter_by(tracking_token=token).first()
        if not recipient:
            return None
        campaign = recipient.campaign
        return {
            "email": recipient.recipient_email,
            "scenario_title": campaign.title,
            "sender": campaign.sender,
            "subject": campaign.subject,
            "attachment": campaign.attachment,
            "is_phishing": campaign.is_phishing,
            "cues": campaign.get_phishing_cues() if campaign.is_phishing else [],
            # The locked result, so the page shows what really counted (the first action)
            "outcome": recipient.settled_outcome,
            "via_attachment": recipient.clicked_kind == "ATTACHMENT",
            "clicked": recipient.clicked_at is not None,
            "reported": recipient.reported_at is not None,
            "xp": recipient.xp_awarded if recipient.settled_outcome else None,
        }

    # ---------- outcomes, XP and the player's inbox ----------

    @staticmethod
    def _outcome(recipient, ignore_after):
        """What one recipient did: CLICKED, REPORTED, IGNORED (nothing within the window),
        WAITING (still inside it) or NOT_SENT."""
        if recipient.delivery_status != "SENT":
            return "NOT_SENT"
        # A click is the risky action, so it wins even if they reported afterwards
        if recipient.clicked_at:
            return "CLICKED"
        if recipient.reported_at:
            return "REPORTED"
        if recipient.sent_at and datetime.utcnow() - recipient.sent_at >= ignore_after:
            return "IGNORED"
        return "WAITING"

    @staticmethod
    def _settle(recipient, ignore_after):
        """Lock the result and its XP once the outcome is final. The first action wins and cannot be
        changed afterwards, so this only ever runs once per recipient."""
        if recipient.settled_outcome:
            return False
        outcome = CampaignService._outcome(recipient, ignore_after)
        if outcome not in FINAL_OUTCOMES:
            return False
        recipient.settled_outcome = outcome
        recipient.xp_awarded = POINTS[(recipient.campaign.is_phishing, outcome)]
        recipient.feedback_seen_at = None
        return True

    @staticmethod
    def _results_for(email):
        """Every delivered campaign email for one address, settled and newest first."""
        rows = EmailCampaignRecipient.query.filter(
            func.lower(EmailCampaignRecipient.recipient_email) == (email or "").lower(),
            EmailCampaignRecipient.delivery_status == "SENT",
        ).order_by(EmailCampaignRecipient.sent_at.desc()).all()
        ignore_after = _ignore_after()
        changed = [CampaignService._settle(row, ignore_after) for row in rows]
        if any(changed):
            db.session.commit()
        return rows

    @staticmethod
    def sync_player(player):
        """Settle a player's campaign results and record each final one as a normal decision, so it
        counts toward the daily goal, streak, accuracy, skill rank, badges, XP and every stat."""
        rows = CampaignService._results_for(player.user.email)
        changed = [CampaignService._record_decision(row, player) for row in rows if row.settled_outcome]
        if any(changed):
            CampaignService._refresh_tracker(player.player_id)
            db.session.commit()
        for row in rows:
            CampaignService._notify(row)
        return rows

    @staticmethod
    def _sync_one(recipient):
        """Record one result as a decision straight away (on click or report), if a player owns the address."""
        user = User.query.filter(func.lower(User.email) == recipient.recipient_email.lower()).first()
        if user and user.player and recipient.settled_outcome:
            if CampaignService._record_decision(recipient, user.player):
                CampaignService._refresh_tracker(user.player.player_id)

    @staticmethod
    def _record_decision(recipient, player):
        """Create or update the attempt for one settled result. Returns True when something changed."""
        answer, correct = DECISIONS[(recipient.campaign.is_phishing, recipient.settled_outcome)]
        acted_at = {
            "CLICKED": recipient.clicked_at,
            "REPORTED": recipient.reported_at,
            "IGNORED": (recipient.sent_at or datetime.utcnow()) + _ignore_after(),
        }[recipient.settled_outcome]

        attempt = SimulationAttempt.query.filter_by(campaign_recipient_id=recipient.campaign_recipient_id).first()
        if attempt and (attempt.player_id, attempt.player_answer, attempt.score) == (player.player_id, answer, recipient.xp_awarded):
            return False

        # Resolve the scenario before touching the attempt: the lookup can flush the session,
        # and a half-filled new attempt would fail its required columns
        scenario = CampaignService._scenario_for(recipient.campaign)
        fields = {
            "player_id": player.player_id,
            "scenario_id": scenario.scenario_id,
            "difficulty": scenario.difficulty or "Medium",
            "player_answer": answer,
            "correct": correct,
            "score": recipient.xp_awarded,
            "attempted_at": acted_at,
        }
        if attempt:
            for name, value in fields.items():
                setattr(attempt, name, value)
        else:
            attempt = SimulationAttempt(campaign_recipient_id=recipient.campaign_recipient_id, simulation_type="EMAIL",
                                        selected_clues="", justification="", **fields)
            db.session.add(attempt)
        db.session.flush()

        # What they actually did, so it shows up in "risky clicks" (link or attachment)
        if recipient.settled_outcome == "CLICKED":
            action = "OPENED_ATTACHMENT" if recipient.clicked_kind == "ATTACHMENT" else "CLICKED_LINK"
        else:
            action = answer
        UserAction.query.filter_by(attempt_id=attempt.attempt_id).delete()
        db.session.add(UserAction(attempt_id=attempt.attempt_id, action=action))
        return True

    @staticmethod
    def _scenario_for(campaign):
        """The scenario a campaign's decisions belong to. A custom email gets a hidden one
        (status CAMPAIGN): never served in training and never listed for review."""
        if campaign.scenario:
            return campaign.scenario
        scenario = Scenario(
            title=campaign.subject or "Custom campaign email",
            simulation_type="EMAIL",
            category="Email campaign",
            difficulty="Medium",
            sender=campaign.sender,
            subject=campaign.subject,
            message=campaign.message or "",
            correct_answer="REPORT" if campaign.is_phishing else "SAFE",
            phishing_cues=campaign.phishing_cues,
            attachment=campaign.attachment,
            status=Scenario.CAMPAIGN_STATUS,
        )
        db.session.add(scenario)
        db.session.flush()
        campaign.scenario = scenario
        return scenario

    @staticmethod
    def _refresh_tracker(player_id):
        """Recount the stored totals from the player's attempts."""
        attempts = SimulationAttempt.query.filter_by(player_id=player_id).all()
        tracker = PerformanceTracker.query.filter_by(player_id=player_id).first()
        if not tracker:
            tracker = PerformanceTracker(player_id=player_id)
            db.session.add(tracker)
        tracker.total_attempts = len(attempts)
        tracker.correct_attempts = sum(attempt.correct for attempt in attempts)
        tracker.total_score = sum(attempt.score or 0 for attempt in attempts)
        tracker.last_attempt_at = max((attempt.attempted_at for attempt in attempts if attempt.attempted_at), default=None)

    @staticmethod
    def player_inbox(user_id):
        """The player's campaign results, as notifications with feedback."""
        user = db.session.get(User, user_id)
        if not user:
            return None
        results = CampaignService.sync_player(user.player) if user.player else CampaignService._results_for(user.email)
        rows = [row for row in results if row.settled_outcome]
        return {
            "unseen": sum(row.feedback_seen_at is None for row in rows),
            "items": [CampaignService._inbox_item(row) for row in rows],
        }

    @staticmethod
    def _inbox_item(recipient):
        """One notification: what happened, the XP, and the email itself for the feedback view."""
        campaign = recipient.campaign
        return {
            "id": recipient.campaign_recipient_id,
            "outcome": recipient.settled_outcome,
            "is_phishing": campaign.is_phishing,
            "via_attachment": recipient.clicked_kind == "ATTACHMENT",
            "xp": recipient.xp_awarded,
            "seen": recipient.feedback_seen_at is not None,
            "sent_at": _iso(recipient.sent_at),
            "acted_at": _iso(recipient.clicked_at or recipient.reported_at),
            "email": {
                "title": campaign.title,
                "sender": campaign.sender,
                "subject": campaign.subject,
                "message": campaign.message,
                "attachment": campaign.attachment,
                "cues": campaign.get_phishing_cues() if campaign.is_phishing else [],
            },
        }

    @staticmethod
    def mark_seen(recipient_id, user_id):
        """The player opened the feedback for one result."""
        user = db.session.get(User, user_id)
        recipient = db.session.get(EmailCampaignRecipient, recipient_id)
        if not user or not recipient or recipient.recipient_email.lower() != user.email.lower():
            return False
        if recipient.feedback_seen_at is None:
            recipient.feedback_seen_at = datetime.utcnow()
            db.session.commit()
        return True

    # ---------- admin reports ----------

    @staticmethod
    def get_report(campaign_id):
        """A campaign with the email that was sent and every recipient's results."""
        campaign = db.session.get(EmailCampaign, campaign_id)
        return CampaignService._summary(campaign, include_recipients=True) if campaign else None

    @staticmethod
    def _summary(campaign, include_recipients=False):
        """Totals and rates for one campaign."""
        ignore_after = _ignore_after()
        recipients = campaign.recipients
        outcomes = {recipient.campaign_recipient_id: CampaignService._outcome(recipient, ignore_after)
                    for recipient in recipients}
        total = len(recipients)
        sent = sum(recipient.delivery_status == "SENT" for recipient in recipients)
        # Clicking or reporting means they must have opened it, even if their mail app blocked the pixel
        opened = sum(bool(recipient.opened_at or recipient.clicked_at or recipient.reported_at) for recipient in recipients)
        clicked = sum(recipient.clicked_at is not None for recipient in recipients)
        reported = sum(recipient.reported_at is not None for recipient in recipients)
        # Once every delivered email has a final result the campaign is closed: nothing can change it
        is_complete = campaign.status == "LAUNCHED" and all(
            outcome in FINAL_OUTCOMES or outcome == "NOT_SENT" for outcome in outcomes.values()
        )

        data = {
            "campaign_id": campaign.campaign_id,
            "name": campaign.name,
            "status": "COMPLETED" if is_complete else campaign.status,
            "closes_at": _iso(campaign.launched_at + ignore_after) if campaign.launched_at else None,
            "attachment": campaign.attachment,
            # Admin only: which scenario the email came from
            "scenario_title": ScenarioService.display_title(campaign.scenario) if campaign.scenario else campaign.title,
            "is_custom": campaign.scenario is None or campaign.scenario.status == Scenario.CAMPAIGN_STATUS,
            "is_phishing": campaign.is_phishing,
            "created_at": campaign.created_at.isoformat(),
            "launched_at": campaign.launched_at.isoformat() if campaign.launched_at else None,
            "recipients": total,
            "sent": sent,
            "opened": opened,
            "clicked": clicked,
            "reported": reported,
            "ignored": sum(outcome == "IGNORED" for outcome in outcomes.values()),
            "waiting": sum(outcome == "WAITING" for outcome in outcomes.values()),
            "ignore_minutes": current_app.config["CAMPAIGN_IGNORE_MINUTES"],
            # One outcome per recipient, so these add up to the recipient count
            "outcomes": {
                name: sum(outcome == name for outcome in outcomes.values())
                for name in ("REPORTED", "IGNORED", "WAITING", "CLICKED", "NOT_SENT")
            },
            "click_rate": round((clicked / sent) * 100) if sent else 0,
            "report_rate": round((reported / sent) * 100) if sent else 0,
        }
        if include_recipients:
            data["email"] = {
                "sender": campaign.sender,
                "subject": campaign.subject,
                "message": campaign.message,
                "attachment": campaign.attachment,
                "cues": campaign.get_phishing_cues(),
            }
            data["recipient_details"] = [{
                "email": recipient.recipient_email,
                "delivery_status": recipient.delivery_status,
                "outcome": outcomes[recipient.campaign_recipient_id],
                "via_attachment": recipient.clicked_kind == "ATTACHMENT",
                "notified": recipient.notified_at is not None,
                "xp_awarded": recipient.xp_awarded if recipient.settled_outcome else None,
                "sent_at": _iso(recipient.sent_at),
                "opened_at": _iso(recipient.opened_at),
                "clicked_at": _iso(recipient.clicked_at),
                "click_count": recipient.click_count,
                "reported_at": _iso(recipient.reported_at),
            } for recipient in recipients]
        return data

    @staticmethod
    def _clean_recipients(raw):
        """Accept a list or a comma / newline separated string of addresses."""
        if isinstance(raw, list):
            values = raw
        else:
            values = re.split(r"[,\n;]+", str(raw or ""))
        seen, cleaned = set(), []
        for value in values:
            email = str(value).strip().lower()
            if email and email not in seen and EMAIL_PATTERN.match(email):
                seen.add(email)
                cleaned.append(email)
        return cleaned


def _iso(value):
    """Format a date for JSON (or None)."""
    return value.isoformat() if value else None


def _ignore_after():
    """How long a delivered email waits for a click or report before it counts as ignored."""
    return timedelta(minutes=current_app.config["CAMPAIGN_IGNORE_MINUTES"])


def _public_backend_url():
    """The address used in tracking links."""
    return current_app.config["PUBLIC_BACKEND_URL"].rstrip("/")


def current_allowed():
    """The addresses campaigns may be sent to."""
    return current_app.config.get("CAMPAIGN_ALLOWED_RECIPIENTS", [])


def _sender_display_name(sender):
    """Show only the display-name part of "Name <address>" as the from-name."""
    name = re.sub(r"<[^>]+>", "", sender or "").strip()
    return name or "IT Notifications"


def _attachment_card(filename, open_url):
    """A clickable attachment tile in the email, like a real mail client shows. No file is attached:
    the link records that the attachment was opened, exactly as the body link does."""
    extension = (filename.rsplit(".", 1)[-1] if "." in filename else "file").upper()[:4]
    # A plausible, stable size for the tile (the same file name always shows the same size)
    size_kb = 120 + sum(ord(char) for char in filename) * 7 % 880
    badge = {"PDF": "#e11d48", "XLS": "#16a34a", "XLSX": "#16a34a", "CSV": "#16a34a",
             "DOC": "#2563eb", "DOCX": "#2563eb", "ZIP": "#d97706"}.get(extension, "#475569")
    return (
        '<div style="margin-top:20px;font-family:Arial,sans-serif;font-size:12px;color:#6b7280">1 attachment</div>'
        f'<a href="{open_url}" style="display:block;text-decoration:none;margin-top:6px;max-width:320px">'
        '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" '
        'style="border:1px solid #e5e7eb;border-radius:10px;background:#f9fafb"><tr>'
        '<td width="52" style="padding:10px 0 10px 12px"><div style="width:36px;height:36px;border-radius:8px;'
        f'background:{badge};color:#ffffff;font-family:Arial,sans-serif;font-size:10px;font-weight:bold;'
        f'text-align:center;line-height:36px">{html.escape(extension)}</div></td>'
        '<td style="padding:10px 12px;font-family:Arial,sans-serif">'
        f'<div style="font-size:14px;color:#111827;font-weight:bold">{html.escape(filename)}</div>'
        f'<div style="font-size:12px;color:#6b7280">{size_kb} KB</div></td>'
        '<td width="28" style="padding-right:12px;font-size:16px;color:#9ca3af" align="right">&#128206;</td>'
        '</tr></table></a>'
    )


def start_sweeper(app):
    """Background heartbeat: every minute close emails whose window has run out and send any result
    emails still due, so 'ignored' results reach players without anyone opening a page."""
    def loop():
        while True:
            time.sleep(60)
            try:
                with app.app_context():
                    CampaignService.sweep()
            except Exception:
                logger.exception("Campaign sweep failed")
            finally:
                db.session.remove()

    threading.Thread(target=loop, name="campaign-sweeper", daemon=True).start()
