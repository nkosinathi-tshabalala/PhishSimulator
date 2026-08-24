from datetime import datetime

from app.extensions import db
from app.models.authentication import Player
from app.models.scenario import Scenario
from app.models.simulation.simulation_attempt import SimulationAttempt
from app.models.analytics import FeedbackReport, PerformanceTracker
from app.schemas.simulation_schema import SimulationSchema
from app.analytics import FeedbackGenerator


class SimulationService:

    @staticmethod
    def save_attempt(user_id, data):
        """Store an attempt using the database as the source of truth."""

        valid, message = SimulationSchema.validate_attempt(data)
        if not valid:
            return False, message, None

        player = Player.query.filter_by(user_id=user_id).first()
        if not player:
            return False, "Player profile not found.", None

        scenario_id = data.get("scenario_id")
        scenario = db.session.get(Scenario, scenario_id)
        if not scenario or scenario.status.upper() != "ACTIVE":
            return False, "Scenario not found or inactive.", None

        player_answer = str(data.get("player_answer", "")).upper()
        if player_answer not in {"REPORT", "SAFE"}:
            return False, "Choose either REPORT or SAFE.", None

        correct = player_answer == scenario.correct_answer.upper()
        attempt = SimulationAttempt(
            player_id=player.player_id,
            scenario_id=scenario.scenario_id,
            simulation_type=scenario.simulation_type,
            player_answer=player_answer,
            correct=correct,
            score=10 if correct else 0,
        )
        db.session.add(attempt)
        tracker = PerformanceTracker.query.filter_by(player_id=player.player_id).first()
        if not tracker:
            tracker = PerformanceTracker(
                player_id=player.player_id,
                total_attempts=0,
                correct_attempts=0,
                total_score=0,
            )
            db.session.add(tracker)
        tracker.total_attempts += 1
        tracker.correct_attempts += int(correct)
        tracker.total_score += attempt.score
        tracker.last_attempt_at = datetime.utcnow()

        feedback = FeedbackGenerator.for_attempt(scenario, correct)
        db.session.flush()
        db.session.add(FeedbackReport(
            attempt_id=attempt.attempt_id,
            feedback=feedback,
            phishing_cues=",".join(scenario.get_phishing_cues()),
        ))
        db.session.commit()

        return True, "Attempt saved successfully.", {
            "attempt_id": attempt.attempt_id,
            "correct": correct,
            "score": attempt.score,
            "feedback": feedback,
            "phishing_cues": scenario.get_phishing_cues(),
        }
