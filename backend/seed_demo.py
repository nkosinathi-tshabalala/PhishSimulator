# Loads realistic demo data so a fresh database looks and behaves like a real deployment.
#
#   .venv\Scripts\python.exe reset_database.py --confirm-reset
#   .venv\Scripts\python.exe seed_demo.py
#
# It creates an admin, a cohort of test players, the active scenarios and baseline questions,
# baseline assessments, and about four months of practice. Each player has a habit (from never to
# daily), so trends, streaks, badges and the activity calendar look real. Only when OWNER_EMAIL is
# set does it also create a player for your own address, with a couple of finished email campaigns.
#
# It only ever uses your own email plus clearly fake @phishsimulator.test test accounts.

import json
import os
import random
from datetime import datetime, time, timedelta
from pathlib import Path

from app import create_app
from app.extensions import bcrypt, db
from app.enums.occupation import Occupation
from app.models.analytics import PerformanceTracker
from app.models.authentication import Player, User, UserProfile, UserSession
from app.models.baseline import BaselineAssessment, BaselineQuestion, BaselineResponse
from app.models.email import EmailCampaign, EmailCampaignRecipient
from app.models.scenario import Scenario
from app.models.simulation import SimulationAttempt, SimulationSession, UserAction
from app.services.progress_service import ProgressService

SEED_DIR = Path(__file__).parent / "app" / "seed"
RANDOM_SEED = 2026
# About four months of history, so streaks, badges and the yearly activity calendar have data
DAYS = 120

# How often a kind of player practises: (name, chance of practising on any day, decisions on an active day).
# The weights make most players occasional or weekly, with a few daily learners who build long streaks.
HABITS = [
    ("never", 0.0, (0, 0)),
    ("occasional", 0.12, (1, 3)),
    ("weekly", 0.3, (1, 4)),
    ("regular", 0.6, (2, 5)),
    ("daily", 0.9, (2, 6)),
    ("dedicated", 0.97, (3, 6)),
]
HABIT_WEIGHTS = [2, 3, 3, 2, 1, 1]

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@phishsimulator.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin#2026")
DEMO_PASSWORD = os.getenv("DEMO_PASSWORD", "Player#2026")
# Only create an owner player when OWNER_EMAIL is set explicitly. Left unset, you register your own
# account from scratch; campaigns still reach it because it is on CAMPAIGN_ALLOWED_RECIPIENTS.
OWNER_EMAIL = (os.getenv("OWNER_EMAIL") or "").strip().lower()

# Realistic South-African cohort: (full name, age, occupation, has IT background)
PLAYERS = [
    ("Lerato Mokoena", 21, Occupation.STUDENT, False), ("Johan van der Merwe", 44, Occupation.EMPLOYEE, True),
    ("Ayanda Khumalo", 29, Occupation.EMPLOYEE, False), ("Sipho Ndlovu", 37, Occupation.OTHER, False),
    ("Thabo Molefe", 33, Occupation.EMPLOYEE, True), ("Megan Pillay", 24, Occupation.STUDENT, False),
    ("Fatima Govender", 41, Occupation.OTHER, False), ("Lebogang Sithole", 28, Occupation.EMPLOYEE, False),
    ("Mia Venter", 22, Occupation.STUDENT, False), ("Aisha Reddy", 35, Occupation.OTHER, True),
    ("Shaun Isaacs", 26, Occupation.STUDENT, True), ("Liam Botha", 19, Occupation.STUDENT, False),
    ("Yusuf Patel", 48, Occupation.EMPLOYEE, False), ("Karabo Nkosi", 31, Occupation.EMPLOYEE, True),
    ("Chloe Naidoo", 27, Occupation.OTHER, False), ("Carla van Wyk", 23, Occupation.STUDENT, False),
    ("Yusuf Moosa", 20, Occupation.STUDENT, False), ("Nadia Isaacs", 39, Occupation.EMPLOYEE, False),
    ("Refilwe Dlamini", 34, Occupation.EMPLOYEE, True), ("Tshepo Molefe", 45, Occupation.OTHER, False),
    ("Thandi Mthembu", 25, Occupation.STUDENT, False), ("Karabo Tshabalala", 22, Occupation.STUDENT, False),
    ("Daniel Botha", 42, Occupation.EMPLOYEE, True), ("Mpho Masilela", 30, Occupation.EMPLOYEE, False),
    ("Lee-Ann Davids", 38, Occupation.OTHER, False), ("Kagiso Dlamini", 21, Occupation.STUDENT, False),
    ("Lebogang Mashaba", 27, Occupation.EMPLOYEE, True), ("Nompumelelo Sithole", 36, Occupation.EMPLOYEE, False),
    ("Thabo Khumalo", 40, Occupation.OTHER, False), ("Mpho Mahlangu", 24, Occupation.STUDENT, False),
    ("Tshepo Baloyi", 29, Occupation.EMPLOYEE, True), ("Zanele Mashaba", 23, Occupation.STUDENT, False),
    ("Kagiso Khumalo", 33, Occupation.EMPLOYEE, False), ("Busisiwe Shabalala", 46, Occupation.EMPLOYEE, False),
    ("Nhlanhla Ndlovu", 26, Occupation.STUDENT, True), ("Lwazi Mahlangu", 22, Occupation.STUDENT, False),
    ("Pieter Nel", 50, Occupation.EMPLOYEE, False), ("Lebogang Zulu", 31, Occupation.EMPLOYEE, True),
    ("Zanele Mabaso", 28, Occupation.OTHER, False), ("Refilwe Baloyi", 24, Occupation.STUDENT, False),
]

