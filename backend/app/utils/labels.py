# Short names for messages, taken from the message itself so they never reveal it is a test

import re

# Older dataset imports titled scenarios "EMAIL training: ..." or "SMS training: ..."
LEGACY_TITLE_PREFIX = re.compile(r"^(EMAIL|SMS) training:\s*", re.IGNORECASE)


def message_label(subject, message, limit=60):
    """A short name for a message from its own words: the subject, else the first words of the text."""
    text = re.sub(r"\s+", " ", str(subject or message or "")).strip()
    return text if len(text) <= limit else text[:limit].rstrip() + "…"
