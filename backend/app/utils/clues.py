# Clue catalog: warning signs and trust signals, with keywords for typed reasons

import re
from random import Random


WARNING_SIGNS = {
    "Suspicious link": (
        r"\blinks?\b", r"\burls?\b", r"https?", r"\bwebsite\b", r"\bdomain\b", r"\bclick",
    ),
    "Urgency": (
        r"\burgen", r"\bimmediate", r"\bhours?\b", r"\bdeadline", r"\bexpir",
        r"\bhurry", r"\bpressure", r"\bright now\b", r"\basap\b",
    ),
    "Credential request": (
        r"\bpassword", r"\blog ?in\b", r"\bcredential", r"\busername", r"\bpin\b",
        r"\botp\b", r"\bsign in\b", r"\bbank details\b", r"\bpersonal (info|details)",
    ),
    "Fake sender": (
        r"\bsender\b", r"\bfrom address\b", r"\bspoof", r"\bfake\b", r"\bimpersonat",
        r"\bmisspel", r"\blook-?alike\b", r"\bnot (really )?from\b",
    ),
    "Generic greeting": (
        r"\bdear (customer|user|member|client)\b", r"\bgeneric\b", r"\bgreeting\b",
        r"\bno name\b",
    ),
    "Too good to be true": (
        r"\bprize", r"\bwon\b", r"\bwinner", r"\breward", r"\bfree\b", r"\bgift",
        r"\blottery", r"\bcash\b", r"\btoo good\b",
    ),
    "Threat or penalty": (
        r"\blocked\b", r"\bsuspend", r"\bclosed?\b", r"\bpenalt", r"\bfine\b",
        r"\blegal\b", r"\barrest", r"\bblocked\b", r"\bthreat",
    ),
    "Unexpected attachment": (
        r"\battach", r"\bdownload", r"\bopen the file\b", r"\.zip\b", r"\.exe\b",
        r"\.htm", r"\.docm\b", r"\.iso\b",
    ),
}

TRUST_SIGNALS = {
    "Known sender": (
        r"\bknown\b", r"\btrusted\b", r"\bofficial\b", r"\brecogni[sz]e", r"\bexpected sender\b",
        r"\bgenuine\b", r"\blegit",
    ),
    "No personal info requested": (
        r"\bno (password|login|personal|details)", r"\bdoes(n't| not) ask\b",
        r"\bnot asking\b", r"\bnothing (is )?requested\b",
    ),
    "No pressure to act": (
        r"\bno (urgency|pressure|deadline|rush)\b", r"\bcalm\b", r"\bnot urgent\b",
    ),
    "Expected context": (
        r"\bexpected\b", r"\bcontext\b", r"\broutine\b", r"\bnormal\b", r"\bmakes sense\b",
        r"\brelevant\b",
    ),
}

LEGACY_NAMES = {
    "suspicious url": "Suspicious link",
    "credential request": "Credential request",
    "urgent language": "Urgency",
}

CLUE_TIPS = {
    "Suspicious link": "Hover over a link before you click: the button text can hide a different address.",
    "Urgency": "Pressure to act fast is a classic trick. Pause and verify first.",
    "Credential request": "Real organisations never ask for your password by email or SMS.",
    "Fake sender": "Open the sender details: a trusted display name can hide a look-alike address.",
    "Generic greeting": "'Dear customer' suggests a mass message, not one meant for you.",
    "Too good to be true": "Unexpected prizes and rewards are bait. You can't win what you didn't enter.",
    "Threat or penalty": "Threats of locked accounts or fines are designed to scare you into acting.",
    "Unexpected attachment": (
        "Don't open files you weren't expecting. .htm, .zip, .docm and .iso files are favourite traps."
    ),
    "Known sender": "The sender matches an organisation you actually deal with.",
    "No personal info requested": "The message doesn't ask for passwords, PINs or payment details.",
    "No pressure to act": "There is no artificial deadline or threat.",
    "Expected context": "The message fits something you were expecting.",
}

