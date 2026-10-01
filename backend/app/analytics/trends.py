# Turns attempts into chart data: daily activity, error trends, learning curve and categories

from datetime import datetime, timedelta, timezone


def _rate(part, whole):
    """Percentage, or None when there is nothing to divide by (the chart leaves a gap)."""
    return round(part / whole * 100) if whole else None


def _missed_phishing(attempt):
    """True when a phishing message was marked safe."""
    return not attempt.correct and attempt.player_answer.upper() == "SAFE"


def _false_alarm(attempt):
    """True when a safe message was reported."""
    return not attempt.correct and attempt.player_answer.upper() == "REPORT"


def _today():
    """Today's date in UTC, the same clock the attempts are stored in."""
    return datetime.now(timezone.utc).date()


def daily(attempts, days, new_users=None, today=None):
    """One row per day for the last `days` days: decisions and accuracy."""
    today = today or _today()
    by_day = {}
    for attempt in attempts:
        by_day.setdefault(attempt.attempted_at.date(), []).append(attempt)

    rows = []
    for offset in range(days - 1, -1, -1):
        day = today - timedelta(days=offset)
        day_attempts = by_day.get(day, [])
        row = {
            "label": day.strftime("%d %b"),
            "decisions": len(day_attempts),
            "accuracy": _rate(sum(a.correct for a in day_attempts), len(day_attempts)),
        }
        if new_users is not None:
            row["new_users"] = new_users.get(day, 0)
        rows.append(row)
    return rows


def weekly_errors(attempts, weeks, today=None):
    """Accuracy, missed-phishing and false-alarm rates for each of the last `weeks` weeks."""
    today = today or _today()
    this_monday = today - timedelta(days=today.weekday())

    rows = []
    for offset in range(weeks - 1, -1, -1):
        week_start = this_monday - timedelta(weeks=offset)
        week_end = week_start + timedelta(days=7)
        week = [a for a in attempts if week_start <= a.attempted_at.date() < week_end]
        rows.append({
            "label": week_start.strftime("%d %b"),
            "decisions": len(week),
            "accuracy": _rate(sum(a.correct for a in week), len(week)),
            "missed_phishing": _rate(sum(_missed_phishing(a) for a in week), len(week)),
            "false_alarms": _rate(sum(_false_alarm(a) for a in week), len(week)),
        })
    return rows


def learning_curve(attempts, window=5, limit=60):
    """Rolling accuracy over the player's last `limit` decisions, oldest first."""
    ordered = sorted(attempts, key=lambda a: a.attempted_at)
    first_number = max(len(ordered) - limit, 0)

    points = []
    for index in range(first_number, len(ordered)):
        recent = ordered[max(0, index - window + 1):index + 1]
        points.append({
            "decision": index + 1,
            "accuracy": _rate(sum(a.correct for a in recent), len(recent)),
        })
    return points


def by_category(attempts, categories):
    """Decisions and accuracy per category. `categories` maps scenario_id to its category."""
    totals = {}
    for attempt in attempts:
        name = categories.get(attempt.scenario_id) or "Other"
        row = totals.setdefault(name, {"category": name, "decisions": 0, "correct": 0})
        row["decisions"] += 1
        row["correct"] += int(attempt.correct)

    rows = [{**row, "accuracy": _rate(row["correct"], row["decisions"])} for row in totals.values()]
    return sorted(rows, key=lambda row: row["decisions"], reverse=True)


def by_difficulty(attempts):
    """Decisions and accuracy for Easy, Medium and Hard."""
    rows = []
    for level in ("Easy", "Medium", "Hard"):
        level_attempts = [a for a in attempts if (a.difficulty or "").capitalize() == level]
        rows.append({
            "difficulty": level,
            "decisions": len(level_attempts),
            "accuracy": _rate(sum(a.correct for a in level_attempts), len(level_attempts)),
        })
    return rows


def by_channel(attempts):
    """Decisions, correct answers and accuracy for email and for SMS."""
    rows = []
    for channel in ("EMAIL", "SMS"):
        channel_attempts = [a for a in attempts if a.simulation_type.upper() == channel]
        correct = sum(a.correct for a in channel_attempts)
        rows.append({
            "type": channel,
            "attempts": len(channel_attempts),
            "correct": correct,
            "accuracy": _rate(correct, len(channel_attempts)) or 0,
        })
    return rows