BASELINE_ANSWERS = [
    "I would check the sender's full address and not click any link until I confirm it is genuine.",
    "The urgent deadline and the request for my password are clear warning signs of phishing.",
    "I would hover over the link to see the real destination before deciding to trust it.",
    "I would report it to IT rather than clicking, because the sender domain looks wrong.",
    "A real bank never asks for your PIN by email, so I would treat this as a scam and delete it.",
]


def load_fixture(name):
    return json.loads((SEED_DIR / name).read_text(encoding="utf-8"))


def wipe_dynamic_data():
    """Clear everything the seed creates, so it can be re-run without a full reset."""
    for model in (UserAction, SimulationAttempt, SimulationSession, BaselineResponse, BaselineAssessment,
                  PerformanceTracker, EmailCampaignRecipient, EmailCampaign, UserProfile, Player,
                  UserSession, BaselineQuestion, Scenario):
        db.session.query(model).delete()
    db.session.query(User).delete()
    db.session.commit()


def seed_scenarios():
    from app.datasets.scenario_realism import quality_score
    created = []
    for row in load_fixture("scenarios.json"):
        is_phishing = row["correct_answer"] == "REPORT"
        cues = [cue.strip() for cue in (row.get("phishing_cues") or "").split(",") if cue.strip()]
        scenario = Scenario(
            title=row["title"], simulation_type=row["simulation_type"], category=row["category"],
            difficulty=row["difficulty"], sender=row["sender"], subject=row["subject"], message=row["message"],
            correct_answer=row["correct_answer"], phishing_cues=row.get("phishing_cues"),
            attachment=row.get("attachment"), status="ACTIVE", approved_at=datetime.utcnow(),
            quality_score=quality_score(row["simulation_type"], row["sender"], row["subject"], row["message"], is_phishing, cues),
        )
        db.session.add(scenario)
        created.append(scenario)
    db.session.commit()
    return created


def seed_baseline_questions():
    for row in load_fixture("baseline_questions.json"):
        question = BaselineQuestion(
            question_text=row["question"], instruction=row.get("instruction", ""),
            expected_keywords=",".join(row["expectedKeywords"]), example_answer=row["exampleAnswer"],
            feedback=row.get("feedback", ""), confidence_threshold=row["confidenceThreshold"],
        )
        db.session.add(question)
    db.session.commit()
    return BaselineQuestion.query.all()


def make_user(email, password, role, full_name=None, profile=None, joined_at=None):
    user = User(email=email.lower(), password_hash=bcrypt.generate_password_hash(password).decode("utf-8"),
                role=role, created_at=joined_at or datetime.utcnow())
    db.session.add(user)
    db.session.flush()
    if role == "PLAYER":
        player = Player(user_id=user.user_id, full_name=full_name, joined_at=joined_at or datetime.utcnow())
        db.session.add(player)
        db.session.flush()
        age, occupation, it_background = profile
        db.session.add(UserProfile(player_id=player.player_id, age=age, occupation=occupation, it_background=it_background))
        return user, player
    return user, None


def seed_baseline(player, questions, rng, joined_at):
    """A completed baseline assessment: score reflects the player's ability."""
    ability = rng.uniform(0.35, 0.95)
    assessment = BaselineAssessment(player_id=player.player_id, started_at=joined_at,
                                    completed_at=joined_at + timedelta(minutes=6))
    db.session.add(assessment)
    db.session.flush()
    passed_count = 0
    for index, question in enumerate(questions):
        passed = rng.random() < ability
        passed_count += passed
        keywords = question.get_expected_keywords()
        matched = keywords[: max(1, int(len(keywords) * (0.9 if passed else 0.3)))] if keywords else []
        db.session.add(BaselineResponse(
            assessment_id=assessment.assessment_id, question_id=question.question_id,
            answer_text=BASELINE_ANSWERS[index % len(BASELINE_ANSWERS)],
            matched_keywords=",".join(matched),
            score=round(len(matched) / len(keywords) * 100) if keywords else (100 if passed else 40),
            passed=passed,
        ))
    assessment.score = round(passed_count / len(questions) * 100) if questions else 0
    return assessment.score


