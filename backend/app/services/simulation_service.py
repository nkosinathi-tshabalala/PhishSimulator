# Scoring a player's answer and saving it (CATCH "Test")

from datetime import datetime

from app.extensions import db
from app.models.authentication import Player
from app.models.scenario import Scenario
from app.models.simulation import SimulationAttempt, UserAction
from app.models.analytics import FeedbackReport, PerformanceTracker
from app.schemas.simulation_schema import SimulationSchema
from app.analytics import FeedbackGenerator
from app.services.campaign_service import CampaignService
from app.services.progress_service import ProgressService
from app.utils.clues import evaluate_justification


class SimulationService:
    """Scores a player's decision and saves it as an attempt."""
    TRAP_ACTIONS = {"LINK": "CLICKED_LINK", "ATTACHMENT": "OPENED_ATTACHMENT"}

    @staticmethod
    def _trap(data):
        """Which risky interaction replaced the decision, if any."""
        if data.get("clicked_link"):
            return "LINK"
        if data.get("opened_attachment"):
            return "ATTACHMENT"
        return None

    @staticmethod
    def save_attempt(user_id, data):
        """Score a decision on the server and store the attempt."""
        valid, message = SimulationSchema.validate_attempt(data)
        if not valid:
            return False, message, None

        player = Player.query.filter_by(user_id=user_id).first()
        if not player:
            return False, "Player profile not found.", None

        scenario = db.session.get(Scenario, data["scenario_id"])
        if not scenario or (scenario.status or "").upper() != "ACTIVE":
            return False, "Scenario not found or inactive.", None

        CampaignService.sync_player(player)   # campaign results count as earlier decisions
        previous_attempts = SimulationAttempt.query.filter_by(player_id=player.player_id).all()
        progress_before = ProgressService.summary(previous_attempts)

        trap = SimulationService._trap(data)
        player_answer = str(data["player_answer"]).upper().strip()
        correct = player_answer == scenario.correct_answer.upper()
        justification = data.get("justification", "").strip()
        clue_result = evaluate_justification(scenario, data.get("selected_clues", []), justification)

        xp_earned = ProgressService.calculate_xp(
            correct,
            scenario.difficulty,
            clue_result["net_found"],
            progress_before["multiplier"],
        )

        attempt = SimulationAttempt(
            player_id=player.player_id,
            scenario_id=scenario.scenario_id,
            simulation_type=scenario.simulation_type,
            player_answer=player_answer,
            correct=correct,
            score=xp_earned,
            difficulty=scenario.difficulty,
            selected_clues=",".join(data.get("selected_clues", [])),
            justification=justification,
            clue_score=clue_result["score"],
        )
        db.session.add(attempt)
        SimulationService._update_tracker(player.player_id, correct, xp_earned)

        feedback = FeedbackGenerator.build(scenario, correct, clue_result, trap)
        db.session.flush()
        db.session.add(UserAction(
            attempt_id=attempt.attempt_id,
            action=SimulationService.TRAP_ACTIONS.get(trap, player_answer),
        ))
        db.session.add(FeedbackReport(
            attempt_id=attempt.attempt_id,
            feedback=feedback["summary"],
            phishing_cues=",".join(clue_result["real"]),
        ))
        db.session.commit()

        progress_after = ProgressService.summary(previous_attempts + [attempt])

        return True, "Attempt saved successfully.", {
            "attempt_id": attempt.attempt_id,
            "correct": correct,
            "correct_answer": scenario.correct_answer,
            "clicked_link": trap == "LINK",
            "opened_attachment": trap == "ATTACHMENT",
            "clue_score": clue_result["score"],
            "xp_earned": xp_earned,
            "feedback": feedback,
            "progress": progress_after,
            "changes": SimulationService._progress_changes(progress_before, progress_after),
        }

    @staticmethod
    def _update_tracker(player_id, correct, xp_earned):
        """Keep the stored performance totals in step with each attempt."""
        tracker = PerformanceTracker.query.filter_by(player_id=player_id).first()
        if not tracker:
            tracker = PerformanceTracker(
                player_id=player_id,
                total_attempts=0,
                correct_attempts=0,
                total_score=0,
            )
            db.session.add(tracker)

        tracker.total_attempts += 1
        tracker.correct_attempts += int(correct)
        tracker.total_score += xp_earned
        tracker.last_attempt_at = datetime.utcnow()

    @staticmethod
    def _progress_changes(before, after):
        """Describe what changed so the player can be congratulated."""
        earned_before = {badge["key"] for badge in before["badges"] if badge["earned"]}
        new_badges = [
            badge for badge in after["badges"]
            if badge["earned"] and badge["key"] not in earned_before
        ]
        tier_before = before["skill"]["tier_index"]
        tier_after = after["skill"]["tier_index"]

        return {
            "level_up": after["level"] > before["level"],
            "new_badges": new_badges,
            "rank_change": (
                "up" if tier_after > tier_before
                else "down" if tier_after < tier_before
                else None
            ),
            "rating_before": before["skill"]["rating"],
        }
