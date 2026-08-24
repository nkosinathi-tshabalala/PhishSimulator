from enum import Enum


class DeliveryStatus(Enum):
    """State of an outbound email dispatch attempt."""

    NOT_CONFIGURED = "NOT_CONFIGURED"
    PENDING = "PENDING"
    SENT = "SENT"
    FAILED = "FAILED"