def seed_attempts(player, scenarios, rng, joined_at, ability, habit):
    """Decisions day by day since joining: the habit decides how often and how much the player practises.
    Accuracy climbs a little as they learn, and harder scenarios are answered correctly less often."""
    _, chance, (fewest, most) = habit
    pools = {
        "EMAIL": [s for s in scenarios if s.simulation_type == "EMAIL"],
        "SMS": [s for s in scenarios if s.simulation_type == "SMS"],
    }
    now = datetime.utcnow()
    day, index = joined_at.date(), 0
    while day <= now.date():
        if rng.random() < chance:
            for _ in range(rng.randint(fewest, most)):
                when = datetime.combine(day, time(rng.randint(7, 21), rng.randint(0, 59)))
                when = min(max(when, joined_at + timedelta(minutes=10)), now - timedelta(minutes=rng.randint(5, 90)))
                pool = pools["EMAIL"] if rng.random() < 0.55 else pools["SMS"]
                if pool:
                    _add_attempt(player, rng.choice(pool), rng, when, ability + min(index / 100, 1) * 0.15)
                    index += 1
        day += timedelta(days=1)

    db.session.flush()
    _seed_sessions(player, rng)
    _refresh_tracker(player.player_id)


def _add_attempt(player, scenario, rng, when, skill):
    """One decision on a scenario, right or wrong depending on the player's skill."""
    difficulty_penalty = {"Easy": 0.08, "Medium": 0.0, "Hard": -0.12}.get(scenario.difficulty, 0.0)
    correct = rng.random() < min(0.98, skill + difficulty_penalty)
    answer = scenario.correct_answer if correct else ("SAFE" if scenario.correct_answer == "REPORT" else "REPORT")
    clues = rng.randint(2, 3) if correct else rng.randint(0, 1)
    clue_score = rng.choice([80, 100]) if correct else rng.choice([0, 33, 50])
    trap = None
    if not correct and scenario.correct_answer == "REPORT":
        trap = rng.choice([None, "CLICKED_LINK", "OPENED_ATTACHMENT"])
    attempt = SimulationAttempt(
        player_id=player.player_id, scenario_id=scenario.scenario_id, simulation_type=scenario.simulation_type,
        player_answer=answer, correct=correct, score=ProgressService.calculate_xp(correct, scenario.difficulty, clues, 1.0),
        difficulty=scenario.difficulty, selected_clues="", justification="", clue_score=clue_score, attempted_at=when,
    )
    db.session.add(attempt)
    db.session.flush()
    db.session.add(UserAction(attempt_id=attempt.attempt_id, action=trap or answer))


def _seed_sessions(player, rng):
    """Login sessions (for active-user counts) and one training session per active day."""
    attempts = SimulationAttempt.query.filter_by(player_id=player.player_id).order_by(
        SimulationAttempt.attempted_at).all()
    if not attempts:
        return
    by_day = {}
    for attempt in attempts:
        by_day.setdefault(attempt.attempted_at.date(), []).append(attempt)
    for day, day_attempts in by_day.items():
        start = min(a.attempted_at for a in day_attempts)
        end = max(a.attempted_at for a in day_attempts)
        db.session.add(UserSession(user_id=player.user_id, login_time=start,
                                   logout_time=end + timedelta(minutes=2), status="LOGGED_OUT"))
        by_type = {}
        for attempt in day_attempts:
            by_type.setdefault(attempt.simulation_type, []).append(attempt)
        for simulation_type, rows in by_type.items():
            db.session.add(SimulationSession(
                player_id=player.player_id, simulation_type=simulation_type,
                started_at=min(a.attempted_at for a in rows), completed_at=max(a.attempted_at for a in rows),
                total_attempts=len(rows), total_score=sum(a.score or 0 for a in rows),
            ))
    # A recent open login for some players, so "active now" and "active this week" show data
    if rng.random() < 0.5:
        db.session.add(UserSession(user_id=player.user_id,
                                   login_time=datetime.utcnow() - timedelta(hours=rng.randint(1, 72)), status="ACTIVE"))


def _refresh_tracker(player_id):
    attempts = SimulationAttempt.query.filter_by(player_id=player_id).all()
    tracker = PerformanceTracker(
        player_id=player_id, total_attempts=len(attempts),
        correct_attempts=sum(a.correct for a in attempts), total_score=sum(a.score or 0 for a in attempts),
        last_attempt_at=max((a.attempted_at for a in attempts), default=None),
    )
    db.session.add(tracker)


