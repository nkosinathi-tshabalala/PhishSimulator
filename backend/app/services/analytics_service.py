from datetime import datetime, time, timedelta, timezone

from sqlalchemy import func

from app.extensions import db
from app.models.authentication import Player, User, UserProfile, UserSession
from app.models.baseline import BaselineAssessment, BaselineResponse
from app.models.datasets import Dataset
from app.models.datasets import DatasetRecord
from app.models.scenario import Scenario
from app.models.simulation import SimulationAttempt, SimulationSession, UserAction
from app.adaptive.adaptive_engine import AdaptiveEngine
from app.analytics import FeedbackGenerator


class AnalyticsService:
	"""Provides platform-wide analytics for administrators."""

	@staticmethod
	def get_public_platform_summary():
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
		today_start = datetime.combine(datetime.today().date(), time.min)
		total_attempts = db.session.query(func.count(SimulationAttempt.attempt_id)).scalar() or 0
		correct_attempts = (
			db.session.query(func.count(SimulationAttempt.attempt_id))
			.filter(SimulationAttempt.correct.is_(True))
			.scalar()
			or 0
		)

		accuracy = round((correct_attempts / total_attempts) * 100) if total_attempts else 0

		recent_activity = AnalyticsService._get_recent_activity()

		return {
			"total_users": User.query.count(),
			"registered_players": Player.query.count(),
			"datasets": Dataset.query.count(),
			"scenarios": Scenario.query.count(),
			"active_scenarios": Scenario.query.filter(
				func.upper(Scenario.status) == "ACTIVE"
			).count(),
			"simulation_sessions": SimulationSession.query.count(),
			"sessions_today": SimulationSession.query.filter(
				SimulationSession.started_at >= today_start
			).count(),
			"average_accuracy": accuracy,
			"recent_activity": recent_activity,
		}

	@staticmethod
	def get_admin_analytics():
		attempts = SimulationAttempt.query.all()
		total_attempts = len(attempts)
		correct_attempts = sum(attempt.correct for attempt in attempts)
		completed_baselines = BaselineAssessment.query.filter(
			BaselineAssessment.completed_at.is_not(None)
		).all()
		seven_days_ago = datetime.utcnow() - timedelta(days=7)
		active_users = (
			db.session.query(func.count(func.distinct(UserSession.user_id)))
			.filter(UserSession.login_time >= seven_days_ago)
			.scalar()
			or 0
		)
		by_type = []
		for simulation_type in ("EMAIL", "SMS"):
			type_attempts = [
				attempt for attempt in attempts
				if attempt.simulation_type.upper() == simulation_type
			]
			type_correct = sum(attempt.correct for attempt in type_attempts)
			by_type.append({
				"type": simulation_type,
				"attempts": len(type_attempts),
				"accuracy": round(
					(type_correct / len(type_attempts)) * 100
				) if type_attempts else 0,
			})
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
					"title": scenario.title,
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
			"name": dataset.filename,
			"records": dataset.record_count,
			"processed_records": DatasetRecord.query.filter_by(
				dataset_id=dataset.dataset_id,
				processed=True,
			).count(),
		} for dataset in Dataset.query.order_by(Dataset.uploaded_at.desc()).all()]
		activity = []
		for day_offset in range(4, -1, -1):
			day = (datetime.utcnow() - timedelta(days=day_offset)).date()
			day_start = datetime.combine(day, time.min)
			day_end = day_start + timedelta(days=1)
			activity.append({
				"date": day.isoformat(),
				"attempts": sum(
					day_start <= attempt.attempted_at < day_end
					for attempt in attempts
				),
				"new_users": User.query.filter(
					User.created_at >= day_start,
					User.created_at < day_end,
				).count(),
			})
		return {
			"total_simulations": total_attempts,
			"average_accuracy": round(
				(correct_attempts / total_attempts) * 100
			) if total_attempts else 0,
			"average_baseline_score": round(
				sum(assessment.score for assessment in completed_baselines)
				/ len(completed_baselines)
			) if completed_baselines else 0,
			"active_users_7d": active_users,
			"by_type": by_type,
			"most_difficult": most_difficult,
			"most_missed_cue": most_missed_cue,
			"datasets": datasets,
			"activity": activity,
		}

	@staticmethod
	def get_monitored_users():
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

	@staticmethod
	def get_player_performance(user_id):
		player = Player.query.filter_by(user_id=user_id).first()

		if not player:
			return None

		attempts = SimulationAttempt.query.filter_by(
			player_id=player.player_id
		).order_by(SimulationAttempt.attempted_at.desc()).all()
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
		false_positive_rate = round((false_positives / total_attempts) * 100) if total_attempts else 0
		false_negative_rate = round((false_negatives / total_attempts) * 100) if total_attempts else 0
		xp = sum(attempt.score or 0 for attempt in attempts)
		level = (xp // 100) + 1
		xp_into_level = xp % 100
		difficulty, adaptive_reason = AdaptiveEngine.recommend_difficulty(
			attempts,
			baseline.score if baseline else None,
		)
		player_xp = {
			other_player.player_id: sum(
				attempt.score or 0 for attempt in SimulationAttempt.query.filter_by(
					player_id=other_player.player_id
				).all()
			)
			for other_player in Player.query.all()
		}
		rank = 1 + sum(score > xp for score in player_xp.values())
		by_type = []
		for simulation_type in ("EMAIL", "SMS"):
			type_attempts = [
				attempt for attempt in attempts
				if attempt.simulation_type.upper() == simulation_type
			]
			type_correct = sum(attempt.correct for attempt in type_attempts)
			by_type.append({
				"type": simulation_type,
				"attempts": len(type_attempts),
				"correct": type_correct,
				"accuracy": round((type_correct / len(type_attempts)) * 100) if type_attempts else 0,
			})
		recent_attempts = []
		for attempt in attempts[:5]:
			scenario = db.session.get(Scenario, attempt.scenario_id)
			recent_attempts.append({
				"scenario": (
					f"{scenario.simulation_type.title()} training scenario #{scenario.scenario_id}"
					if scenario and scenario.title == "Dataset training scenario"
					else scenario.title if scenario else "Deleted scenario"
				),
				"type": attempt.simulation_type.upper(),
				"correct": attempt.correct,
				"feedback": (
					FeedbackGenerator.for_attempt(scenario, attempt.correct)
					if scenario else "This scenario is no longer available. Review the sender, request, and context before your next simulation."
				),
				"attempted_at": AnalyticsService._to_utc_isoformat(attempt.attempted_at),
			})
		history = {}
		for attempt in attempts:
			day = attempt.attempted_at.date().isoformat()
			day_data = history.setdefault(day, {"email": 0, "sms": 0, "correct": 0, "attempts": 0})
			day_data["email" if attempt.simulation_type.upper() == "EMAIL" else "sms"] += 1
			day_data["correct"] += int(attempt.correct)
			day_data["attempts"] += 1
		history_rows = [{
			"date": day,
			"email": values["email"],
			"sms": values["sms"],
			"accuracy": round((values["correct"] / values["attempts"]) * 100),
		} for day, values in sorted(history.items(), reverse=True)[:7]]

		return {
			"overall_accuracy": accuracy,
			"false_positives": false_positives,
			"false_positive_rate": false_positive_rate,
			"false_negatives": false_negatives,
			"false_negative_rate": false_negative_rate,
			"total_attempts": total_attempts,
			"correct_attempts": correct_attempts,
			"baseline_score": round(baseline.score) if baseline else None,
			"baseline_completed_at": AnalyticsService._to_utc_isoformat(baseline.completed_at) if baseline else None,
			"difficulty": difficulty,
			"adaptive_reason": adaptive_reason,
			"xp": xp,
			"level": level,
			"xp_into_level": xp_into_level,
			"rank": rank,
			"player_count": len(player_xp),
			"by_type": by_type,
			"recent_attempts": recent_attempts,
			"history": history_rows,
		}

	@staticmethod
	def get_monitored_user(user_id):
		user = db.session.get(User, user_id)

		if not user:
			return None

		return AnalyticsService._serialize_user(user)

	@staticmethod
	def delete_user(user_id, current_user_id):
		user = db.session.get(User, user_id)

		if not user:
			return False, "User not found."

		if user.user_id == current_user_id:
			return False, "Administrators cannot delete their own account."

		try:
			if user.player:
				player_id = user.player.player_id
				attempt_ids = [attempt_id for (attempt_id,) in db.session.query(
					SimulationAttempt.attempt_id
				).filter_by(player_id=player_id).all()]
				if attempt_ids:
					db.session.query(UserAction).filter(
						UserAction.attempt_id.in_(attempt_ids)
					).delete(synchronize_session=False)
				db.session.query(SimulationAttempt).filter_by(player_id=player_id).delete()
				db.session.query(SimulationSession).filter_by(player_id=player_id).delete()
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

			db.session.delete(user)
			db.session.commit()
			return True, "User deleted successfully."
		except Exception:
			db.session.rollback()
			raise

	@staticmethod
	def _serialize_user(user):
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
		} for scenario in Scenario.query.all())
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
	def _to_utc_isoformat(value):
		"""Serialize database timestamps as UTC for correct browser rendering."""

		return value.replace(tzinfo=timezone.utc).isoformat()
