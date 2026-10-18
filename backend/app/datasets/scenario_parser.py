# Reads rows from uploaded datasets and turns them into scenario fields

import re
from email.header import decode_header, make_header

from app.utils.clues import contains_word, detect_message_signs
from app.utils.links import BRANDS, UNUSUAL_ENDINGS, brand_named_in, site_of, suspicious_links


class ScenarioParser:
    """Turns raw dataset rows into draft scenarios with clues and a difficulty."""

    URL_REGEX = r"(?:https?://|www\.)[^\s<>\"']+"
    EMAIL_REGEX = r"[\w.+-]+@[\w-]+\.[\w.-]+"
    PHONE_REGEX = r"(?:\+?\d[\d\s-]{8,}\d)"
    MIN_MESSAGE_LENGTH = 10

    SENDER_BAIT_WORDS = ("secure", "verify", "support", "account", "update", "login")

    # Where a message goes when no category's keywords match. Not a phishing type, so the All-Rounder badge
    # (a correct answer in every CATEGORY_KEYWORDS category) does not ask for it
    GENERAL_CATEGORY = "General"

    # What a message is about, from its own words: (strong words, which name the topic on their own, such as
    # a brand or "parcel"; weak words, which only count with another). Strong words score 2 and weak words 1,
    # words in the subject count twice, and a category needs MIN_CATEGORY_SCORE. The highest score wins; a tie
    # goes to the category listed first, so specific topics come before the broad "account" and "money" ones.
    # Phishing and genuine messages are sorted by exactly the same words, so a category never hints at the answer.
    CATEGORY_KEYWORDS = {
        "Delivery": (
            ("parcel", "parcels", "courier", "shipment", "shipments", "redelivery", "waybill", "delivery address",
             "delivery fee", "tracking number", "post office", "dhl", "fedex", "ups", "usps", "royal mail",
             "aramex", "postnet", "pudo", "the courier guy", "sapo", "takealot"),
            # "delivery" alone is weak: email footers talk about "delivery preferences" and "message delivery"
            ("delivery", "package", "shipping", "shipped", "deliver", "delivered", "track", "tracking",
             "dispatch", "dispatched", "customs", "order"),
        ),
        "University": (
            ("university", "varsity", "student", "students", "campus", "lecturer", "lecture", "lectures",
             "semester", "tuition", "nsfas", "enrolment", "enrollment", "faculty", "bursary", "graduation",
             "academic", "exam", "exams", "assignment", "student portal", "student number", "moodle"),
            ("course", "courses", "module", "modules", "class", "classes", "results", "registration",
             "professor", "college", "school", "study", "studies", "residence", "library"),
        ),
        "Employment": (
            ("job", "jobs", "job offer", "vacancy", "vacancies", "recruiter", "recruitment", "recruiting",
             "hiring", "interview", "employment", "salary", "payroll", "payslip", "human resources",
             "hr department", "offer letter", "internship", "work from home", "resume", "cv", "career", "careers"),
            ("hr", "position", "role", "candidate", "apply", "application", "employee", "employees", "employer",
             "staff", "contract", "shortlisted", "onboarding"),
        ),
        "Government": (
            ("government", "sars", "efiling", "irs", "hmrc", "tax", "taxes", "tax refund", "tax return",
             "municipality", "home affairs", "sassa", "department of", "ministry", "police", "saps", "fbi",
             "immigration", "embassy", "treasury", "social security", "medicare", "traffic fine", "e-toll",
             "licence renewal", "license renewal", "census", "uif", "court order", "parliament", "federal"),
            ("official", "compliance", "authority", "authorities", "legal", "law", "warrant", "citizen",
             "public", "national", "grant", "passport", "visa", "id document"),
        ),
        "Social Media": (
            ("facebook", "instagram", "linkedin", "whatsapp", "twitter", "tiktok", "snapchat", "youtube",
             "telegram", "social media", "friend request", "followers", "dating"),
            ("post", "posts", "profile", "tagged", "follow us", "follow you", "friend", "friends", "photo",
             "photos", "comment", "comments", "message request", "page"),
        ),
        "Email & IT": (
            ("microsoft", "office 365", "microsoft 365", "o365", "outlook", "microsoft teams", "onedrive",
             "sharepoint", "it department", "it support", "it team", "helpdesk", "help desk", "it desk",
             "service desk", "webmail", "mailbox", "email account", "e-mail account", "mail server",
             "email quota", "mailbox quota", "storage quota", "cpanel", "zimbra", "malware",
             "shared a document", "shared a file", "shared with you"),
            ("virus", "antivirus", "workstation", "software", "server", "quota", "storage", "upgrade", "update",
             "email", "e-mail", "network", "security patch"),
        ),
        "Prizes & Offers": (
            ("congratulations", "you have won", "you've won", "you won", "you ve won", "u have won",
             "ur awarded", "awarded", "you have been selected", "selected recipient", "winner", "winners",
             "prize", "prizes", "lottery", "jackpot", "sweepstakes", "giveaway", "gift card", "voucher",
             "vouchers", "free gift", "reward", "rewards", "claim your", "cash prize", "cashback",
             "await collection", "lucky draw", "bonus points"),
            ("free", "won", "win", "offer", "offers", "bonus", "claim", "deal", "discount", "promo", "promotion",
             "selected", "exclusive", "ringtone", "ringtones", "txt", "entry", "competition", "half price",
             "holiday"),
        ),
        "Account Security": (
            ("password", "passcode", "2fa", "two-factor", "two factor", "verification code", "security code",
             "otp", "one-time pin", "one time pin", "sign-in", "sign in", "signin", "log in", "login", "log-in",
             "username", "unusual activity", "unusual sign-in", "suspicious activity", "unauthorized",
             "unauthorised", "verify your account", "verify your identity", "confirm your identity",
             "reactivate", "restore access", "locked out", "security alert", "security question",
             "recovery key", "account has been", "account will be", "account suspended", "account locked",
             "account blocked", "has been locked", "has been suspended", "has been blocked", "has been restricted",
             "has been disabled", "has been deactivated"),
            ("your account", "verify", "verification", "access", "suspend", "suspended", "suspension", "locked",
             "blocked", "block", "deactivated", "deactivate", "restrict", "restricted", "restriction", "hold",
             "on hold", "freeze", "frozen", "seize", "terminate", "terminated", "close", "closed", "delete",
             "deleted", "credentials", "authenticate", "identity", "security", "reset"),
        ),
        "Banking & Money": (
            ("bank", "banks", "banking", "bank account", "credit card", "debit card", "card details",
             "card number", "paypal", "western union", "moneygram", "wire transfer", "bitcoin", "btc", "crypto",
             "cryptocurrency", "routing number", "account number", "iban", "swift", "atm", "capitec", "fnb",
             "absa", "nedbank", "standard bank", "american express", "amex", "mastercard", "inheritance",
             "next of kin", "beneficiary", "loan", "loans", "invoice", "invoices", "refund", "eft",
             "proof of payment", "investment", "kyc", "k.y.c"),
            ("payment", "payments", "pay", "paid", "transfer", "transaction", "transactions", "funds", "fund",
             "money", "cash", "deposit", "statement", "balance", "card", "billing", "bill", "fee", "fees",
             "charge", "charged", "overdue", "wallet", "dollars", "euros", "rand", "purchase", "budget",
             "finance", "financial", "receipt"),
        ),
    }
    # An amount of money ("R300", "$25", "US$ 10m", "₹80,000") counts as one weak word for Banking & Money
    MONEY_AMOUNT = re.compile(r"(?:[$€£₹]|\b(?:r|usd|us\$|eur|gbp|zar)\s?)\d[\d,.]*")
    MIN_CATEGORY_SCORE = 2

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
    def sender_display_name(sender):
        """The name part of "Display Name <address>", or "" when the sender is a bare address."""
        match = re.match(r"\s*(.*?)\s*<[^>]+>", sender or "")
        return match.group(1).strip().strip("\"'") if match else ""

    @staticmethod
    def is_suspicious_sender(sender):
        """Flag senders that pretend to be someone else: a look-alike domain (security@micr0soft-support.co),
        a brand in the name or mailbox but not in the domain ("PayPal" <paypal@support.com>, "American Express"
        <mlholland1@cox.net>), or a display name that is itself a different address."""
        address = ScenarioParser.sender_address(sender)
        if "@" not in address:
            return False

        mailbox, domain = address.lower().rsplit("@", 1)
        domain = domain.strip(".> ")
        site = site_of(domain)
        name = domain.split(".")[0]
        has_swapped_digit = re.search(r"[a-z]\d[a-z]", name) is not None
        has_bait_word = "-" in name and any(
            word in name for word in ScenarioParser.SENDER_BAIT_WORDS
        )
        if has_swapped_digit or has_bait_word or site.endswith(UNUSUAL_ENDINGS):
            return True

        display = ScenarioParser.sender_display_name(sender)
        # The name shown is itself an address, or a web domain, that is not where the email came from
        shown_address = re.search(ScenarioParser.EMAIL_REGEX, display)
        if shown_address and shown_address.group(0).lower() != address.lower():
            return True
        shown_domain = re.fullmatch(r"(?:[a-z0-9-]+\.)+[a-z]{2,}", display.lower())
        if not shown_address and shown_domain and site_of(shown_domain.group(0)) != site:
            return True
        brand = brand_named_in(display) or brand_named_in(mailbox) or brand_named_in(domain)
        return bool(brand) and site not in BRANDS[brand]

    @staticmethod
    def decode_header_text(value):
        """Decode an email header written in MIME words ("=?utf-8?Q?Support?=" -> "Support")."""
        if "=?" not in (value or ""):
            return value or ""
        try:
            return str(make_header(decode_header(value)))
        except (ValueError, LookupError, UnicodeError):
            return value

    @staticmethod
    def normalise_sender(sender):
        """One way of writing a sender, "Display Name <address>", whatever the dataset used:
        '"Name" <a@b.com>', 'a@b.com (Name)', '=?utf-8?Q?Name?= <a@b.com>' or a bare address."""
        sender = " ".join(ScenarioParser.decode_header_text(sender).split())
        name, address = "", sender
        bracketed = re.fullmatch(r"(.*?)\s*<([^<>\s]+@[^<>\s]+)>", sender)
        trailing_name = re.fullmatch(r"([^\s<>()\"]+@[^\s<>()\"]+)\s*\((.*)\)", sender)
        if bracketed:
            name, address = bracketed.groups()
        elif trailing_name:
            address, name = trailing_name.groups()
        name = name.strip().strip("\"'").strip()
        if not name or name.lower() == address.lower():
            return address
        return f"{name} <{address}>"

    # The line a message is signed off with, above the sender's name ("Best,", "Kind regards,")
    SIGN_OFFS = {
        "best", "best regards", "kind regards", "regards", "warm regards", "sincerely", "yours sincerely",
        "yours faithfully", "yours truly", "thanks", "thank you", "many thanks", "cheers", "respectfully",
        "all the best", "take care", "with thanks",
    }
    # A person's or team's name: one to four capitalised words ("Alex Singh", "Security Team", "IT Desk")
    SIGNATURE_NAME = re.compile(r"[A-Z][\w'&.-]*(?: [A-Z][\w'&.-]*){0,3}")

    @staticmethod
    def sender_from_signature(message):
        """Who an email says it is from, read from its signature, for datasets with no sender column:
        "Alex Singh" from "Best,\\nAlex Singh", or the team from "Security Team,\\nCameron Nguyen", since that
        is how the message presents itself. "" when the message does not end with a clear signature.
        The same rule applies to phishing and genuine messages, and it only uses text the player can read."""
        lines = [line.strip() for line in (message or "").strip().split("\n") if line.strip()]
        if len(lines) < 3:
            return ""
        name, above = lines[-1], lines[-2]
        sign_off = above.rstrip(",").strip()
        if len(name) > 40 or not ScenarioParser.SIGNATURE_NAME.fullmatch(name):
            return ""
        if sign_off.lower() in ScenarioParser.SIGN_OFFS:
            return name
        if above.endswith(",") and len(sign_off) <= 40 and ScenarioParser.SIGNATURE_NAME.fullmatch(sign_off):
            return sign_off
        return ""

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
    def infer_difficulty(cues, is_phishing):
        """How hard a message is to judge, from its clues: obvious phishing (many clues) is Easy and subtle
        phishing Hard; a genuine message is harder the more it looks suspicious. A dataset's own "severity"
        column is not used: it rates how dangerous a threat is, not how hard it is to spot."""
        if is_phishing:
            if len(cues) >= 3:
                difficulty = "Easy"
            elif len(cues) == 2:
                difficulty = "Medium"
            else:
                difficulty = "Hard"
        else:
            difficulty = "Hard" if len(cues) >= 2 else "Medium" if cues else "Easy"
        return difficulty

    # Made-up addresses the importer writes in (e.g. you@example.com) are not anyone's personal data
    MADE_UP_DOMAINS = ("example.com", "example.org", "example.net", "example.test", "phishsimulator.test")

    # Numbers that belong to organisations, not people: South African toll-free (0800) and share-call (0860,
    # 0861), with or without +27, and UK free, non-geographic and premium-rate numbers (0808, 0843-0845,
    # 0870-0873, 0901-0909), common in public SMS scam datasets ("Call 09061701461 to claim")
    ORGANISATION_NUMBERS = (
        "0800", "0860", "0861", "27800", "27860", "27861",
        "0808", "0843", "0844", "0845", "0870", "0871", "0872", "0873",
        "0901", "0904", "0905", "0906", "0907", "0908", "0909",
    )

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
            "1", "true", "phishing", "phish", "smishing", "malicious", "fraud", "phishing email",
        }:
            return "PHISHING"
        if normalized in {"0", "false", "legitimate", "legit", "safe", "ham", "benign", "safe email"}:
            return "LEGITIMATE"
        # "spam" stays unlabelled on purpose: unwanted marketing is not the same as phishing
        return None

    EMPTY_VALUES = {"", "nan", "none", "null", "yes", "no"}

    # Datasets that label phishing and spam in separate columns ("message,spam label,smishing label")
    PHISHING_FLAG_COLUMNS = ("smishing label", "phishing label", "smishing", "is_smishing")
    SPAM_FLAG_COLUMNS = ("spam label", "is_spam")

    @staticmethod
    def label_of(row):
        """PHISHING, LEGITIMATE or None for a row (keys already lower case). A phishing or smishing column decides
        when there is one; a message it clears that the spam column marks as spam stays unlabelled, since
        marketing is neither phishing nor a message to practise trusting. Otherwise the usual label columns."""
        flag = ScenarioParser._value(row, *ScenarioParser.PHISHING_FLAG_COLUMNS)
        if flag:
            label = ScenarioParser.normalize_label(flag)
            spam = ScenarioParser.normalize_label(ScenarioParser._value(row, *ScenarioParser.SPAM_FLAG_COLUMNS))
            return None if label == "LEGITIMATE" and spam == "PHISHING" else label
        return ScenarioParser.normalize_label(
            ScenarioParser._value(
                row, "label", "class", "is_phishing", "correct_answer", "email type", "v1", "spam", "category",
            )
        )

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
    def category_scores(text, strong_only=False):
        """How strongly a piece of text points at each category (see CATEGORY_KEYWORDS)."""
        lower = (text or "").lower()
        scores = {}
        for category, (strong, weak) in ScenarioParser.CATEGORY_KEYWORDS.items():
            scores[category] = 2 * sum(contains_word(lower, word) for word in strong)
            if not strong_only:
                scores[category] += sum(contains_word(lower, word) for word in weak)
        if not strong_only and ScenarioParser.MONEY_AMOUNT.search(lower):
            scores["Banking & Money"] += 1
        return scores

    @staticmethod
    def infer_category(message, subject=""):
        """The training category a message is about, from its own words (a strong word in the subject counts
        twice: "Your parcel is waiting" names the topic, "Meeting follow-up" does not).
        A dataset's "phishing type" column is never used: only phishing rows have one, so it would sort
        phishing and genuine messages by different rules, and the category would give the answer away."""
        scores = ScenarioParser.category_scores(f"{subject} {message}")
        for category, score in ScenarioParser.category_scores(subject, strong_only=True).items():
            scores[category] += score
        best = max(scores, key=scores.get)  # ties go to the category listed first
        if scores[best] >= ScenarioParser.MIN_CATEGORY_SCORE:
            return best
        # No clear topic: "General" (an everyday message, not a phishing type) rather than a real category
        # such as Social Media, which a meeting note or a "how are you" text is not
        return ScenarioParser.GENERAL_CATEGORY

    @staticmethod
    def derive_fields(channel, sender, subject, message, is_phishing):
        """What the importer works out from a message, for a new row or when re-processing a draft:
        the sender (from the signature when the dataset has none), the category, the warning signs and
        the difficulty. Uses only what the player can see, the same way for phishing and genuine messages."""
        if channel.upper() == "EMAIL" and not sender:
            sender = ScenarioParser.sender_from_signature(message)
        # Message first, so that a greeting can be checked at its start ("Account holder, ...")
        cues = ScenarioParser.extract_cues(f"{message}\n{subject}", sender)
        return {
            "sender": sender,
            "category": ScenarioParser.infer_category(message, subject),
            "phishing_cues": cues,
            "difficulty": ScenarioParser.infer_difficulty(cues, is_phishing),
        }

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

    # Lines some generated datasets add to every phishing message (the prompt's words), never part of an email.
    # Left in, they give the answer away, so the importer removes them.
    GENERATOR_LINES = re.compile(r"(?im)^[ \t]*keywords[ \t]*:.*(?:\n|$)")
    # A "Subject:" header on its own first line, with the body below it
    INLINE_SUBJECT = re.compile(r"\A\s*subject[ \t]*:[ \t]*([^\n]*?)[ \t]*\n", re.IGNORECASE)
    GREETING = re.compile(
        r"^(?:(?:hello|hi|hey|dear|greetings|good (?:morning|afternoon|evening))\b[^,.!:\n]{0,40}[,.!:]?|"
        r"(?:attention|notice|important|urgent|reminder|alert|warning)\s*[,.!:])\s*",
        re.IGNORECASE,
    )
    SUBJECT_LENGTH = 70

    @staticmethod
    def clean_generated_text(subject, message, keep_subject=True):
        """Remove dataset artefacts from a message: generator "Keywords:" lines, and a "Subject:" header line
        written above the body (moved into the subject when the row has none, unless keep_subject is False,
        as for SMS). A one-line message that merely starts with "Subject:" is left alone. Returns (subject, message)."""
        cleaned = ScenarioParser.GENERATOR_LINES.sub("", message)
        inline = ScenarioParser.INLINE_SUBJECT.match(cleaned)
        if inline and cleaned[inline.end():].strip():
            if not subject and keep_subject:
                subject = inline.group(1)
            cleaned = cleaned[inline.end():]
        if cleaned == message:
            return subject, message  # nothing removed: the text is left exactly as the dataset had it
        return subject, re.sub(r"\n{3,}", "\n\n", cleaned).strip()

    @staticmethod
    def subject_from_text(message):
        """A plausible subject line for an email that has none: its first sentence without the greeting,
        cut at a word boundary. Used so that no kind of message is given away by lacking a subject."""
        first = re.split(r"(?<=[.!?])\s|\n", message.strip(), maxsplit=1)[0]
        first = ScenarioParser.GREETING.sub("", first).strip(" .!?,;:-")
        if len(first) > ScenarioParser.SUBJECT_LENGTH:
            first = first[:ScenarioParser.SUBJECT_LENGTH].rsplit(" ", 1)[0].rstrip(" ,;:-")
        return first[:1].upper() + first[1:] if first else ""

    @staticmethod
    def parse_row(row, dataset_type="EMAIL"):
        """Convert one dataset row into a processed record, or None if unusable."""
        row = {str(key).strip().lower(): value for key, value in row.items()}

        sender = ScenarioParser.normalise_sender(ScenarioParser._value(row, "sender", "from", "email_from"))
        subject = ScenarioParser.decode_header_text(ScenarioParser._value(row, "subject", "title"))
        message = ScenarioParser._value(
            row, "body", "content", "text", "email_body", "message", "text_combined",
            "email text", "v2", "sms",
        )
        if not message:
            return None

        subject, message = ScenarioParser.clean_generated_text(
            subject, message, keep_subject=dataset_type.upper() == "EMAIL",
        )
        if not message:
            return None
        message = ScenarioParser.drop_repeated_text(message)
        receiver = ScenarioParser._value(row, "receiver", "to")
        subject = ScenarioParser.anonymise_recipient(subject, receiver)
        message = ScenarioParser.anonymise_recipient(message, receiver)
        # Phishing often shows the victim's own domain as its name ("monkey.org <noreply@aegfuels.co>")
        sender = ScenarioParser.anonymise_recipient(sender, receiver)

        # Email headers can be folded over several lines; keep them on one line and
        # within the 255-character database columns
        sender = " ".join(sender.split())[:255]
        subject = " ".join(subject.split())[:255]

        # An email without a subject gets one from its first sentence (marked, so the channel check ignores it)
        subject_from_text = False
        if dataset_type.upper() == "EMAIL" and not subject:
            subject = ScenarioParser.subject_from_text(message)
            subject_from_text = bool(subject)

        label = ScenarioParser.label_of(row)
        fields =ScenarioParser.derive_fields(dataset_type, sender, subject, message, label == "PHISHING")

        return {
            "message_type": dataset_type.upper(),
            "sender": fields["sender"][:255],
            "subject": subject,
            "message": message,
            "difficulty": fields["difficulty"],
            "phishing_cues": fields["phishing_cues"],
            "category": fields["category"],
            "label": label,
            "subject_from_text": subject_from_text,
        }
