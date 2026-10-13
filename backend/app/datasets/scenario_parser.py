# Reads rows from uploaded datasets and turns them into scenario fields

import re

from app.utils.clues import contains_word, detect_message_signs
from app.utils.links import suspicious_links


class ScenarioParser:
    """Turns raw dataset rows into draft scenarios with clues and a difficulty."""

    URL_REGEX = r"(?:https?://|www\.)[^\s<>\"']+"
    EMAIL_REGEX = r"[\w.+-]+@[\w-]+\.[\w.-]+"
    PHONE_REGEX = r"(?:\+?\d[\d\s-]{8,}\d)"
    MIN_MESSAGE_LENGTH = 10

    SENDER_BAIT_WORDS = ("secure", "verify", "support", "account", "update", "login")

    CATEGORY_KEYWORDS = {
        "Banking": ("bank", "payment", "invoice", "card", "transaction", "statement", "eft"),
        "Delivery": ("delivery", "parcel", "shipment", "package"),
        "Government": ("government", "tax", "irs", "sars", "benefit"),
        "Employment": ("job", "recruit", "interview", "employment"),
        "University": ("university", "student", "campus", "course"),
        "Password Reset": ("password", "reset", "login", "log in", "credential", "verify your account", "re-confirm"),
        "Microsoft 365": ("microsoft", "office 365", "outlook", "teams"),
        "Social Media": ("facebook", "instagram", "linkedin", "social"),
    }

    PHISHING_TYPE_CATEGORIES = {
        "credential_harvesting": "Password Reset",
        "account_takeover": "Password Reset",
        "authority_scam": "Government",
        "romance_dating": "Social Media",
        "job_scam": "Employment",
        "delivery_scam": "Delivery",
        "invoice_scam": "Banking",
        "financial_scam": "Banking",
        "urgency": "Password Reset",
        "generic_phishing": "Password Reset",
        "threats": "Government",
        "tech_support": "Microsoft 365",
        "social_engineering": "Social Media",
        "social_engineering_advanced": "Social Media",
    }

    @staticmethod
    def extract_urls(text):
        """Find every URL in the text."""
        return [url.rstrip(".,;:!?)") for url in re.findall(ScenarioParser.URL_REGEX, text)]

    @staticmethod
    def sender_address(sender):
        """The email address inside "Display Name <address>", or the sender as-is."""
        match = re.search(r"<([^>]+)>", sender or "")
        return (match.group(1) if match else sender or "").strip()

    @staticmethod
    def is_suspicious_sender(sender):
        """Flag look-alike senders such as security@micr0soft-support.co."""
        sender = ScenarioParser.sender_address(sender)
        if "@" not in sender:
            return False

        domain = sender.rsplit("@", 1)[1].lower()
        name = domain.split(".")[0]
        has_swapped_digit = re.search(r"[a-z]\d[a-z]", name) is not None
        has_bait_word = "-" in name and any(
            word in name for word in ScenarioParser.SENDER_BAIT_WORDS
        )
        return has_swapped_digit or has_bait_word

    @staticmethod
    def extract_cues(text, sender=""):
        """Detect the warning signs present in a message."""
        cues = []

        # A link is only a warning sign when it looks fake (see app/utils/links.py), not just for being there
        if suspicious_links(text):
            cues.append("Suspicious link")
        if ScenarioParser.is_suspicious_sender(sender):
            cues.append("Fake sender")

        return cues + detect_message_signs(text)

    @staticmethod
    def infer_difficulty(cues, is_phishing, severity=""):
        """Easy messages show many obvious clues; hard ones hide them."""
        if severity == "high":
            return "Hard"

        if is_phishing:
            if len(cues) >= 3:
                difficulty = "Easy"
            elif len(cues) == 2:
                difficulty = "Medium"
            else:
                difficulty = "Hard"
        else:
            difficulty = "Hard" if len(cues) >= 2 else "Medium" if cues else "Easy"

        if severity == "medium" and difficulty == "Easy":
            return "Medium"
        return difficulty

    # Made-up addresses the importer writes in (e.g. you@example.com) are not anyone's personal data
    MADE_UP_DOMAINS = ("example.com", "example.org", "example.net", "example.test", "phishsimulator.test")

    # South African toll-free (0800) and share-call (0860, 0861) numbers, with or without +27
    ORGANISATION_NUMBERS = ("0800", "0860", "0861", "27800", "27860", "27861")

    @staticmethod
    def personal_details(text):
        """Email addresses and phone numbers in a message, partly hidden, e.g. ("email address", "ja***@pths209.org")."""
        found = []
        for address in dict.fromkeys(re.findall(ScenarioParser.EMAIL_REGEX, text or "")):
            if not address.lower().endswith(ScenarioParser.MADE_UP_DOMAINS):
                local, domain = address.split("@", 1)
                found.append(("email address", f"{local[:2]}***@{domain}"))
        for number in dict.fromkeys(re.findall(ScenarioParser.PHONE_REGEX, text or "")):
            digits = re.sub(r"\D", "", number)
            if digits.startswith(ScenarioParser.ORGANISATION_NUMBERS):
                continue  # toll-free and share-call lines belong to organisations, not people
            found.append(("phone number", f"{digits[:3]} *** **{digits[-2:]}"))
        return found

    @staticmethod
    def find_personal_data(text):
        """The kinds of personal data in a message body ("email address", "phone number")."""
        return list(dict.fromkeys(kind for kind, _ in ScenarioParser.personal_details(text)))

    MAX_MESSAGE_LENGTH = 5000

    @staticmethod
    def is_unreadable(text):
        """True for pre-processed corpus text that can't pass as a real message."""
        tokenised = re.search(r"\w \, \w|\w \. \w|\w \: \w", text) is not None
        stripped = len(text) > 80 and text == text.lower() and not re.search(r"[.,!?]", text)
        return tokenised or stripped

    @staticmethod
    def normalize_label(value):
        """Turn a dataset label (text, number or bool) into PHISHING or LEGITIMATE."""
        if isinstance(value, bool):
            return "PHISHING" if value else "LEGITIMATE"

        normalized = str(value or "").strip().lower()
        if normalized in {
            "1", "true", "phishing", "phish", "smishing", "malicious", "fraud",
        }:
            return "PHISHING"
        if normalized in {"0", "false", "legitimate", "safe", "ham", "benign"}:
            return "LEGITIMATE"
        return None

    EMPTY_VALUES = {"", "nan", "none", "null", "yes", "no"}

    @staticmethod
    def _value(row, *names):
        """Return the first real value found under any of the given column names."""
        for name in names:
            value = str(row.get(name) or "").strip()
            if value.lower() not in ScenarioParser.EMPTY_VALUES:
                return value
        return ""

    @staticmethod
    def anonymise_recipient(text, receiver):
        """Replace the original mailbox owner's address with a neutral one."""
        match = re.search(ScenarioParser.EMAIL_REGEX, receiver or "")
        if not match:
            return text
        address = match.group(0)
        domain = address.split("@")[1]
        text = re.sub(re.escape(address), "you@example.com", text, flags=re.IGNORECASE)
        return re.sub(re.escape(domain), "example.com", text, flags=re.IGNORECASE)

    @staticmethod
    def build_scenario_title(message_type, subject, message):
        """A readable title from the message's own subject (or its first words). No "EMAIL training" prefix:
        the channel is shown as a badge, and a title must never hint to a player that a message is a test."""
        compact = re.sub(r"\s+", " ", str(subject or message or "")).strip()
        return compact[:180] or f"Untitled {str(message_type).lower()}"

    @staticmethod
    def infer_category(text):
        """Guess a training category from keywords in the message."""
        lower = text.lower()
        # The category whose keywords appear most often wins (ties go to the first in the list)
        matches = {
            category: sum(contains_word(lower, keyword) for keyword in keywords)
            for category, keywords in ScenarioParser.CATEGORY_KEYWORDS.items()
        }
        best = max(matches, key=matches.get)
        if matches[best]:
            return best
        return "Password Reset" if "verify" in lower else "Social Media"

    @staticmethod
    def _category_for(row, full_text):
        """Use the dataset's own phishing type column if it has one, else guess."""
        phishing_type = ScenarioParser._value(row, "phishing_type", "type")
        key = phishing_type.lower().replace("-", "_").replace(" ", "_")
        return (
            ScenarioParser.PHISHING_TYPE_CATEGORIES.get(key)
            or ScenarioParser.infer_category(full_text)
        )

    @staticmethod
    def drop_repeated_text(text):
        """Some corpora store an email's plain and HTML parts together, so the whole body appears twice
        (or three times). Keep a single copy. Short phrases (under 8 words) and other text are left alone."""
        words = text.split()
        for copies in (2, 3):
            size, extra = divmod(len(words), copies)
            if extra == 0 and size >= 8 and all(words[i * size:(i + 1) * size] == words[:size] for i in range(copies)):
                return " ".join(words[:size])
        return text

    @staticmethod
    def parse_row(row, dataset_type="EMAIL"):
        """Convert one dataset row into a processed record, or None if unusable."""
        row = {str(key).strip().lower(): value for key, value in row.items()}

        sender = ScenarioParser._value(row, "sender", "from", "email_from")
        subject = ScenarioParser._value(row, "subject", "title")
        message = ScenarioParser._value(
            row, "body", "content", "text", "email_body", "message", "text_combined",
        )
        if not message:
            return None

        message = ScenarioParser.drop_repeated_text(message)
        receiver = ScenarioParser._value(row, "receiver", "to")
        subject = ScenarioParser.anonymise_recipient(subject, receiver)
        message = ScenarioParser.anonymise_recipient(message, receiver)

        # Email headers can be folded over several lines; keep them on one line and
        # within the 255-character database columns
        sender = " ".join(sender.split())[:255]
        subject = " ".join(subject.split())[:255]

        full_text = f"{subject} {message}"
        label = ScenarioParser.normalize_label(
            ScenarioParser._value(row, "label", "class", "is_phishing", "correct_answer")
        )
        cues = ScenarioParser.extract_cues(full_text, sender)
        severity = ScenarioParser._value(row, "severity").lower()

        return {
            "message_type": dataset_type.upper(),
            "sender": sender,
            "subject": subject,
            "message": message,
            "difficulty": ScenarioParser.infer_difficulty(cues, label == "PHISHING", severity),
            "phishing_cues": cues,
            "category": ScenarioParser._category_for(row, full_text),
            "label": label,
        }
