# User roles: admin or player

from enum import Enum


class Role(Enum):
    """User roles."""
    ADMIN = "ADMIN"
    PLAYER = "PLAYER"
