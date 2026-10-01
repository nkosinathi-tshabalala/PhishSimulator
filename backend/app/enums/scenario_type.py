# Message channels: email or SMS

from enum import Enum


class ScenarioType(Enum):
    """The two message channels."""
    EMAIL = "EMAIL"
    SMS = "SMS"
