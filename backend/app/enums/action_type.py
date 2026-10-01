# Risky actions a player can take on a message

from enum import Enum


class ActionType(Enum):
    """A learner's response to a simulated scenario."""

    REPORT = "REPORT"
    SAFE = "SAFE"