# Words and phrases that show a warning sign in a message, matched as whole words in lower case. Every form of
# a word is listed ("expire", "expires"...), since "expire" does not match inside "expires".
MESSAGE_KEYWORDS = {
    "Urgency": (
        "urgent", "urgently", "immediately", "immediate action", "immediate attention", "immediate response",
        "within 24 hours", "within 48 hours", "within 12 hours", "24 hours", "48 hours",
        "act now", "act fast", "act quickly", "respond now", "reply now", "respond asap", "asap",
        "as soon as possible", "right away", "without delay", "do not delay", "don't wait", "don't miss",
        "expire", "expires", "expired", "expiring", "expiration", "limited time", "time sensitive",
        "time-sensitive", "action required", "action is required", "required action", "today only",
        "ends soon", "ends today", "last chance", "final notice", "final warning", "final reminder",
        "deadline", "before midnight", "expires midnight", "hurry", "promptly", "call now", "txt now",
        "text now", "claim now", "emergency",
    ),
    "Credential request": (
        "password", "passwords", "passcode", "login", "log in", "log-in", "sign in", "sign-in", "username",
        "user name", "verify your account", "verify your identity", "verify your email", "verify your information",
        "verify your details", "verify your username", "validate your", "confirm your identity",
        "confirm your account", "confirm your details", "confirm your information", "update your information",
        "update your informations", "update your details", "update your account", "re-confirm", "reconfirm",
        "pin", "otp", "one-time pin", "2fa", "verification code", "security code", "security question",
        "recovery key", "bank details", "banking details", "card details", "card number", "cvv",
        "account number", "routing number", "social security number", "ssn", "id number",
        "personal information", "personal details", "date of birth",
    ),
    "Generic greeting": (
        "dear customer", "dear customers", "dear user", "dear member", "dear client", "valued customer",
        "valued member", "dear valued", "dear account holder", "dear sir", "dear madam", "dear sir/madam",
        "dear sir or madam", "dear friend", "dear beneficiary", "dear subscriber", "dear email user",
        "dear webmail user", "dear applicant", "dear winner", "dear recipient", "hello user",
    ),
    "Too good to be true": (
        "congratulations", "you have won", "you've won", "you won", "you ve won", "u have won", "ur awarded",
        "you are awarded", "you have been awarded", "you have been selected", "you've been selected",
        "selected recipient", "winner", "prize", "free gift", "gift card", "cashback", "await collection",
        "claim your", "claim now", "to claim", "lottery", "jackpot", "reward", "cash prize", "100% free", "risk free",
        "risk-free", "guaranteed", "double your", "investment opportunity", "inheritance", "next of kin",
        "business proposal", "strictly confidential", "huge profit", "easy money", "earn money", "make money",
    ),
    "Threat or penalty": (
        "suspend", "suspended", "suspension", "locked", "terminate", "terminated", "termination",
        "legal action", "penalty", "penalties", "fined", "will be closed", "be closed", "blocked", "block your",
        "will block", "deactivate", "deactivated", "deactivation", "restricted", "restriction", "disabled",
        "restrict your", "freeze your", "frozen", "seize your", "seized", "to court", "will be limited",
        "access will be limited", "avoid interruption", "interruption of service", "service interruption",
        "will be deleted", "permanently deleted", "lose access", "loss of access", "on hold", "hold on your",
        "prosecution", "prosecuted", "arrest", "arrested", "warrant", "court order", "taken to court",
        "lawsuit", "failure to", "will result in", "may result in", "will lead to", "will be denied",
        "shutdown", "shut down", "debt collector", "blacklisted", "criminal", "prison", "the judge",
        # Scares about the reader's device or account, to rush them into installing or signing in
        "infected", "infection", "malware", "virus detected", "has been compromised", "been hacked",
        "data breach",
    ),
    "Unexpected attachment": (
        "see attached", "attached", "attachment", "attachments", "open the file", "open the attached",
        "find attached", "enclosed", "download the", "zip file",
    ),
}

# Warning signs that need a pattern rather than a word list
MESSAGE_PATTERNS = {
    "Generic greeting": (
        # Opens without anyone's name: "Account holder, ...", "Attention: ...", "Notice, ..."
        re.compile(r"\A\s*(?:account holder|attention|notice|hello user|hi user)\s*[,:!]"),
        # Greets an email address instead of a person: "Hi you@example.com", "Dear jo@mail.com,"
        re.compile(r"\b(?:dear|hello|hi)\s+[\w.+-]+@[\w-]+\.[\w.]+"),
    ),
    "Too good to be true": (
        # Millions on offer: "$25 million", "US$ 10.5M", "15 million dollars"
        re.compile(r"(?:[$€£₹]|\b(?:usd|us\$|eur|gbp)\s?)\s?\d[\d,.]*\s?(?:million|m)\b"
                   r"|\b\d[\d,.]*\s?million\s(?:dollars|usd|euros?|pounds|rand)\b"),
        # Text-speak claims: "Now toClaim", "2 claim"
        re.compile(r"\b(?:to|2)\s?claim\b"),
    ),
    "Threat or penalty": (
        # A fine, but not "I'm fine": "avoid a fine", "a fine of R500", "pay the fine", "traffic fine"
        re.compile(r"\b(?:avoid (?:a |the |any )?fines?|a fine of|pay (?:the|a|your) fine|traffic fine|be fined)\b"),
    ),
    "Unexpected attachment": (
        re.compile(r"\.(?:zip|exe|htm|html|docm|xlsm|iso|scr|js)\b"),
    ),
}

