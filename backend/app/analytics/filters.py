# Filters for the metrics pages: a date range plus channel, difficulty, category, source and group

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func, select

from app.enums.occupation import Occupation
from app.extensions import db
from app.models.authentication import Player, UserProfile
from app.models.scenario import Scenario
from app.models.simulation import SimulationAttempt
from app.utils.clock import local_date, local_today, utc_start_of

# Quick date ranges the pages offer, in days
RANGE_DAYS = {"7d": 7, "30d": 30, "90d": 90}
CHANNELS = ("EMAIL", "SMS")
DIFFICULTIES = ("Easy", "Medium", "Hard")
SOURCES = ("TRAINING", "CAMPAIGN")
GROUPS = tuple(occupation.name for occupation in Occupation)
# The daily chart never draws more than a year, so "All time" stays readable
MAX_CHART_DAYS = 365


def _pick(value, allowed):
    """The allowed value that matches (in any case), or "" when there is none."""
    value = (value or "").strip().lower()
    return next((option for option in allowed if option.lower() == value), "")


def _date(value):
    """A YYYY-MM-DD date, or None when it is missing or not a real date."""
    try:
        return date.fromisoformat(value) if value else None
    except ValueError:
        return None


@dataclass
class MetricFilters:
    """What a metrics page is narrowed to. An empty value means "everything"."""
    start: date | None = None
    end: date | None = None
    channel: str = ""
    difficulty: str = ""
    category: str = ""
    source: str = ""
    group: str = ""

    @classmethod
    def from_args(cls, args, today=None):
        """Read the filters from the URL. Unknown values are ignored, so a bad link shows everything."""
        start, end = _date(args.get("start")), _date(args.get("end"))
        days = RANGE_DAYS.get(args.get("range", ""))
        if days:
            end = today or local_today()
            start = end - timedelta(days=days - 1)
        if start and end and start > end:
            start, end = end, start
        return cls(
            start=start,
            end=end,
            channel=_pick(args.get("channel"), CHANNELS),
            difficulty=_pick(args.get("difficulty"), DIFFICULTIES),
            category=(args.get("category") or "").strip()[:100],
            source=_pick(args.get("source"), SOURCES),
            group=_pick(args.get("group"), GROUPS),
        )

    def is_set(self):
        """True when at least one filter narrows the data."""
        return any((self.start, self.end, self.channel, self.difficulty, self.category, self.source, self.group))

    def in_range(self, column):
        """Conditions that keep a timestamp column inside the chosen (local) dates."""
        conditions = []
        if self.start:
            conditions.append(column >= utc_start_of(self.start))
        if self.end:
            conditions.append(column < utc_start_of(self.end + timedelta(days=1)))
        return conditions

    def group_players(self):
        """The player ids in the chosen group (students, employees or other)."""
        return select(UserProfile.player_id).where(UserProfile.occupation == Occupation[self.group])

    def group_users(self):
        """The user ids in the chosen group."""
        return select(Player.user_id).where(Player.player_id.in_(self.group_players()))

    def apply(self, query):
        """Narrow a SimulationAttempt query to these filters."""
        query = query.filter(*self.in_range(SimulationAttempt.attempted_at))
        if self.channel:
            query = query.filter(func.upper(SimulationAttempt.simulation_type) == self.channel)
        if self.difficulty:
            query = query.filter(func.lower(SimulationAttempt.difficulty) == self.difficulty.lower())
        if self.category:
            query = query.filter(SimulationAttempt.scenario_id.in_(
                select(Scenario.scenario_id).where(Scenario.category == self.category)
            ))
        if self.source == "CAMPAIGN":
            query = query.filter(SimulationAttempt.campaign_recipient_id.is_not(None))
        elif self.source == "TRAINING":
            query = query.filter(SimulationAttempt.campaign_recipient_id.is_(None))
        if self.group:
            query = query.filter(SimulationAttempt.player_id.in_(self.group_players()))
        return query

    def chart_window(self, attempts, today=None):
        """(days, last day) for the trend charts: the chosen dates, or from the first attempt to today."""
        end = self.end or today or local_today()
        first_attempt = min((local_date(attempt.attempted_at) for attempt in attempts), default=end - timedelta(days=13))
        start = self.start or first_attempt
        days = min(max((end - start).days + 1, 1), MAX_CHART_DAYS)
        return days, end


def category_options():
    """Every scenario category, for the category dropdown."""
    return sorted(category for (category,) in db.session.query(Scenario.category).distinct() if category)
