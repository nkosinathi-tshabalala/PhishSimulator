import re


class ScenarioParser:
    """
    Parses phishing datasets and extracts
    phishing indicators for scenario generation.
    """

    URL_REGEX = r"(?:https?://|www\.)[^\s<>\"']+"

    URGENCY_KEYWORDS = [

        "urgent",
        "immediately",
        "verify",
        "suspend",
        "limited",
        "expire",
        "click",
        "action required"

    ]

    CREDENTIAL_KEYWORDS = [

        "password",
        "login",
        "username",
        "verify account",
        "confirm identity"

    ]

    CATEGORY_KEYWORDS = {
        "Banking": ("bank", "account", "payment", "invoice"),
        "Delivery": ("delivery", "parcel", "shipment", "package"),
        "Government": ("government", "tax", "irs", "benefit"),
        "Employment": ("job", "recruit", "interview", "employment"),
        "University": ("university", "student", "campus", "course"),
        "Password Reset": ("password", "reset", "login", "credential"),
        "Microsoft 365": ("microsoft", "office 365", "outlook", "teams"),
        "Social Media": ("facebook", "instagram", "linkedin", "social"),
    }

    @staticmethod
    def extract_urls(text):

        return re.findall(
            ScenarioParser.URL_REGEX,
            text
        )

    @staticmethod
    def extract_cues(text):

        cues = []

        lower = text.lower()

        if ScenarioParser.extract_urls(text):

            cues.append("Suspicious URL")

        if any(

            word in lower

            for word in ScenarioParser.URGENCY_KEYWORDS

        ):

            cues.append("Urgency")

        if any(

            word in lower

            for word in ScenarioParser.CREDENTIAL_KEYWORDS

        ):

            cues.append("Credential Request")

        return cues

    @staticmethod
    def normalize_label(value):
        if isinstance(value, bool):
            return "PHISHING" if value else "LEGITIMATE"

        normalized = str(value or "").strip().lower()
        if normalized in {
            "1", "true", "phishing", "phish", "spam", "smishing", "malicious", "fraud",
        }:
            return "PHISHING"
        if normalized in {"0", "false", "legitimate", "safe", "ham", "benign"}:
            return "LEGITIMATE"
        return None

    @staticmethod
    def _value(row, *names):
        """Return the first non-empty value from a normalised dataset row."""
        for name in names:
            value = row.get(name)
            if value is not None and str(value).strip() and str(value).strip().lower() != "nan":
                return str(value).strip()
        return ""

    @staticmethod
    def _category_from_phishing_type(value):
        normalised = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
        mapping = {
            "credential_harvesting": "Password Reset",
            "account_takeover": "Password Reset",
            "authority_scam": "Government",
            "romance_dating": "Social Media",
            "job_scam": "Employment",
            "delivery_scam": "Delivery",
            "invoice_scam": "Banking",
        }
        return mapping.get(normalised)

    @staticmethod
    def build_scenario_title(message_type, subject, message):
        """Create a distinct, readable title when the source has no subject."""
        prefix = f"{str(message_type).upper()} training"
        source = subject or message
        compact = re.sub(r"\s+", " ", str(source or "")).strip()
        if not compact:
            return prefix
        return f"{prefix}: {compact[:180]}"

    @staticmethod
    def infer_category(text):
        lower = text.lower()

        for category, keywords in ScenarioParser.CATEGORY_KEYWORDS.items():
            if any(keyword in lower for keyword in keywords):
                return category

        return "Password Reset" if "verify" in lower else "Social Media"

    @staticmethod
    def parse_dataset(records, dataset_type="EMAIL"):
        """
        Converts dataset rows into processed records
        ready for scenario generation.
        """

        processed_records = []

        for row in records:

            normalized_row = {
                str(key).strip().lower(): value
                for key, value in row.items()
            }
            sender = ScenarioParser._value(
                normalized_row, "sender", "from", "email_from", "email", "phone",
            )
            subject = ScenarioParser._value(normalized_row, "subject", "title")
            message = ScenarioParser._value(
                normalized_row,
                "body", "content", "text", "email_body", "message", "text_combined",
            )

            if not str(message).strip():
                continue

            full_text = f"{subject} {message}"

            cues = ScenarioParser.extract_cues(
                full_text
            )

            difficulty = "Easy"

            if len(cues) >= 3:
                difficulty = "Hard"

            elif len(cues) == 2:
                difficulty = "Medium"

            label = ScenarioParser.normalize_label(
                ScenarioParser._value(
                    normalized_row, "label", "class", "is_phishing", "correct_answer",
                )
            )
            severity = ScenarioParser._value(normalized_row, "severity").lower()
            if severity == "high":
                difficulty = "Hard"
            elif severity == "medium" and difficulty == "Easy":
                difficulty = "Medium"

            category = (
                ScenarioParser._category_from_phishing_type(
                    ScenarioParser._value(normalized_row, "phishing_type", "type")
                )
                or ScenarioParser.infer_category(full_text)
            )

            processed_records.append({

                "message_type": dataset_type.upper(),

                "sender": str(sender).strip(),

                "subject": str(subject).strip(),

                "message": str(message).strip(),

                "difficulty": difficulty,

                "phishing_cues": cues,

                "category": category,

                "label": label,

            })

        return processed_records