OPTIONS_PER_GROUP = 3


def normalise_clue(name):
    """Map a stored cue name onto the catalog name used by the game."""
    cleaned = str(name or "").strip()
    return LEGACY_NAMES.get(cleaned.lower(), cleaned)


def contains_word(text, phrase):
    """True when `phrase` appears in `text` as whole words."""
    # A plain substring check first: most keywords are absent, and skipping the regex for them makes
    # large dataset imports many times faster. The result is the same, since a whole-word match needs
    # the substring to be there.
    if phrase not in text:
        return False
    return re.search(rf"(?<!\w){re.escape(phrase)}(?!\w)", text) is not None


def detect_message_signs(text):
    """Return the keyword-based warning signs found in a message."""
    lowered = text.lower()
    return [
        clue for clue, keywords in MESSAGE_KEYWORDS.items()
        if any(contains_word(lowered, keyword) for keyword in keywords)
        or any(pattern.search(lowered) for pattern in MESSAGE_PATTERNS.get(clue, ()))
    ]


def real_clues(scenario):
    """Return the clues that genuinely apply to a scenario."""
    stored = [normalise_clue(cue) for cue in scenario.get_phishing_cues()]

    if scenario.correct_answer.upper() == "REPORT":
        return [cue for cue in dict.fromkeys(stored) if cue in WARNING_SIGNS]

    # "Known sender" only when the message shows one: many datasets have no sender, and the player then
    # sees "Unknown sender" or "Unknown number", which is no reason to trust it
    signals = ["Known sender"] if (getattr(scenario, "sender", "") or "").strip() else []
    if "Credential request" not in stored:
        signals.append("No personal info requested")
    if "Urgency" not in stored and "Threat or penalty" not in stored:
        signals.append("No pressure to act")
    signals.append("Expected context")
    return signals


def _pick_group(rng, group, real):
    """Choose 3 names from one group, putting the real clues in first."""
    real_in_group = [name for name in group if name in real]
    others = [name for name in group if name not in real]
    rng.shuffle(real_in_group)
    rng.shuffle(others)
    return (real_in_group + others)[:OPTIONS_PER_GROUP]


def clue_options(scenario):
    """Six clue buttons: 3 warning signs and 3 trust signals, real ones included."""
    rng = Random(scenario.scenario_id)
    real = real_clues(scenario)
    options = _pick_group(rng, list(WARNING_SIGNS), real) + _pick_group(rng, list(TRUST_SIGNALS), real)
    rng.shuffle(options)
    return options


def match_reason(text):
    """Return the catalog clues whose keywords appear in a free-text reason."""
    lowered = str(text or "").lower()
    matched = []
    for name, patterns in {**WARNING_SIGNS, **TRUST_SIGNALS}.items():
        if any(re.search(pattern, lowered) for pattern in patterns):
            matched.append(name)
    return matched


def evaluate_justification(scenario, selected_clues, reason_text):
    """Compare the player's reasons with the scenario's real clues."""
    real = real_clues(scenario)
    offered = clue_options(scenario)
    targets = [clue for clue in real if clue in offered]
    selected = [clue for clue in dict.fromkeys(selected_clues or []) if clue in offered]
    from_text = match_reason(reason_text)

    spotted = [clue for clue in real if clue in selected or clue in from_text]
    missed = [clue for clue in targets if clue not in spotted]
    also_present = [clue for clue in real if clue not in targets and clue not in spotted]
    wrong_picks = [clue for clue in selected if clue not in real]

    net_found = max(len(spotted) - len(wrong_picks), 0)
    net_targets = max(len([c for c in targets if c in spotted]) - len(wrong_picks), 0)
    score = round(net_targets / len(targets) * 100) if targets else 100
    return {
        "real": real,
        "spotted": spotted,
        "missed": missed,
        "also_present": also_present,
        "wrong_picks": wrong_picks,
        "net_found": net_found,
        "score": score,
    }
