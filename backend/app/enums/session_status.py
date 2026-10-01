# States of a login session

from enum import Enum

class SessionStatus(Enum):
    """States of a login session."""
    ACTIVE = "ACTIVE"
    LOGGED_OUT = "LOGGED_OUT"
    EXPIRED = "EXPIRED"