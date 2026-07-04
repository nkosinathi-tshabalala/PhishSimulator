from enum import Enum

class SessionStatus(Enum):
    ACTIVE = "ACTIVE"
    LOGGED_OUT = "LOGGED_OUT"
    EXPIRED = "EXPIRED"