def seed_campaigns(admin, owner_player, scenarios):
    """A couple of finished campaigns to the owner's own inbox, so the campaign metrics show data.
    Results are pre-settled and marked as already notified, so seeding sends no email."""
    if not owner_player:
        return 0
    from app.services.campaign_service import CampaignService, POINTS

    email_phish = next((s for s in scenarios if s.simulation_type == "EMAIL" and s.correct_answer == "REPORT"), None)
    email_safe = next((s for s in scenarios if s.simulation_type == "EMAIL" and s.correct_answer == "SAFE"), None)
    now = datetime.utcnow()
    plans = []
    if email_phish:
        plans.append((email_phish, "REPORTED", now - timedelta(days=4)))
    if email_safe:
        plans.append((email_safe, "CLICKED", now - timedelta(days=1)))

    for scenario, outcome, when in plans:
        is_phishing = scenario.correct_answer == "REPORT"
        campaign = EmailCampaign(
            scenario_id=scenario.scenario_id, created_by_user_id=admin.user_id,
            name=f"{scenario.title} campaign", status="LAUNCHED", created_at=when - timedelta(minutes=5),
            launched_at=when - timedelta(minutes=5), sender=scenario.sender, subject=scenario.subject,
            message=scenario.message, is_phishing=is_phishing, phishing_cues=scenario.phishing_cues,
            attachment=scenario.attachment,
        )
        db.session.add(campaign)
        db.session.flush()
        recipient = EmailCampaignRecipient(
            campaign_id=campaign.campaign_id, recipient_email=owner_player.user.email,
            tracking_token=os.urandom(24).hex(), delivery_status="SENT", sent_at=when - timedelta(minutes=4),
            opened_at=when - timedelta(minutes=3), open_count=1,
            clicked_at=when if outcome == "CLICKED" else None, click_count=1 if outcome == "CLICKED" else 0,
            clicked_kind="LINK" if outcome == "CLICKED" else None,
            reported_at=when if outcome == "REPORTED" else None,
            settled_outcome=outcome, xp_awarded=POINTS[(is_phishing, outcome)],
            notified_at=when, feedback_seen_at=None,
        )
        db.session.add(recipient)
    db.session.commit()
    # Turn those results into the owner's decisions, exactly as the live app does
    CampaignService.sync_player(owner_player)
    db.session.commit()
    return len(plans)


def main():
    rng = random.Random(RANDOM_SEED)
    app = create_app()
    with app.app_context():
        print("Clearing existing data...")
        wipe_dynamic_data()

        print("Loading scenarios and baseline questions...")
        scenarios = seed_scenarios()
        questions = seed_baseline_questions()

        admin, _ = make_user(ADMIN_EMAIL, ADMIN_PASSWORD, "ADMIN")

        owner = None
        if OWNER_EMAIL:
            _, owner = make_user(
                OWNER_EMAIL, DEMO_PASSWORD, "PLAYER", full_name="Nkosinathi Tshabalala",
                profile=(24, Occupation.STUDENT, True), joined_at=datetime.utcnow() - timedelta(days=DAYS),
            )

        print(f"Creating {len(PLAYERS)} test players with history...")
        for name, age, occupation, it_background in PLAYERS:
            local = name.lower().replace(" ", ".").replace("-", "")
            joined = datetime.utcnow() - timedelta(days=rng.randint(7, DAYS))
            _, player = make_user(f"{local}@phishsimulator.test", DEMO_PASSWORD, "PLAYER",
                                  full_name=name, profile=(age, occupation, it_background), joined_at=joined)
            ability = seed_baseline(player, questions, rng, joined) / 100
            habit = rng.choices(HABITS, weights=HABIT_WEIGHTS)[0]
            seed_attempts(player, scenarios, rng, joined, max(0.3, ability - 0.1), habit)
        db.session.commit()

        if owner:
            joined = owner.joined_at
            ability = seed_baseline(owner, questions, rng, joined) / 100
            # The account you demo with, so give it a solid history to look at
            seed_attempts(owner, scenarios, rng, joined, max(0.55, ability), HABITS[3])
            db.session.commit()

        campaigns = seed_campaigns(admin, owner, scenarios)

        players = Player.query.count()
        attempts = SimulationAttempt.query.count()
        print("\nDemo data loaded:")
        print(f"  admin: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")
        if owner:
            print(f"  you:   {OWNER_EMAIL} / {DEMO_PASSWORD}  (campaigns can be sent here)")
        print(f"  {players} players, {len(scenarios)} scenarios, {len(questions)} baseline questions, "
              f"{attempts} decisions, {campaigns} campaigns")


if __name__ == "__main__":
    main()
