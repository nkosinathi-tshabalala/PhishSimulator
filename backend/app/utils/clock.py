# Local time: timestamps are stored in UTC, but a "day" (streaks, daily goal, calendar, charts, date
# filters) is the learner's local day. APP_UTC_OFFSET_HOURS sets it; South Africa (+2) has no daylight saving.

import os
from datetime import datetime, time, timedelta, timezone

UTC_OFFSET = timedelta(hours=float(os.getenv("APP_UTC_OFFSET_HOURS", "2")))


def utc_now():
    """The current UTC time, without a time zone, in the same form the database stores."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def local_date(moment):
    """The local calendar day of a stored UTC timestamp."""
    return (moment + UTC_OFFSET).date()


def local_today():
    """Today's local date."""
    return local_date(utc_now())


def utc_start_of(day):
    """The stored UTC moment at which a local day begins (local midnight)."""
    return datetime.combine(day, time.min) - UTC_OFFSET


def iso_utc(moment):
    """A stored UTC timestamp as ISO text ending in Z, so the browser shows it in the viewer's own time."""
    return moment.isoformat() + "Z" if moment else None
