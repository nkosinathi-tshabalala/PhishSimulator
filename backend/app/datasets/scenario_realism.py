# Makes scenarios look like real messages without hinting at the answer

import hashlib
import re
from random import Random

from app.datasets.scenario_parser import ScenarioParser
from app.utils.clues import contains_word


LINK_MARKUP = re.compile(r"\[([^\]\n]{1,80})\]\(((?:https?://|www\.)[^\s)]+)\)")

CALL_TO_ACTION = {
    "Banking": ("Review transaction", "Secure my account", "View account activity"),
    "Delivery": ("Track your parcel", "Reschedule delivery", "Manage delivery"),
    "Government": ("View your notice", "Check your status", "Open the notice"),
    "Employment": ("View the offer", "Complete your application", "Book an interview"),
    "University": ("Open student portal", "View your results", "Confirm registration"),
    "Password Reset": ("Reset password", "Review sign-in activity", "Keep my password"),
    "Microsoft 365": ("Open document", "View in SharePoint", "Review in Outlook"),
    "Social Media": ("View message", "Review login", "See what's new"),
}
DEFAULT_CALL_TO_ACTION = ("Open link", "View details", "Learn more")

ATTACHMENT_WORDS = ("attached", "attachment", "see attached", "enclosed", "find the file")
ATTACHMENT_STEMS = {
    "Banking": "Statement",
    "Delivery": "Waybill",
    "Government": "Tax_Notice",
    "Employment": "Offer_Letter",
    "University": "Academic_Record",
    "Password Reset": "Security_Report",
    "Microsoft 365": "Shared_Document",
    "Social Media": "Photos",
}
RISKY_EXTENSIONS = (".htm", ".zip", ".docm", ".iso")
SAFE_EXTENSIONS = (".pdf", ".docx", ".xlsx")

GENERIC_MAILBOXES = {"no-reply", "noreply", "info", "mail", "admin", "hello", "contact", "notifications"}

RAW_TEXT_PATTERN = re.compile(r"<[a-z/][^>]*>|content-type:|&nbsp;|=20|=\r?\n", re.IGNORECASE)


def _rng_for(text):
    """A random generator seeded by the message, so re-processing gives the same result."""
    digest = hashlib.sha256(text.encode("utf-8", "ignore")).hexdigest()
    return Random(int(digest[:12], 16))


def _clean_url(url):
    """Remove punctuation stuck to the end of a URL."""
    return url.rstrip(".,;:!?)")


def _mask_line(line, category, rng):
    """Hide a link behind text when it sits alone or after a label ("Pay now: http://...")."""
    if LINK_MARKUP.search(line):
        return line

    stripped = line.strip()
    if re.fullmatch(ScenarioParser.URL_REGEX, _clean_url(stripped)):
        choices = CALL_TO_ACTION.get(category, DEFAULT_CALL_TO_ACTION)
        return f"[{rng.choice(choices)}]({_clean_url(stripped)})"

    labelled = re.fullmatch(r"([^:\n]{2,40}):\s*(\S+)", stripped)
    if labelled and re.fullmatch(ScenarioParser.URL_REGEX, _clean_url(labelled.group(2))):
        return f"[{labelled.group(1).strip()}]({_clean_url(labelled.group(2))})"

    return line


def mask_links(message, category, channel):
    """Put email links behind button-style text. SMS links stay visible."""
    if channel.upper() != "EMAIL":
        return message

    rng = _rng_for(message)
    return "\n".join(_mask_line(line, category, rng) for line in message.split("\n"))


def link_targets(message):
    """Every real address in a message, masked or not."""
    masked = [_clean_url(url) for _, url in LINK_MARKUP.findall(message)]
    visible = ScenarioParser.extract_urls(LINK_MARKUP.sub("", message))
    return masked + visible


def _title_word(word):
    """Capitalise a word for a display name (short words become acronyms)."""
    return word.upper() if len(word) <= 3 else word.capitalize()


def display_sender(sender, channel):
    """Add a display name to a bare email address, like a mail app shows it."""
    if channel.upper() != "EMAIL" or not sender or "<" in sender or "@" not in sender:
        return sender

    mailbox, domain = sender.rsplit("@", 1)
    brand_words = [word for word in re.split(r"[-_.]+", domain.split(".")[0]) if word]
    name_words = [_title_word(word) for word in brand_words]

    role = mailbox.split("-")[0].split(".")[0].lower()
    if len(name_words) == 1 and role.isalpha() and role not in GENERIC_MAILBOXES:
        name_words.append(_title_word(role))

    name = " ".join(name_words) or sender
    return f"{name} <{sender}>"


def attachment_for(message, category, is_phishing, channel):
    """Invent a file when the email mentions one. Risky file types only for phishing."""
    if channel.upper() != "EMAIL":
        return None

    lowered = message.lower()
    if not any(contains_word(lowered, word) for word in ATTACHMENT_WORDS):
        return None

    rng = _rng_for(message)
    stem = ATTACHMENT_STEMS.get(category, "Document")
    extension = rng.choice(RISKY_EXTENSIONS if is_phishing else SAFE_EXTENSIONS)
    return f"{stem}_{rng.randint(1000, 9999)}{extension}"


def is_risky_attachment(file_name):
    """True for file types attackers like to send (.htm, .zip, .docm, .iso...)."""
    return bool(file_name) and file_name.lower().endswith(RISKY_EXTENSIONS)


def quality_score(channel, sender, subject, message, is_phishing, cues):
    """0-100: how ready a generated scenario is for players (higher is better)."""
    channel = channel.upper()
    score = 15 if sender else 0
    score += 10 if subject or channel == "SMS" else 0

    length = len(message.strip())
    good_length = (20, 400) if channel == "SMS" else (80, 1500)
    if good_length[0] <= length <= good_length[1]:
        score += 25
    elif length <= good_length[1] * 2:
        score += 12

    if is_phishing:
        score += 20 if len(cues) >= 2 else 12 if cues else 0
    else:
        score += 20 if len(cues) <= 1 else 10

    score += 0 if ScenarioParser.find_personal_data(LINK_MARKUP.sub("", message)) else 15
    score += 0 if RAW_TEXT_PATTERN.search(message) else 15
    return score


def enrich(channel, category, sender, subject, message, is_phishing, cues, attachment=None):
    """Return the realistic version of one scenario's fields (safe to run twice)."""
    message = mask_links(message, category, channel)
    sender = display_sender(sender, channel)
    attachment = attachment or attachment_for(message, category, is_phishing, channel)

    cues = list(cues)
    if is_phishing and is_risky_attachment(attachment) and "Unexpected attachment" not in cues:
        cues.append("Unexpected attachment")

    return {
        "sender": sender,
        "message": message,
        "attachment": attachment,
        "phishing_cues": cues,
        "quality_score": quality_score(channel, sender, subject, message, is_phishing, cues),
    }


def enrich_scenario(scenario):
    """Apply `enrich` to a Scenario row in place."""
    fields = enrich(
        scenario.simulation_type,
        scenario.category,
        scenario.sender,
        scenario.subject,
        scenario.message,
        scenario.correct_answer.upper() == "REPORT",
        scenario.get_phishing_cues(),
        scenario.attachment,
    )
    scenario.sender = fields["sender"]
    scenario.message = fields["message"]
    scenario.attachment = fields["attachment"]
    scenario.quality_score = fields["quality_score"]
    scenario.set_phishing_cues(fields["phishing_cues"])
