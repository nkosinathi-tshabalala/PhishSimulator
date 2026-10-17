# Makes scenarios look like real messages without hinting at the answer

import hashlib
import re
from random import Random

from app.datasets.scenario_parser import ScenarioParser
from app.utils.clues import contains_word
from app.utils.links import find_urls, suspicious_links


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


# Phrases from a website's footer: a sign the text was copied from a web page, not written as a message
FOOTER_PHRASES = ("all rights reserved", "privacy policy", "legal notices", "terms of use", "terms and conditions",
                  "company products", "support resources", "cookie policy")
# The message asks the reader to click or open a link
ASKS_TO_CLICK = re.compile(r"\bclick (here|the link|below|on the link)\b|\blink below\b|\bfollow (this|the) link\b"
                           r"|\btap (here|the link)\b", re.IGNORECASE)
GAP_PATTERN = re.compile(r"[ \t]{3,}")


def tidy_text(message):
    """Clean text copied from a web page: no big gaps between words, no runs of blank lines,
    and a body stored twice is kept once."""
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in (message or "").replace("\r", "").split("\n")]
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    return ScenarioParser.drop_repeated_text(text)


def quality_review(channel, sender, subject, message, is_phishing, cues):
    """How ready a scenario is for players: starts at 100 and loses points for each problem, with a reason
    an admin can act on. Returns (score, [(points lost, reason), ...])."""
    channel = channel.upper()
    message = message or ""
    plain = LINK_MARKUP.sub(r"\1", message)
    lowered = plain.lower()
    problems = []

    def lose(points, reason):
        problems.append((points, reason))

    if not sender:
        lose(15, "no sender")
    if channel == "EMAIL" and not subject:
        lose(10, "no subject line")

    length = len(plain.strip())
    shortest, longest = (20, 400) if channel == "SMS" else (80, 1500)
    if length < shortest:
        lose(20, f"too short to judge ({length} characters)")
    elif length > longest * 2:
        lose(20, f"very long ({length} characters): trim it to the message itself")
    elif length > longest:
        lose(10, f"long ({length} characters)")

    if len(GAP_PATTERN.findall(message)) >= 2:
        lose(20, "big gaps between words (copied from a web page layout): re-process or edit the text")
    if RAW_TEXT_PATTERN.search(message):
        lose(20, "leftover HTML or email code in the text")
    # Some published files already hold "�" where a character was lost, so players would see broken text
    if "�" in message:
        lose(20, "broken characters (�) from the original file: fix the text or skip it")
    if ScenarioParser.drop_repeated_text(" ".join(plain.split())) != " ".join(plain.split()):
        lose(20, "the same text appears twice")
    if sum(phrase in lowered for phrase in FOOTER_PHRASES) >= 2:
        lose(10, "ends with website footer text (copyright, privacy policy...)")
    if ASKS_TO_CLICK.search(plain) and not find_urls(message):
        lose(25, "asks the reader to click a link, but the link is missing")
    if ScenarioParser.find_personal_data(plain):
        lose(15, "contains an email address or phone number")

    if is_phishing and not cues:
        lose(25, "phishing but no warning signs are listed")
    elif is_phishing and len(cues) == 1:
        lose(5, "only one warning sign: fine for a Hard scenario")
    if is_phishing and "Suspicious link" in cues and not suspicious_links(message):
        lose(10, "lists 'Suspicious link', but no link looks fake")
    if not is_phishing and suspicious_links(message):
        lose(20, "marked genuine but contains a link that looks fake")

    return max(100 - sum(points for points, _ in problems), 0), problems


def quality_score(channel, sender, subject, message, is_phishing, cues):
    """0-100: how ready a scenario is for players (see quality_review for the reasons)."""
    return quality_review(channel, sender, subject, message, is_phishing, cues)[0]


def enrich(channel, category, sender, subject, message, is_phishing, cues, attachment=None):
    """Return the realistic version of one scenario's fields (safe to run twice)."""
    message = mask_links(tidy_text(message), category, channel)
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
