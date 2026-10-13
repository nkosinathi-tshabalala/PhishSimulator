# Stats for the dashboards, user monitoring and CSV export

import csv
import io
from datetime import date, timedelta, timezone
from math import ceil

from sqlalchemy import func

from app.extensions import db
from app.models.authentication import Player, User, UserSession
from app.models.analytics import FeedbackReport, PerformanceTracker
from app.models.baseline import BaselineAssessment, BaselineResponse
from app.models.datasets import Dataset
from app.models.datasets import DatasetRecord
from app.models.email import EmailCampaign, EmailCampaignRecipient
from app.models.scenario import Scenario
from app.models.simulation import SimulationAttempt, SimulationSession, UserAction
from app.adaptive.adaptive_engine import AdaptiveEngine
from app.analytics import FeedbackGenerator, trends
from app.analytics.filters import MetricFilters, category_options
from app.services.baseline_service import BaselineService
from app.services.campaign_service import CampaignService
from app.services.progress_service import ProgressService
from app.services.scenario_service import ScenarioService
from app.utils.clock import local_date, local_today, utc_start_of


# How many of the player's latest decisions My Progress lists
RECENT_LIMIT = 50


class AnalyticsService:
    """Provides platform-wide analytics for administrators."""

    @staticmethod
    def get_public_platform_summary():
        """Totals shown on the public landing page."""
        total_attempts = SimulationAttempt.query.count()
        correct_attempts = SimulationAttempt.query.filter(
            SimulationAttempt.correct.is_(True)
        ).count()

        return {
            "registered_players": Player.query.count(),
            "simulation_attempts": total_attempts,
            "platform_accuracy": round(
                (correct_attempts / total_attempts) * 100
            ) if total_attempts else 0,
        }

    @staticmethod
    def get_admin_dashboard_stats():
        """Headline numbers for the admin dashboard."""
        today_start = utc_start_of(local_today())
        total_attempts = db.session.query(func.count(SimulationAttempt.attempt_id)).scalar() or 0
        correct_attempts = (
            db.session.query(func.count(SimulationAttempt.attempt_id))
            .filter(SimulationAttempt.correct.is_(True))
            .scalar()
            or 0
        )

        accuracy = round((correct_attempts / total_attempts) * 100) if total_attempts else 0

        recent_activity = AnalyticsService._get_recent_activity()
        delivered = EmailCampaignRecipient.query.filter_by(delivery_status="SENT")
        delivered_count = delivered.count()
        clicked_count = delivered.filter(EmailCampaignRecipient.clicked_at.is_not(None)).count()
        reported_count = delivered.filter(EmailCampaignRecipient.reported_at.is_not(None)).count()

        return {
            "total_users": User.query.count(),
            "registered_players": Player.query.count(),
            "datasets": Dataset.query.count(),
            "scenarios": ScenarioService._reviewable().count(),
            "campaigns_launched": EmailCampaign.query.filter_by(status="LAUNCHED").count(),
            "campaign_emails_delivered": delivered_count,
            "campaign_click_rate": round(clicked_count / delivered_count * 100) if delivered_count else 0,
            "campaign_report_rate": round(reported_count / delivered_count * 100) if delivered_count else 0,
            "active_scenarios": Scenario.query.filter(
                func.upper(Scenario.status) == "ACTIVE"
            ).count(),
            "scenarios_awaiting_review": Scenario.query.filter(
                func.upper(Scenario.status).in_(("DRAFT", "APPROVED"))
            ).count(),
            "simulation_sessions": SimulationSession.query.count(),
            "sessions_today": SimulationSession.query.filter(
                SimulationSession.started_at >= today_start
            ).count(),
            "average_accuracy": accuracy,
            "recent_activity": recent_activity,
        }

    @staticmethod
    def get_admin_analytics(filters=None):
        """Accuracy, error rates and trends across all players, narrowed by the page filters."""
        filters = filters or MetricFilters()
        attempts = filters.apply(SimulationAttempt.query).all()
        total_attempts = len(attempts)
        correct_attempts = sum(attempt.correct for attempt in attempts)
        baselines = BaselineAssessment.query.filter(
            BaselineAssessment.completed_at.is_not(None),
            *filters.in_range(BaselineAssessment.completed_at),
        )
        active_users = db.session.query(func.count(func.distinct(UserSession.user_id))).filter(
            *filters.in_range(UserSession.login_time),
        )
        if filters.group:
            baselines = baselines.filter(BaselineAssessment.player_id.in_(filters.group_players()))
            active_users = active_users.filter(UserSession.user_id.in_(filters.group_users()))
        completed_baselines = baselines.all()
        days, last_day = filters.chart_window(attempts)
        scenario_results = {}
        for attempt in attempts:
            result = scenario_results.setdefault(
                attempt.scenario_id,
                {"attempts": 0, "correct": 0, "incorrect": 0},
            )
            result["attempts"] += 1
            result["correct"] += int(attempt.correct)
            result["incorrect"] += int(not attempt.correct)
        most_difficult = None
        if scenario_results:
            scenario_id, result = min(
                scenario_results.items(),
                key=lambda item: item[1]["correct"] / item[1]["attempts"],
            )
            scenario = db.session.get(Scenario, scenario_id)
            if scenario:
                most_difficult = {
                    "title": ScenarioService.display_title(scenario),
                    "category": scenario.category,
                    "difficulty": scenario.difficulty,
                    "success_rate": round((result["correct"] / result["attempts"]) * 100),
                    "attempts": result["attempts"],
                }
        cue_counts = {}
        for scenario_id, result in scenario_results.items():
            if not result["incorrect"]:
                continue
            scenario = db.session.get(Scenario, scenario_id)
            if scenario:
                for cue in scenario.get_phishing_cues():
                    cue_counts[cue] = cue_counts.get(cue, 0) + result["incorrect"]
        most_missed_cue = None
        if cue_counts:
            cue, missed_count = max(cue_counts.items(), key=lambda item: item[1])
            most_missed_cue = {
                "cue": cue,
                "missed_count": missed_count,
                "miss_rate": round((missed_count / total_attempts) * 100) if total_attempts else 0,
            }
        datasets = [{
            "dataset_id": dataset.dataset_id,
            "name": dataset.name,
            "records": dataset.record_count,
            "processed_records": DatasetRecord.query.filter_by(
                dataset_id=dataset.dataset_id,
                processed=True,
            ).count(),
        } for dataset in Dataset.query.order_by(Dataset.uploaded_at.desc()).all()]
        categories = AnalyticsService._scenario_categories()
        return {
            "total_simulations": total_attempts,
            "average_accuracy": round(
                (correct_attempts / total_attempts) * 100
            ) if total_attempts else 0,
            "average_baseline_score": round(
                sum(assessment.score for assessment in completed_baselines)
                / len(completed_baselines)
            ) if completed_baselines else 0,
            "active_users": active_users.scalar() or 0,
            "by_type": trends.by_channel(attempts),
            "most_difficult": most_difficult,
            "most_missed_cue": most_missed_cue,
            "datasets": datasets,
            "daily_trend": trends.daily(
                attempts, days, new_users=AnalyticsService._new_users_per_day(filters, days, last_day), today=last_day,
            ),
            "weekly_errors": trends.weekly_errors(attempts, min(ceil(days / 7), 52), today=last_day),
            "by_category": trends.by_category(attempts, categories),
            "by_difficulty": trends.by_difficulty(attempts),
            "category_options": category_options(),
        }

    @staticmethod
    def get_monitored_users():
        """Every user with their summary stats."""
        users = [
            AnalyticsService._serialize_user(user)
            for user in User.query.order_by(User.created_at.desc()).all()
        ]
        active_users = (
            db.session.query(func.count(func.distinct(UserSession.user_id)))
            .filter(UserSession.status == "ACTIVE")
            .scalar()
            or 0
        )
        total_attempts = db.session.query(func.count(SimulationAttempt.attempt_id)).scalar() or 0
        correct_attempts = (
            db.session.query(func.count(SimulationAttempt.attempt_id))
            .filter(SimulationAttempt.correct.is_(True))
            .scalar()
            or 0
        )
        average_accuracy = round((correct_attempts / total_attempts) * 100) if total_attempts else 0
        player_metrics = [user for user in users if user["role"] == "PLAYER"]
        average_simulations = round(
            sum(user["simulations"] for user in player_metrics) / len(player_metrics)
        ) if player_metrics else 0
        role_distribution = {"ADMIN": 0, "PLAYER": 0}
        performance_distribution = {"high_accuracy": 0, "needs_support": 0}

        for user in users:
            if user["role"] in role_distribution:
                role_distribution[user["role"]] += 1
            if user["role"] == "PLAYER" and user["accuracy"] >= 80:
                performance_distribution["high_accuracy"] += 1
            if user["role"] == "PLAYER" and user["accuracy"] < 60:
                performance_distribution["needs_support"] += 1

        return {
            "users": users,
            "stats": {
                "total_users": len(users),
                "total_players": len(player_metrics),
                "active_users": active_users,
                "average_accuracy": average_accuracy,
                "average_simulations": average_simulations,
            },
            "role_distribution": role_distribution,
            "performance_distribution": performance_distribution,
        }

    EXPORT_COLUMNS = (
        "Name", "Email", "Occupation", "Baseline score", "Decisions", "Accuracy %",
        "Missed phishing %", "False alarms %", "Risky clicks", "Level", "XP",
        "Badges earned", "Practice-day streak", "Last decision",
    )

    @staticmethod
    def export_player_progress_csv():
        """One row per player for tutors. The private skill rank is left out on purpose."""
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(AnalyticsService.EXPORT_COLUMNS)

        for player in Player.query.order_by(Player.full_name).all():
            performance = AnalyticsService.get_player_performance(player.user_id)
            if not performance:
                continue
            last = performance["recent_attempts"][0]["attempted_at"] if performance["recent_attempts"] else ""
            writer.writerow([
                player.full_name,
                player.user.email if player.user else "",
                player.profile.occupation.value if player.profile else "",
                performance["baseline_score"] if performance["baseline_score"] is not None else "",
                performance["total_attempts"],
                performance["overall_accuracy"],
                performance["false_negative_rate"],
                performance["false_positive_rate"],
                performance["phishing_links_clicked"] + performance["malicious_files_opened"],
                performance["level"],
                performance["xp"],
                sum(badge["earned"] for badge in performance["badges"]),
                performance["daily_streak"],
                last,
            ])
        return output.getvalue()

    @staticmethod
    def get_player_performance(user_id, filters=None):
        """Everything the player sees on Home and My Progress. The filters narrow the stats and
        charts; XP, level, badges and the adaptive difficulty always use the full history."""
        filters = filters or MetricFilters()
        player = Player.query.filter_by(user_id=user_id).first()

        if not player:
            return None

        # Campaign emails they clicked, reported or ignored count as decisions too
        CampaignService.sync_player(player)
        history = SimulationAttempt.query.filter_by(player_id=player.player_id)
        newest_first = SimulationAttempt.attempted_at.desc()
        all_attempts = history.order_by(newest_first).all()
        attempts = filters.apply(history).order_by(newest_first).all() if filters.is_set() else all_attempts
        baseline = BaselineAssessment.query.filter(
            BaselineAssessment.player_id == player.player_id,
            BaselineAssessment.completed_at.is_not(None),
        ).order_by(BaselineAssessment.completed_at.desc()).first()
        correct_attempts = sum(attempt.correct for attempt in attempts)
        total_attempts = len(attempts)
        accuracy = round((correct_attempts / total_attempts) * 100) if total_attempts else 0
        false_positives = sum(
            not attempt.correct and attempt.player_answer.upper() == "REPORT"
            for attempt in attempts
        )
        false_negatives = sum(
            not attempt.correct and attempt.player_answer.upper() == "SAFE"
            for attempt in attempts
        )
        attempt_ids = [attempt.attempt_id for attempt in attempts]
        trap_counts = dict(db.session.query(UserAction.action, func.count(UserAction.action_id)).join(
            SimulationAttempt, SimulationAttempt.attempt_id == UserAction.attempt_id,
        ).filter(
            UserAction.attempt_id.in_(attempt_ids),
            UserAction.action.in_(("CLICKED_LINK", "OPENED_ATTACHMENT")),
            SimulationAttempt.correct.is_(False),
        ).group_by(UserAction.action).all()) if attempt_ids else {}
        false_positive_rate = round((false_positives / total_attempts) * 100) if total_attempts else 0
        false_negative_rate = round((false_negatives / total_attempts) * 100) if total_attempts else 0
        difficulty, adaptive_reason = AdaptiveEngine.recommend_difficulty(
            all_attempts,
            BaselineService.starting_score(player.player_id, all_attempts),
        )
        progress = ProgressService.summary(all_attempts)
        # Private position among all players (only "#N of M", no one else's details)
        progress["skill"]["standing"] = ProgressService.standing(player.player_id)
        days, last_day = filters.chart_window(attempts)
        recent_attempts = []
        for attempt in attempts[:RECENT_LIMIT]:
            scenario = db.session.get(Scenario, attempt.scenario_id)
            recent_attempts.append({
                "scenario": ScenarioService.player_label(scenario) if scenario else "Deleted scenario",
                "type": attempt.simulation_type.upper(),
                "source": "CAMPAIGN" if attempt.campaign_recipient_id else "TRAINING",
                "correct": attempt.correct,
                "feedback": (
                    FeedbackGenerator.for_attempt(scenario, attempt.correct)
                    if scenario else "This scenario is no longer available."
                ),
                "xp_earned": attempt.score or 0,
                "clue_score": attempt.clue_score,
                "attempted_at": AnalyticsService._to_utc_isoformat(attempt.attempted_at),
            })
        return {
            "overall_accuracy": accuracy,
            "false_positives": false_positives,
            "false_positive_rate": false_positive_rate,
            "false_negatives": false_negatives,
            "false_negative_rate": false_negative_rate,
            "phishing_links_clicked": trap_counts.get("CLICKED_LINK", 0),
            "malicious_files_opened": trap_counts.get("OPENED_ATTACHMENT", 0),
            "total_attempts": total_attempts,
            # Every simulation ever completed, whatever the filters (for the stats strip)
            "completed_simulations": len(all_attempts),
            "correct_attempts": correct_attempts,
            "baseline_score": round(baseline.score) if baseline else None,
            "baseline_completed_at": AnalyticsService._to_utc_isoformat(baseline.completed_at) if baseline else None,
            # Switched-on baseline assessments for the player's role that they have not taken yet
            "new_baselines": BaselineService.count_new_for(player),
            "difficulty": difficulty,
            "adaptive_reason": adaptive_reason,
            **progress,
            "by_type": trends.by_channel(attempts),
            "recent_attempts": recent_attempts,
            "daily_trend": trends.daily(attempts, days, today=last_day),
            "weekly_errors": trends.weekly_errors(attempts, min(ceil(days / 7), 52), today=last_day),
            "learning_curve": trends.learning_curve(attempts),
            "by_category": trends.by_category(attempts, AnalyticsService._scenario_categories()),
            "category_options": category_options(),
        }

    @staticmethod
    def get_player_activity(user_id, year=None):
        """Activity per day for one year, for the calendar on My Progress: decisions in training
        and campaign emails, plus finished baseline quizzes."""
        player = Player.query.filter_by(user_id=user_id).first()
        if not player:
            return None

        this_year = local_today().year
        first_year = min(local_date(player.user.created_at).year, this_year) if player.user else this_year
        year = min(max(year or this_year, first_year), this_year)
        start, end = utc_start_of(date(year, 1, 1)), utc_start_of(date(year + 1, 1, 1))

        days = {}
        AnalyticsService._count_by_day(days, db.session.query(SimulationAttempt.attempted_at).filter(
            SimulationAttempt.player_id == player.player_id,
            SimulationAttempt.attempted_at >= start, SimulationAttempt.attempted_at < end,
        ))
        AnalyticsService._count_by_day(days, db.session.query(BaselineAssessment.completed_at).filter(
            BaselineAssessment.player_id == player.player_id,
            BaselineAssessment.completed_at >= start, BaselineAssessment.completed_at < end,
        ))
        return {
            "year": year,
            "first_year": first_year,
            "last_year": this_year,
            "days": days,
            "total": sum(days.values()),
            "active_days": len(days),
        }

    @staticmethod
    def _count_by_day(days, timestamps):
        """Add one to the day (YYYY-MM-DD) of each timestamp."""
        for (moment,) in timestamps:
            key = local_date(moment).isoformat()
            days[key] = days.get(key, 0) + 1

    @staticmethod
    def get_monitored_user(user_id):
        """One user's summary for the admin."""
        user = db.session.get(User, user_id)

        if not user:
            return None

        return AnalyticsService._serialize_user(user)

    @staticmethod
    def delete_user(user_id, current_user_id):
        """Delete a user and everything linked to them."""
        user = db.session.get(User, user_id)

        if not user:
            return False, "User not found."

        if user.user_id == current_user_id:
            return False, "Administrators cannot delete their own account."

        try:
            if user.player:
                AnalyticsService.delete_player_data(user.player.player_id)
            # Campaigns need a creator, so an admin's campaigns pass to the admin deleting them
            EmailCampaign.query.filter_by(created_by_user_id=user.user_id).update(
                {"created_by_user_id": current_user_id}, synchronize_session=False,
            )

            db.session.delete(user)
            db.session.commit()
            return True, "User deleted successfully."
        except Exception:
            db.session.rollback()
            raise

    @staticmethod
    def delete_player_data(player_id):
        """Remove everything a player created so the player row can be deleted."""
        attempt_ids = [attempt_id for (attempt_id,) in db.session.query(
            SimulationAttempt.attempt_id
        ).filter_by(player_id=player_id).all()]
        if attempt_ids:
            db.session.query(FeedbackReport).filter(
                FeedbackReport.attempt_id.in_(attempt_ids)
            ).delete(synchronize_session=False)
            db.session.query(UserAction).filter(
                UserAction.attempt_id.in_(attempt_ids)
            ).delete(synchronize_session=False)
        db.session.query(SimulationAttempt).filter_by(player_id=player_id).delete()
        db.session.query(SimulationSession).filter_by(player_id=player_id).delete()
        db.session.query(PerformanceTracker).filter_by(player_id=player_id).delete()

        assessment_ids = [assessment_id for (assessment_id,) in db.session.query(
            BaselineAssessment.assessment_id
        ).filter_by(player_id=player_id).all()]
        if assessment_ids:
            db.session.query(BaselineResponse).filter(
                BaselineResponse.assessment_id.in_(assessment_ids)
            ).delete(synchronize_session=False)
            db.session.query(BaselineAssessment).filter_by(
                player_id=player_id
            ).delete(synchronize_session=False)

    @staticmethod
    def _serialize_user(user):
        """A user's details and stats for the admin tables."""
        player = user.player
        profile = player.profile if player else None
        player_id = player.player_id if player else None
        attempts = (
            SimulationAttempt.query.filter_by(player_id=player_id).all()
            if player_id else []
        )
        simulations = len(attempts)
        accuracy = round(
            (sum(attempt.correct for attempt in attempts) / simulations) * 100
        ) if simulations else 0
        last_session = (
            UserSession.query.filter_by(user_id=user.user_id)
            .order_by(UserSession.login_time.desc())
            .first()
        )

        return {
            "user_id": user.user_id,
            "full_name": player.full_name if player else "Administrator",
            "email": user.email,
            "role": user.role,
            "occupation": profile.occupation.value if profile else None,
            "accuracy": accuracy,
            "simulations": simulations,
            "last_active": AnalyticsService._to_utc_isoformat(
                last_session.login_time
            ) if last_session else None,
            "status": last_session.status.value if last_session else "INACTIVE",
            "created_at": AnalyticsService._to_utc_isoformat(user.created_at),
        }

    @staticmethod
    def _get_recent_activity():
        """The latest registrations, uploads, new scenarios and sessions."""
        activity = []

        activity.extend({
            "action": "New user registered",
            "detail": user.email,
            "occurred_at": user.created_at,
            "type": "user",
        } for user in User.query.all())
        activity.extend({
            "action": "Dataset uploaded",
            "detail": dataset.filename,
            "occurred_at": dataset.uploaded_at,
            "type": "dataset",
        } for dataset in Dataset.query.all())
        activity.extend({
            "action": "Scenario created",
            "detail": scenario.title,
            "occurred_at": scenario.created_at,
            "type": "scenario",
        } for scenario in ScenarioService._reviewable().all())
        activity.extend({
            "action": "Simulation completed",
            "detail": f"{session.simulation_type} simulation session",
            "occurred_at": session.completed_at,
            "type": "simulation",
        } for session in SimulationSession.query.filter(
            SimulationSession.completed_at.is_not(None)
        ).all())

        return [{
            **item,
            "occurred_at": AnalyticsService._to_utc_isoformat(item["occurred_at"]),
        } for item in sorted(
            activity,
            key=lambda item: item["occurred_at"],
            reverse=True,
        )[:4]]

    @staticmethod
    def _new_users_per_day(filters, days, last_day):
        """New accounts per day inside the chart window, for the activity chart."""
        first_day = last_day - timedelta(days=days - 1)
        query = db.session.query(User.created_at).filter(
            User.created_at >= utc_start_of(first_day),
            User.created_at < utc_start_of(last_day + timedelta(days=1)),
        )
        if filters.group:
            query = query.filter(User.user_id.in_(filters.group_users()))
        counts = {}
        for (created_at,) in query:
            counts[local_date(created_at)] = counts.get(local_date(created_at), 0) + 1
        return counts

    @staticmethod
    def _scenario_categories():
        """Map every scenario id to its category (one query, used by the charts)."""
        return dict(db.session.query(Scenario.scenario_id, Scenario.category).all())

    @staticmethod
    def _to_utc_isoformat(value):
        """Serialize database timestamps as UTC for correct browser rendering."""

        return value.replace(tzinfo=timezone.utc).isoformat()
